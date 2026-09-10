// injected.js - Runs in MAIN WORLD
// Intercepts Facebook's network responses AND scans inline SSR scripts

window.__kiraya_intercepted_images = [];

function cleanAndStoreUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return;
  
  // Clean all JSON escapes across the entire URL
  let clean = rawUrl
    .replace(/\\u0025/g, '%')
    .replace(/\\u0026/g, '&')
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/\\u003[cCeE]/g, '')
    .replace(/\\/g, '')
    .replace(/&amp;/g, '&');

  if (!clean.startsWith('http') || !clean.includes('fbcdn.net')) return;
  
  // Skip UI icons, emojis, avatars, and sponsored badges. Note: we do NOT skip
  // `.png` — Facebook serves real listing photos as PNG too, and dropping them
  // was zeroing out whole posts. The small size-variant filters below already
  // remove avatars/thumbnails regardless of format.
  if (
    clean.includes('rsrc.php') ||
    clean.includes('emoji') ||
    clean.includes('p50x50') ||
    clean.includes('p100x100') ||
    clean.includes('s100x100') ||
    clean.includes('-1/') ||
    clean.includes('t39.99422') ||
    clean.includes('t45.') ||
    // Animated stickers / keyframe animations, not photos: served from the
    // `/t6/` media path as `.kf` (Facebook "KeyFrames"), mime image/x.fb.keyframes.
    clean.includes('/t6/') ||
    /\.kf(\?|$)/.test(clean)
  ) {
    return;
  }

  window.__kiraya_intercepted_images.push(clean);
}

// 1. Intercept fetch()
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const response = await originalFetch.apply(this, args);
  try {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    if (url.includes('graphql') || url.includes('api/graphql')) {
      const clone = response.clone();
      clone.text().then(text => {
        // Match full URLs without stopping at escaped slashes (\/)
        const regex = /https?:?\\?\/\\?\/scontent[^"'\s<>]+/g;
        const matches = text.match(regex) || [];
        matches.forEach(cleanAndStoreUrl);
      }).catch(() => {});
    }
  } catch (e) {}
  return response;
};

// 2. Intercept XMLHttpRequest
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url, ...rest) {
  this._kiraya_url = url;
  return originalXHROpen.apply(this, [method, url, ...rest]);
};

XMLHttpRequest.prototype.send = function(...args) {
  this.addEventListener('load', function() {
    try {
      if (this._kiraya_url && (this._kiraya_url.includes('graphql') || this._kiraya_url.includes('api/graphql'))) {
        const regex = /https?:?\\?\/\\?\/scontent[^"'\s<>]+/g;
        const matches = (this.responseText || '').match(regex) || [];
        matches.forEach(cleanAndStoreUrl);
      }
    } catch (e) {}
  });
  return originalXHRSend.apply(this, args);
};

// 3. Listen for extraction request
window.addEventListener('KIRAYA_EXTRACT_REACT', () => {
  try {
    // Scan all inline SSR JSON scripts across the entire page
    const scripts = document.querySelectorAll('script[type="application/json"], script:not([src])');
    scripts.forEach(s => {
      const text = s.textContent || '';
      if (text.includes('scontent')) {
        const regex = /https?:?\\?\/\\?\/scontent[^"'\s<>]+/g;
        const matches = text.match(regex) || [];
        matches.forEach(cleanAndStoreUrl);
      }
    });

    // Deduplicate by clean base URL (without ephemeral query params)
    const seen = new Set();
    const uniqueImages = [];
    
    for (const url of window.__kiraya_intercepted_images) {
      const baseUrl = url.split('?')[0];
      if (!seen.has(baseUrl)) {
        seen.add(baseUrl);
        uniqueImages.push(url);
      }
    }
    
    console.log(`[Kiraya Interceptor] Cleaned & captured ${uniqueImages.length} distinct property photos.`);
    
    window.dispatchEvent(new CustomEvent('KIRAYA_REACT_DATA_RESPONSE', {
      detail: { images: uniqueImages }
    }));
    
    window.__kiraya_intercepted_images = [];
  } catch (err) {
    console.error("[Kiraya Interceptor] Error:", err);
    window.dispatchEvent(new CustomEvent('KIRAYA_REACT_DATA_RESPONSE', { detail: { images: [] } }));
  }
});

console.log("[Kiraya] Full property photo interceptor active.");
