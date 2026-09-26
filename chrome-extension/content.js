console.log("[Kiraya Extension] Loading Target Tool...");

const floatingBtn = document.createElement('button');
floatingBtn.id = 'kiraya-global-target-btn';
floatingBtn.innerHTML = '\ud83c\udfaf Extract Listing';
floatingBtn.style.cssText = `
  position: fixed !important;
  bottom: 85px !important;
  right: 25px !important;
  background-color: #ff4757 !important;
  color: white !important;
  border: 3px solid white !important;
  padding: 12px 22px !important;
  border-radius: 50px !important;
  font-family: sans-serif !important;
  font-size: 15px !important;
  font-weight: bold !important;
  cursor: pointer !important;
  z-index: 2147483647 !important;
  box-shadow: 0 4px 15px rgba(0,0,0,0.4) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
`;

function ensureButtonMounted() {
  if (!document.body) return;
  if (!document.getElementById('kiraya-global-target-btn')) {
    document.body.appendChild(floatingBtn);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ensureButtonMounted);
} else {
  ensureButtonMounted();
}

// Guard against Facebook SPA page transitions removing dynamic elements
setInterval(ensureButtonMounted, 2000);

let isTargeting = false;
// True from the moment a post is clicked until its POST finishes. Guards against
// re-entry — the gallery-expand `expandBtn.click()` below fires a *synthetic*
// click that would otherwise re-trigger the document listener and send twice.
let isExtracting = false;
// After a successful send, the button becomes an "Open Review" link for a few
// seconds — one tap opens the review page instead of toggling targeting.
let pendingReviewUrl = null;

floatingBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (pendingReviewUrl) {
    window.open(pendingReviewUrl, '_blank');
    return;
  }
  isTargeting = !isTargeting;

  if (isTargeting) {
    floatingBtn.innerHTML = 'Click post or photo to extract...';
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

function extractViewerPostText(modal) {
  if (!modal) return "";
  const sidebar = modal.querySelector(
    '[data-pagelet="MediaViewerFeedbackRoot"], [data-pagelet="TahoeRightRail"], [role="complementary"]'
  );
  const target = sidebar || modal;
  // Post text message container in Facebook viewer sidebar
  const msgEl = target.querySelector(
    'div[data-ad-preview="message"], div[data-ad-comet-preview="message"], div[dir="auto"][style*="-webkit-line-clamp"]'
  );
  if (msgEl && (msgEl.innerText || "").trim().length >= 30) {
    return msgEl.innerText.trim();
  }
  // If not found, collect text blocks excluding comments and action buttons
  if (sidebar) {
    const comments = sidebar.querySelector('ul, [aria-label*="comment" i]');
    const candidateBlocks = Array.from(sidebar.querySelectorAll('div[dir="auto"], span[dir="auto"]')).filter(
      (el) => !comments || !comments.contains(el)
    );
    for (const b of candidateBlocks) {
      const t = (b.innerText || "").trim();
      if (t.length >= 50 && !t.includes('Write a comment') && !t.includes('Like') && !t.includes('Share')) {
        return t;
      }
    }
  }
  return "";
}

/**
 * Text of the single post the user clicked. Prefer Facebook's article wrapper;
 * if there is none, climb from the clicked node to the first ancestor with a
 * post-sized amount of text, stopping before it grows into the whole feed.
 */
function scopePostText(clicked, fallback) {
  // If user clicked inside Facebook's Photo Theatre viewer
  const viewerModal =
    clicked.closest('[data-pagelet="MediaViewerRoot"]') ||
    clicked.closest('[aria-label="Photo Viewer"]') ||
    clicked.closest('[aria-label="Media viewer"]') ||
    (fallback && fallback.getAttribute && fallback.getAttribute('data-pagelet') === 'MediaViewerRoot' ? fallback : null);

  if (viewerModal) {
    const vt = extractViewerPostText(viewerModal);
    if (vt && vt.length >= 30) return vt;
  }

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
  }, 120000); // generous: patient gallery stepping + server-side photo download

  let targetNode = e.target;

  // Helper to detect if Facebook's photo theatre viewer is ACTUALLY open and visible on screen
  function findActiveMediaViewer() {
    const candidates = Array.from(
      document.querySelectorAll('[role="dialog"], [aria-label*="viewer" i], [aria-label*="Photo" i], [data-pagelet="MediaViewerRoot"]')
    );
    for (const c of candidates) {
      const img = c.querySelector('img[src*="fbcdn"], img[data-visualcompletion="media-vc-image"]');
      if (img) {
        const rect = img.getBoundingClientRect();
        if ((rect.width > 150 && rect.height > 150) || (img.naturalWidth > 150 && img.naturalHeight > 150)) {
          return c;
        }
      }
    }
    return null;
  }

  // 1. Check if user clicked inside an actively displayed photo viewer
  const activeViewer = findActiveMediaViewer();
  const clickedInViewer = activeViewer && (activeViewer.contains(targetNode) || targetNode === activeViewer);

  // 2. Locate the clicked post container
  function findPostContainer(node) {
    if (clickedInViewer) return activeViewer;

    const dialog = node.closest('[role="dialog"]');
    if (dialog && dialog === activeViewer) return dialog;

    const post = node.closest('[role="article"]') ||
                 node.closest('div[data-pagelet^="FeedUnit"]') ||
                 node.closest('div[data-ad-preview="message"]');
    if (post) return post;

    let curr = node;
    let candidate = node;
    for (let i = 0; i < 10 && curr && curr !== document.body; i++) {
      const len = (curr.innerText || "").trim().length;
      if (len >= 40 && len <= 3500) candidate = curr;
      if (len > 3500) break;
      curr = curr.parentElement;
    }
    return candidate;
  }

  let postContainer = findPostContainer(targetNode);
  const rawText = scopePostText(targetNode, postContainer);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const simulateRealClick = (el) => {
    if (!el) return;
    try {
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const opts = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        screenX: x + (window.screenX || 0),
        screenY: y + (window.screenY || 0),
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true
      };
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
      el.click();
    } catch (err) {
      el.click();
    }
  };

  const isFacebook = window.location.hostname.includes('facebook.com');

  const looksLikePhoto = (src) => {
    if (!src || typeof src !== 'string' || !src.startsWith('http')) return false;
    if (
      src.includes('emoji.php') ||
      src.includes('rsrc.php') ||
      src.includes('/t6/') ||
      /\.kf(\?|$)/.test(src) ||
      src.includes('t39.99422') ||
      src.includes('t45.') ||
      // ONLY reject tiny avatars <= 100px (e.g. p50x50, s60x60, s100x100), NEVER 526x296 or 720x720!
      /[ps](?:[1-9]\d?|100)x(?:[1-9]\d?|100)(?:[\/?]|$)/.test(src)
    ) {
      return false;
    }
    if (isFacebook && !src.includes('fbcdn')) return false;
    return true;
  };

  // Normalizes Facebook CDN URLs by extracting the underlying photo filename
  // E.g. "482918231_122119283738734279_4634027732296180373_n.jpg"
  const getPhotoKey = (url) => {
    if (!url || typeof url !== 'string') return '';
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/');
      return parts[parts.length - 1] || url;
    } catch (e) {
      return url.split('?')[0];
    }
  };

  const getLargestFromSrcset = (srcset) => {
    if (!srcset) return null;
    let best = null;
    let maxW = 0;
    const items = srcset.split(',').map((s) => s.trim());
    for (const item of items) {
      const [u, w] = item.split(/\s+/);
      const width = parseInt(w, 10) || 0;
      if (width >= maxW && looksLikePhoto(u)) {
        maxW = width;
        best = u;
      }
    }
    return best;
  };

  const getImgBestSrc = (img) => {
    if (!img) return null;
    const srcsetBest = getLargestFromSrcset(img.getAttribute('srcset'));
    const src = srcsetBest || img.currentSrc || img.src || img.getAttribute('data-src') || '';
    return looksLikePhoto(src) ? src : null;
  };

  // Extract listing photos from a post container.
  // CRITICAL: We only look inside photo anchors (a[href*="/photo"], a[href*="photo.php"])
  // and strictly IGNORE user avatars, comments, icons, and reactions!
  const collectPostPhotos = (container) => {
    const photos = [];
    if (!container) return photos;

    // 1. Preferred: Photos wrapped in Facebook photo links
    const photoAnchors = Array.from(
      container.querySelectorAll('a[href*="/photo"], a[href*="photo.php"], a[href*="/photos/"]')
    ).filter((a) => {
      // Exclude comments section or user profile links
      return !a.closest('[role="article"] [role="article"]') &&
             !a.closest('[aria-label*="comment" i]') &&
             !a.closest('ul');
    });

    for (const a of photoAnchors) {
      // 1. Check <img> tags
      const img = a.querySelector('img');
      if (img) {
        const src = getImgBestSrc(img);
        if (src && !photos.includes(src)) photos.push(src);
      }

      // 2. Check CSS background-image on <a> or any descendant tile
      const bgCandidates = [a, ...Array.from(a.querySelectorAll('[style*="background-image"], [style*="background:"]'))];
      for (const el of bgCandidates) {
        const style = el.getAttribute('style') || '';
        const m = /url\((['"]?)(https:\/\/[^'")]+fbcdn[^'")]+)\1\)/.exec(style);
        if (m && looksLikePhoto(m[2]) && !photos.includes(m[2])) {
          photos.push(m[2]);
        }
      }
    }

    // 2. Fallback: check all media containers within the post
    if (photos.length === 0) {
      container.querySelectorAll('img').forEach((img) => {
        if (img.closest('[aria-label*="comment" i]') || img.closest('ul')) return;
        if (img.width > 0 && img.width < 100 && img.height > 0 && img.height < 100) return;
        const src = getImgBestSrc(img);
        if (src && !photos.includes(src)) photos.push(src);
      });

      container.querySelectorAll('[style*="background-image"]').forEach((el) => {
        if (el.closest('[aria-label*="comment" i]') || el.closest('ul')) return;
        const style = el.getAttribute('style') || '';
        const m = /url\((['"]?)(https:\/\/[^'")]+fbcdn[^'")]+)\1\)/.exec(style);
        if (m && looksLikePhoto(m[2]) && !photos.includes(m[2])) photos.push(m[2]);
      });
    }

    return photos;
  };

  // Helper to extract ONLY the active displayed photo from the theatre viewport stage
  // (Excludes the right sidebar containing comments / other post recommendations)
  const getActiveTheatrePhoto = (modal) => {
    if (!modal) return null;
    // Primary: Facebook's main photo viewport image
    const mainImg =
      modal.querySelector('img[data-visualcompletion="media-vc-image"]') ||
      modal.querySelector('div[data-pagelet="MediaViewerRoot"] img[src*="fbcdn"]');
    if (mainImg) {
      const src = getImgBestSrc(mainImg);
      if (src) return src;
    }

    // Fallback: search all fbcdn images inside modal, excluding right sidebar, sorted by size descending
    const sidebar = modal.querySelector('[role="complementary"], [data-pagelet="MediaViewerFeedbackRoot"], [data-pagelet="TahoeRightRail"]');
    const imgs = Array.from(modal.querySelectorAll('img')).filter((img) => {
      if (sidebar && sidebar.contains(img)) return false;
      if (img.closest('[aria-label*="comment" i]')) return false;
      const src = img.currentSrc || img.src || '';
      return src.includes('fbcdn');
    });

    imgs.sort((a, b) => {
      const aArea = (a.naturalWidth || a.clientWidth || 0) * (a.naturalHeight || a.clientHeight || 0);
      const bArea = (b.naturalWidth || b.clientWidth || 0) * (b.naturalHeight || b.clientHeight || 0);
      return bArea - aArea;
    });

    for (const img of imgs) {
      const src = getImgBestSrc(img);
      if (src) return src;
    }
    return null;
  };

  const advanceNextPhoto = (modal) => {
    if (!modal) return;
    // 1. The viewer's own Next control, by any of the labels FB uses.
    const nextBtn = modal.querySelector(
      '[aria-label="Next photo"], [aria-label="Next"], [aria-label*="next photo" i], [aria-label*="see next" i], div[role="button"][aria-label*="next" i], a[aria-label*="next" i]'
    );
    if (nextBtn) simulateRealClick(nextBtn);

    // 2. Keyboard fallback. FB's theatre listens for ArrowRight, but only when it
    // has focus — so focus the modal (and the active image) first, then fire the
    // key at every plausible target.
    try { if (modal.focus) modal.focus(); } catch (e) {}
    const keyOpts = { key: 'ArrowRight', keyCode: 39, which: 39, code: 'ArrowRight', bubbles: true, cancelable: true };
    const targets = [document.activeElement, modal, document.body, document, window].filter(Boolean);
    for (const t of targets) {
      try { t.dispatchEvent(new KeyboardEvent('keydown', keyOpts)); } catch (e) {}
      try { t.dispatchEvent(new KeyboardEvent('keyup', keyOpts)); } catch (e) {}
    }
  };

  // Check if post displays a "+4", "+5" overlay indicating hidden photos
  let extraCount = 0;
  let plusElement = null;
  for (const el of postContainer.querySelectorAll('span, div, a')) {
    const txt = el.innerText?.trim();
    const match = txt && txt.match(/^\+(\d+)$/);
    if (match) {
      extraCount = parseInt(match[1], 10);
      plusElement = el;
      break;
    }
  }

  // Initial thumbnails already visible inside this single post
  const imageSet = new Set(collectPostPhotos(postContainer));
  const initialThumbCount = imageSet.size;

  // Scope the MAIN-world network interceptor to THIS extraction: clear whatever
  // it captured from earlier feed scrolling, so from here on it only collects
  // the photo loads triggered by opening THIS post's gallery.
  try { window.dispatchEvent(new CustomEvent('KIRAYA_RESET_IMAGES')); } catch (e) {}

  let dialogModal = clickedInViewer ? activeViewer : null;

  // If not already in viewer, open the photo gallery
  if (!dialogModal) {
    let expandTarget = null;
    if (plusElement) {
      expandTarget = plusElement.querySelector('img') || plusElement.closest('a') || plusElement;
    }
    if (!expandTarget && targetNode && targetNode.tagName === 'IMG' && postContainer.contains(targetNode)) {
      expandTarget = targetNode;
    }
    if (!expandTarget) {
      // Find the first visible photo thumbnail in the post
      const firstImg = postContainer.querySelector('a[href*="/photo"] img, a[href*="photo.php"] img, div[role="button"] img[src*="fbcdn"]');
      if (firstImg) expandTarget = firstImg;
    }
    if (!expandTarget) {
      const photoLinks = Array.from(postContainer.querySelectorAll('a[href*="/photo"], a[href*="photo.php"], a[href*="/photos/"]'));
      if (photoLinks.length > 0) expandTarget = photoLinks[0];
    }
    if (!expandTarget) {
      const photoImg = postContainer.querySelector('img[src*="fbcdn"]');
      if (photoImg) expandTarget = photoImg;
    }

    if (expandTarget) {
      console.log('[Kiraya Extension] Opening photo gallery...', expandTarget, 'extra count:', extraCount);
      floatingBtn.innerHTML = 'Opening gallery...';
      simulateRealClick(expandTarget);

      // Wait up to 3.5s for real viewer to appear
      for (let i = 0; i < 7; i++) {
        await sleep(500);
        dialogModal = findActiveMediaViewer();
        if (dialogModal) break;
      }
    }
  }

  // If theatre opened (or was already open), step through each photo ONE BY ONE
  if (dialogModal) {
    console.log('[Kiraya Extension] Photo theatre active. Stepping through images one by one...');
    floatingBtn.innerHTML = 'Extracting photos…';

    const visitedKeys = new Set();
    const theatrePhotos = [];

    // Check if Facebook displays a photo counter like "1 of 5" or "1 / 5"
    let totalPhotosExpected = 0;
    try {
      const counterMatch = dialogModal.innerText?.match(/\b(\d+)\s*(?:of|\/)\s*(\d+)\b/i);
      if (counterMatch && counterMatch[2]) {
        const parsedTotal = parseInt(counterMatch[2], 10);
        if (parsedTotal >= 1 && parsedTotal <= 15) {
          totalPhotosExpected = parsedTotal;
          console.log(`[Kiraya Extension] Detected gallery count: ${totalPhotosExpected}`);
        }
      }
    } catch (e) {}

    // How many photos to walk to. Prefer FB's own "1 of N"; else visible tiles +
    // the "+N" overlay count. Walk a few extra as a safety margin.
    const expected = totalPhotosExpected > 0
      ? totalPhotosExpected
      : Math.max(initialThumbCount + extraCount, 6);
    const steps = Math.min(22, expected + 3);

    // Blind-advance through the whole album. Crucially we do NOT stop when the
    // on-screen image "looks the same" — FB's theatre DOM is unreliable to read,
    // and last time that false-stagnation quit after one frame. Instead we just
    // navigate `steps` times with a pause, capturing whatever's on screen best-
    // effort. Every navigation makes FB fetch that photo, and the MAIN-world
    // interceptor (drained after this) captures the URL — so even photos the DOM
    // read misses still arrive. This is what reaches the ones behind "+N".
    for (let step = 0; step < steps; step++) {
      const photo = getActiveTheatrePhoto(dialogModal);
      if (photo) {
        const k = getPhotoKey(photo);
        if (!visitedKeys.has(k)) {
          visitedKeys.add(k);
          theatrePhotos.push(photo);
          floatingBtn.innerHTML = `Extracting photo ${theatrePhotos.length}…`;
        }
      }
      if (theatrePhotos.length >= 12) break;
      advanceNextPhoto(dialogModal);
      await sleep(750); // let the next photo load so the interceptor catches it
    }
    console.log(`[Kiraya Extension] Walked ${steps} step(s); DOM-read ${theatrePhotos.length} distinct photo(s).`);

    // Merge high-resolution theatre photos into imageSet, replacing thumbnails
    for (const tp of theatrePhotos) {
      const tpKey = getPhotoKey(tp);
      for (const existing of Array.from(imageSet)) {
        if (getPhotoKey(existing) === tpKey) {
          imageSet.delete(existing);
        }
      }
      imageSet.add(tp);
    }

    // Close theatre only if WE opened it (leave open if user was already viewing it)
    if (!clickedInViewer && dialogModal) {
      try {
        const closeBtn = dialogModal.querySelector('[aria-label="Close"], [aria-label="close"], [aria-label="Back"]');
        if (closeBtn) {
          simulateRealClick(closeBtn);
        } else {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, code: 'Escape', bubbles: true }));
        }
      } catch (err) {}
    }
  }

  // Fold in whatever the MAIN-world interceptor captured while the gallery was
  // open — GraphQL photo URLs the DOM walk couldn't see (lazy / off-screen album
  // images). Buffer was reset above, so these belong to this post. Dedupe by
  // photo key so a thumbnail and its hi-res twin don't both survive.
  try {
    const reactImages = await new Promise((resolve) => {
      let settled = false;
      const onData = (ev) => {
        settled = true;
        window.removeEventListener('KIRAYA_REACT_DATA_RESPONSE', onData);
        resolve((ev.detail && ev.detail.images) || []);
      };
      window.addEventListener('KIRAYA_REACT_DATA_RESPONSE', onData);
      window.dispatchEvent(new CustomEvent('KIRAYA_EXTRACT_REACT'));
      setTimeout(() => {
        if (settled) return;
        window.removeEventListener('KIRAYA_REACT_DATA_RESPONSE', onData);
        resolve([]);
      }, 1500);
    });
    const haveKeys = new Set([...imageSet].map(getPhotoKey));
    for (const u of reactImages) {
      if (!looksLikePhoto(u)) continue;
      const k = getPhotoKey(u);
      if (!haveKeys.has(k)) {
        haveKeys.add(k);
        imageSet.add(u);
      }
    }
    console.log(`[Kiraya Extension] Interceptor added ${reactImages.length} candidate(s); total now ${imageSet.size}.`);
  } catch (e) {}

  floatingBtn.innerHTML = 'Sending to Next.js...';

  // allImages is strictly scoped to the clicked post: DOM thumbnails + theatre
  // hi-res + this-post GraphQL captures, deduped, capped at the DB's 12.
  const allImages = [...imageSet].slice(0, 12);
  console.log(`[Kiraya Extension] Scoped photos for upload: ${allImages.length}`, allImages);

  // Safe retrieval of storage settings (handles Chrome extension context invalidation gracefully)
  const getSettings = () => {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        chrome.storage.local.get(['apiEndpoint', 'apiKey'], (res) => resolve(res || {}));
      } else {
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
      let staged = null;
      let reviewUrl = null;
      try {
        const json = await response.json();
        staged = json?.photosStaged;
        reviewUrl = json?.review;
        console.log('[Kiraya Extension] Listing created for review:', json);
      } catch (e) {}
      floatingBtn.innerHTML =
        staged != null ? `Sent \u2705 (${staged} photos) \u2014 Open Review \u2197` : 'Sent \u2705 \u2014 Open Review \u2197';
      if (reviewUrl) {
        const base = apiEndpoint.replace(/\/api\/ingest.*$/, '');
        pendingReviewUrl = `${base}${reviewUrl}`;
      }
    } else {
      let msg = '';
      try {
        msg = (await response.json())?.error || '';
      } catch (e) {}
      console.warn('[Kiraya Extension] Ingest failed:', response.status, msg);
      const shortErr = msg ? msg.slice(0, 30) : `HTTP ${response.status}`;
      floatingBtn.innerHTML = `Failed: ${shortErr} \u274c`;
    }
  } catch (error) {
    console.error("Kiraya Request Error:", error);
    floatingBtn.innerHTML = `Error: ${error.message || 'Network'} \u274c`;
  }

  clearTimeout(watchdog);
  isExtracting = false;
  setTimeout(() => {
    pendingReviewUrl = null;
    floatingBtn.innerHTML = '\ud83c\udfaf Extract Listing';
    floatingBtn.classList.remove('active');
    resetTargeting();
  }, 4500);
}

// Listen for clicks on the document in the capture phase
document.addEventListener('click', (e) => {
  if (!isTargeting || isExtracting || e.target === floatingBtn) return;
  handleTargetClick(e);
}, true); // true = capture phase, intercepts click before facebook can
