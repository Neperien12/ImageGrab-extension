// content.js — runs in the context of the web page

/**
 * Collects all images from the current page:
 * - <img> tags
 * - CSS background-image
 * - <picture> / <source> srcset
 * - <a> links pointing to image files
 */
function collectImages() {
  const seen = new Set();
  const images = [];

  function addImage(src, width = 0, height = 0, alt = '') {
    if (!src || src.startsWith('data:') || src.startsWith('blob:')) return;
    try {
      const url = new URL(src, location.href).href;
      if (seen.has(url)) return;
      seen.add(url);
      images.push({ url, width, height, alt });
    } catch (e) { /* skip invalid URLs */ }
  }

  // 1. <img> tags
  document.querySelectorAll('img').forEach(img => {
    const src = img.currentSrc || img.src;
    addImage(src, img.naturalWidth || img.width, img.naturalHeight || img.height, img.alt);

    // srcset
    if (img.srcset) {
      img.srcset.split(',').forEach(part => {
        const url = part.trim().split(/\s+/)[0];
        if (url) addImage(url, 0, 0, img.alt);
      });
    }
  });

  // 2. <picture> <source> srcset
  document.querySelectorAll('picture source').forEach(source => {
    if (source.srcset) {
      source.srcset.split(',').forEach(part => {
        const url = part.trim().split(/\s+/)[0];
        if (url) addImage(url, 0, 0);
      });
    }
  });

  // 3. CSS background-image on visible elements
  const allEls = document.querySelectorAll('*');
  allEls.forEach(el => {
    try {
      const style = window.getComputedStyle(el);
      const bg = style.backgroundImage;
      if (bg && bg !== 'none') {
        const matches = bg.matchAll(/url\(["']?([^"')]+)["']?\)/g);
        for (const match of matches) {
          addImage(match[1], el.offsetWidth, el.offsetHeight);
        }
      }
    } catch (e) {}
  });

  // 4. <a> links pointing to image files
  document.querySelectorAll('a[href]').forEach(a => {
    const href = a.href;
    if (/\.(jpe?g|png|gif|webp|svg|avif|bmp|tiff?)(\?.*)?$/i.test(href)) {
      addImage(href, 0, 0, a.textContent?.trim());
    }
  });

  return images;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getImages') {
    const images = collectImages();
    sendResponse({ images });
  }
  return true;
});
