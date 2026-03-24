// background.js — service worker

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'downloadImages') {
    handleDownloads(msg.images, msg.format, msg.quality)
      .then(results => sendResponse({ success: true, results }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }
});

async function handleDownloads(images, format, quality) {
  const results = [];
  let index = 0;

  for (const image of images) {
    try {
      let dataUrl = null;
      let filename = getFilename(image.url, index++, format);

      if (format !== 'original' || isWebP(image.url)) {
        // Convert using offscreen fetch + canvas
        dataUrl = await fetchAndConvert(image.url, format, quality);
      }

      const downloadUrl = dataUrl || image.url;

      await chrome.downloads.download({
        url: downloadUrl,
        filename: 'ImageGrab/' + filename,
        conflictAction: 'uniquify',
        saveAs: false
      });

      results.push({ url: image.url, status: 'ok' });
    } catch (e) {
      results.push({ url: image.url, status: 'error', error: e.message });
    }
  }

  return results;
}

/**
 * Fetch an image and convert it to PNG or JPEG via OffscreenCanvas.
 */
async function fetchAndConvert(url, format, quality) {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const blob = await response.blob();

  // Use OffscreenCanvas (available in service worker)
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);

  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const outputBlob = await canvas.convertToBlob({
    type: mimeType,
    quality: format === 'jpeg' ? (quality / 100) : undefined
  });

  return blobToDataUrl(outputBlob);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

function isWebP(url) {
  return /\.webp(\?.*)?$/i.test(url);
}

function getFilename(url, index, format) {
  try {
    const u = new URL(url);
    let name = u.pathname.split('/').pop() || `image_${index}`;
    // Remove query params from name
    name = name.split('?')[0];

    if (format === 'png') {
      name = name.replace(/\.[^.]+$/, '') + '.png';
    } else if (format === 'jpeg') {
      name = name.replace(/\.[^.]+$/, '') + '.jpg';
    }

    // Ensure extension
    if (!/\.[a-z]{2,5}$/i.test(name)) {
      const ext = format === 'jpeg' ? '.jpg' : format === 'png' ? '.png' : '.jpg';
      name += ext;
    }

    return name;
  } catch (e) {
    const ext = format === 'jpeg' ? '.jpg' : format === 'png' ? '.png' : '.jpg';
    return `image_${index}${ext}`;
  }
}
