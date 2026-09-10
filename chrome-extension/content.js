console.log("[Kiraya Extension] Loading Target Tool...");

// 1. Create a floating button on the body
const floatingBtn = document.createElement('button');
floatingBtn.id = 'kiraya-global-target-btn';
floatingBtn.innerHTML = '\ud83c\udfaf Extract Listing';
document.body.appendChild(floatingBtn);

let isTargeting = false;
// True from the moment a post is clicked until its POST finishes. Guards against
// re-entry — the gallery-expand `expandBtn.click()` below fires a *synthetic*
// click that would otherwise re-trigger the document listener and send twice.
let isExtracting = false;

floatingBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  isTargeting = !isTargeting;
  
  if (isTargeting) {
    floatingBtn.innerHTML = 'Click ANY text on the post...';
    floatingBtn.style.backgroundColor = '#2ed573';
    document.body.style.cursor = 'crosshair';
  } else {
    resetTargeting();
  }
});

function resetTargeting() {
  isTargeting = false;
  floatingBtn.innerHTML = '\ud83c\udfaf Extract Listing';
  floatingBtn.style.backgroundColor = '#ff4757';
  document.body.style.cursor = 'default';
  document.body.classList.remove('kiraya-targeting-active');
  const activeTarget = document.querySelector('.kiraya-current-target');
  if (activeTarget) activeTarget.classList.remove('kiraya-current-target');
}

/**
 * Text of the single post the user clicked. Prefer Facebook's article wrapper;
 * if there is none, climb from the clicked node to the first ancestor with a
 * post-sized amount of text, stopping before it grows into the whole feed.
 */
function scopePostText(clicked, fallback) {
  const article = clicked.closest('[role="article"]');
  if (article) {
    const t = (article.innerText || "").trim();
    if (t.length >= 40) return t;
  }
  let el = clicked;
  let chosen = clicked;
  for (let i = 0; i < 8 && el && el !== document.body; i++) {
    const len = (el.innerText || "").trim().length;
    if (len >= 60) {
      chosen = el;
      if (len > 1500) break; // getting into neighbouring posts; stop climbing
    }
    el = el.parentElement;
  }
  const scoped = (chosen.innerText || "").trim();
  return scoped.length >= 40 ? scoped : ((fallback && fallback.innerText) || "").trim();
}

async function handleTargetClick(e) {
  e.preventDefault();
  e.stopPropagation();

  // Stop targeting immediately, before any programmatic click below can bounce
  // back through the document listener as a second extraction. One click = one send.
  if (isExtracting) return;
  isExtracting = true;
  isTargeting = false;
  document.body.style.cursor = 'default';

  // Watchdog: if a run never completes — a hung fetch, or the content script
  // orphaned by an extension reload so its post-await code can't run — don't
  // leave the button frozen. Reset it so the next click works.
  const watchdog = setTimeout(() => {
    if (!isExtracting) return;
    isExtracting = false;
    floatingBtn.innerHTML = 'Timed out — reload page & retry';
    resetTargeting();
  }, 60000); // generous: paging a large gallery + server-side photo download

  let targetNode = e.target;
  let postContainer = targetNode.closest('[role="dialog"]') || targetNode.closest('[role="article"]') || targetNode.closest('[role="main"]') || document.querySelector('[role="main"]') || document.body;

  // Scope the TEXT to the single post the user clicked — not the whole group
  // feed. Grabbing role="main" (the fallback above) drags in the group header,
  // nav, and every other post below, which then blend into one wrong listing.
  //   1. Prefer the clicked post's article wrapper.
  //   2. Else climb from the click to a single-post-sized chunk (enough text to
  //      be a listing, before it balloons into neighbouring posts).
  // The server parser then further narrows to one post as a safety net.
  const rawText = scopePostText(targetNode, postContainer);
  
  floatingBtn.innerHTML = 'Expanding Gallery...';

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Keep real photos, drop chrome: emojis, static assets, tiny thumbnails, and
  // animated keyframe stickers (`/t6/` `.kf`). `.png` is allowed — FB serves real
  // photos as PNG too.
  const looksLikePhoto = (src) =>
    !!src &&
    src.startsWith('http') &&
    src.includes('fbcdn') &&
    !src.includes('emoji') &&
    !src.includes('rsrc.php') &&
    !/[ps]\d{2,3}x\d{2,3}/.test(src) && // p50x50, s100x100 → avatars/thumbs
    !src.includes('-1/') &&
    !src.includes('/t6/') &&
    !/\.kf(\?|$)/.test(src);

  const collectImgs = (root) => {
    const out = [];
    root.querySelectorAll('img').forEach((img) => {
      const src = img.currentSrc || img.src || img.getAttribute('data-src') || '';
      if (looksLikePhoto(src)) out.push(src);
    });
    // FB sometimes paints photos as a CSS background-image rather than <img>.
    root.querySelectorAll('[style*="background-image"]').forEach((el) => {
      const m = /url\((['"]?)(https:\/\/[^'")]+fbcdn[^'")]+)\1\)/.exec(el.getAttribute('style') || '');
      if (m && looksLikePhoto(m[2])) out.push(m[2]);
    });
    return out;
  };

  // Accumulate every photo we see. Start with what's already in the post (the
  // feed grid thumbnails).
  const imageSet = new Set(collectImgs(postContainer));

  // Find the "+15"-style overlay (or a photo link) to open the full gallery.
  let expandBtn = null;
  const allClickables = Array.from(postContainer.querySelectorAll('a, div[role="button"], span'));
  for (const el of allClickables) {
    const txt = el.innerText?.trim();
    if (txt && /^\+\d+$/.test(txt)) {
      expandBtn = el;
      break;
    }
  }
  if (!expandBtn) {
    const photoLinks = Array.from(postContainer.querySelectorAll('a[href*="/photo"], a[href*="/photos/"]'));
    if (photoLinks.length > 0) expandBtn = photoLinks[0];
  }

  let dialogModal = null;
  if (expandBtn) {
    console.log('[Kiraya Extension] Opening photo gallery…', expandBtn);
    try {
      expandBtn.click();
      await sleep(1000); // let the theatre open and fetch the first photo
      dialogModal = document.querySelector('[role="dialog"]');
    } catch (err) {
      console.warn('Failed to open gallery:', err);
    }
  }

  // Page through the whole gallery. Facebook loads theatre photos lazily — one
  // per view — so a single grab only ever sees the first. Advancing with the
  // Next control (or the Right arrow) forces each to load, and both the DOM scan
  // and the MAIN-world GraphQL interceptor capture it as it comes in.
  if (dialogModal) {
    const MAX_STEPS = 25; // safely past the server's 12-photo cap
    collectImgs(dialogModal).forEach((u) => imageSet.add(u));
    let stagnant = 0;
    for (let i = 0; i < MAX_STEPS && stagnant < 3; i++) {
      const before = imageSet.size;
      const nextBtn = dialogModal.querySelector(
        '[aria-label="Next photo"], [aria-label="Next"], [aria-label="See next photo"]',
      );
      if (nextBtn) nextBtn.click();
      else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', keyCode: 39, bubbles: true }));
      await sleep(550);
      collectImgs(dialogModal).forEach((u) => imageSet.add(u));
      stagnant = imageSet.size === before ? stagnant + 1 : 0;
      floatingBtn.innerHTML = `Loading photos… ${imageSet.size}`;
    }
  }

  const sourceContainer = dialogModal || postContainer;

  // Mark container for Main World injected.js
  const oldTarget = document.querySelector('.kiraya-current-target');
  if (oldTarget) oldTarget.classList.remove('kiraya-current-target');
  sourceContainer.classList.add('kiraya-current-target');

  floatingBtn.innerHTML = 'Extracting All Photos...';

  const domImages = [...imageSet];
  console.log(
    '[Kiraya Extension] DOM images =', domImages.length, '| gallery opened:', !!dialogModal,
  );

  const onReactData = async (event) => {
    window.removeEventListener('KIRAYA_REACT_DATA_RESPONSE', onReactData);
    
    const reactImages = event.detail?.images || [];
    const allImages = [...new Set([...domImages, ...reactImages])];

    console.log(
      `[Kiraya Extension] Photos — DOM: ${domImages.length}, GraphQL/interceptor: ${reactImages.length}, merged unique: ${allImages.length}`,
    );

    // Auto-close the gallery modal if we opened it
    if (dialogModal) {
      try {
        const closeBtn = dialogModal.querySelector('[aria-label="Close"], [aria-label="close"]');
        if (closeBtn) {
          closeBtn.click();
        } else {
          // Press Escape key as fallback
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        }
      } catch (err) {
        console.warn("Could not auto-close modal:", err);
      }
    }

    floatingBtn.innerHTML = 'Sending to Next.js...';

    // Safe retrieval of storage settings (handles Chrome extension context invalidation gracefully)
    const getSettings = () => {
      return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
          chrome.storage.local.get(['apiEndpoint', 'apiKey'], (res) => resolve(res || {}));
        } else {
          // Fallback if extension context was invalidated by reload
          resolve({
            apiEndpoint: 'http://localhost:3000/api/ingest',
            apiKey: 'my-super-secret-key'
          });
        }
      });
    };

    const settings = await getSettings();
    const apiEndpoint = settings.apiEndpoint || 'http://localhost:3000/api/ingest';
    const apiKey = settings.apiKey || 'my-super-secret-key';

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          source: window.location.href,
          text: rawText,
          images: allImages,
          videos: []
        })
      });

      if (response.ok) {
        // New /api/ingest returns { propertyId, photosStaged, role, review }.
        let staged = null;
        try {
          const json = await response.json();
          staged = json?.photosStaged;
          console.log('[Kiraya Extension] Listing created for review:', json);
        } catch (e) {}
        floatingBtn.innerHTML =
          staged != null ? `Sent \u2705 (${staged} photos)` : 'Sent \u2705';
      } else {
        let msg = '';
        try {
          msg = (await response.json())?.error || '';
        } catch (e) {}
        console.warn('[Kiraya Extension] Ingest failed:', response.status, msg);
        floatingBtn.innerHTML = 'Failed \u274c';
      }
    } catch (error) {
      console.error("Kiraya Request Error:", error);
      floatingBtn.innerHTML = 'Error \u274c';
    }

    clearTimeout(watchdog);
    isExtracting = false;
    setTimeout(() => {
      floatingBtn.innerHTML = '\ud83c\udfaf Extract Listing';
      floatingBtn.classList.remove('active');
      resetTargeting();
    }, 3000);
  };

  window.addEventListener('KIRAYA_REACT_DATA_RESPONSE', onReactData);

  // Trigger Main World extraction
  window.dispatchEvent(new CustomEvent('KIRAYA_EXTRACT_REACT'));
}

// Listen for clicks on the document in the capture phase
document.addEventListener('click', (e) => {
  if (!isTargeting || isExtracting || e.target === floatingBtn) return;
  handleTargetClick(e);
}, true); // true = capture phase, intercepts click before facebook can
