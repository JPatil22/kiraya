// injected.js — runs in the MAIN world.
//
// Captures Facebook photo URLs out of GraphQL responses into a buffer that
// content.js drives. The buffer is CLEARED (KIRAYA_RESET_IMAGES) right before a
// post's gallery is opened, so only that post's photo loads land in it — the
// scoping the old always-on global scan lacked — and DRAINED (KIRAYA_EXTRACT_REACT)
// once stepping is done. This is the reliable backstop for photos the DOM walk
// in content.js can't see (lazy / not-yet-rendered gallery images).

window.__kiraya_intercepted_images = [];

function cleanAndStoreUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return;

  // Unescape the JSON-escaped forms URLs take inside a GraphQL payload.
  const clean = rawUrl
    .replace(/\\u0025/g, '%')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003[dD]/g, '=')
    .replace(/\\u002[fF]/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/\\u003[cCeE]/g, '')
    .replace(/\\/g, '')
    .replace(/&amp;/g, '&');

  if (!clean.startsWith('http') || !clean.includes('fbcdn')) return;

  // Skip chrome: UI icons, emoji, avatars, sponsored badges, and animated
  // keyframe stickers (`/t6/` `.kf`, mime image/x.fb.keyframes). `.png` is kept —
  // Facebook serves real photos as PNG too. The size filter drops only the tiny
  // avatar/thumbnail variants (p50x50 … up to 100px), never real photo sizes.
  if (
    clean.includes('rsrc.php') ||
    clean.includes('emoji') ||
    clean.includes('-1/') ||
    clean.includes('t39.99422') ||
    clean.includes('t45.') ||
    clean.includes('/t6/') ||
    /\.kf(\?|$)/.test(clean) ||
    /[ps](?:[1-9]\d?|100)x(?:[1-9]\d?|100)(?:[/?]|$)/.test(clean)
  ) {
    return;
  }

  window.__kiraya_intercepted_images.push(clean);
}

function scanForPhotos(text) {
  if (!text || text.indexOf('scontent') === -1) return;
  // Match scontent URLs without stopping at escaped slashes (\/).
  const matches = text.match(/https?:?\\?\/\\?\/scontent[^"'\s<>]+/g) || [];
  matches.forEach(cleanAndStoreUrl);
}

// --- Intercept fetch() — GraphQL only, so we don't touch unrelated traffic ---
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const response = await originalFetch.apply(this, args);
  try {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    if (/graphql/i.test(url)) {
      response.clone().text().then(scanForPhotos).catch(() => {});
    }
  } catch (e) {}
  return response;
};

// --- Intercept XMLHttpRequest — same GraphQL-only guard ---
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open = function (method, url, ...rest) {
  this._kiraya_url = url;
  return originalXHROpen.apply(this, [method, url, ...rest]);
};
XMLHttpRequest.prototype.send = function (...args) {
  this.addEventListener('load', function () {
    try {
      if (/graphql/i.test(this._kiraya_url || '')) scanForPhotos(this.responseText || '');
    } catch (e) {}
  });
  return originalXHRSend.apply(this, args);
};

// content.js clears the buffer just before opening a post's gallery, so what we
// then capture belongs to that post and not to earlier feed scrolling.
window.addEventListener('KIRAYA_RESET_IMAGES', () => {
  window.__kiraya_intercepted_images = [];
});

// Drain: hand content.js the deduped buffer (by base URL, without ephemeral query
// params). Deliberately does NOT scan the whole page's SSR — that would pull in
// every other post's photos. Only what the live interceptor captured this session.
window.addEventListener('KIRAYA_EXTRACT_REACT', () => {
  try {
    const seen = new Set();
    const uniqueImages = [];
    for (const url of window.__kiraya_intercepted_images) {
      const baseUrl = url.split('?')[0];
      if (!seen.has(baseUrl)) {
        seen.add(baseUrl);
        uniqueImages.push(url);
      }
    }
    window.dispatchEvent(new CustomEvent('KIRAYA_REACT_DATA_RESPONSE', { detail: { images: uniqueImages } }));
  } catch (err) {
    window.dispatchEvent(new CustomEvent('KIRAYA_REACT_DATA_RESPONSE', { detail: { images: [] } }));
  }
});

console.log('[Kiraya] Scoped photo interceptor active.');
