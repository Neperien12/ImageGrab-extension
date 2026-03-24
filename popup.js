// popup.js

let allImages = [];
let selectedUrls = new Set();
let currentFormat = 'original';
let currentQuality = 90;
let currentMinSize = 0;

// DOM refs
const scanBtn = document.getElementById('scanBtn');
const controlsBar = document.getElementById('controlsBar');
const statsBar = document.getElementById('statsBar');
const emptyState = document.getElementById('emptyState');
const loadingState = document.getElementById('loadingState');
const imageGrid = document.getElementById('imageGrid');
const footer = document.getElementById('footer');
const downloadBtn = document.getElementById('downloadBtn');
const totalCountEl = document.getElementById('totalCount');
const selectedCountEl = document.getElementById('selectedCount');
const footerInfoEl = document.getElementById('footerInfo');
const qualityGroup = document.getElementById('qualityGroup');
const qualitySlider = document.getElementById('qualitySlider');
const qualityVal = document.getElementById('qualityVal');

// ===== FORMAT PILLS =====
document.querySelectorAll('.pill[data-format]').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.pill[data-format]').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    currentFormat = pill.dataset.format;
    qualityGroup.style.display = currentFormat === 'jpeg' ? 'block' : 'none';
    updateFooter();
  });
});

// ===== QUALITY SLIDER =====
qualitySlider.addEventListener('input', () => {
  currentQuality = parseInt(qualitySlider.value);
  qualityVal.textContent = currentQuality;
});

// ===== SIZE FILTERS =====
document.querySelectorAll('.size-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.size-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    currentMinSize = parseInt(pill.dataset.min);
    renderGrid();
  });
});

// ===== SELECT ALL / DESELECT =====
document.getElementById('selectAllBtn').addEventListener('click', () => {
  const visible = getVisibleImages();
  visible.forEach(img => selectedUrls.add(img.url));
  document.querySelectorAll('.img-card').forEach(card => {
    const url = card.dataset.url;
    if (visible.find(i => i.url === url)) card.classList.add('selected');
  });
  updateStats();
  updateFooter();
});

document.getElementById('deselectAllBtn').addEventListener('click', () => {
  selectedUrls.clear();
  document.querySelectorAll('.img-card').forEach(c => c.classList.remove('selected'));
  updateStats();
  updateFooter();
});

// ===== SCAN =====
scanBtn.addEventListener('click', async () => {
  showLoading(true);
  selectedUrls.clear();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Inject content script if needed
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    }).catch(() => {}); // ignore if already injected

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getImages' });

    if (response && response.images) {
      allImages = response.images;
      renderGrid();
      showControls(allImages.length > 0);
    } else {
      allImages = [];
      renderGrid();
    }
  } catch (e) {
    showToast('Erreur: impossible de scanner la page', 'error');
    showLoading(false);
    showEmpty(true);
  }
});

// ===== RENDER GRID =====
function getVisibleImages() {
  return allImages.filter(img => {
    if (currentMinSize === 0) return true;
    const w = img.width || 0;
    const h = img.height || 0;
    return w >= currentMinSize || h >= currentMinSize;
  });
}

function renderGrid() {
  showLoading(false);
  const visible = getVisibleImages();

  if (visible.length === 0) {
    imageGrid.innerHTML = '';
    footer.style.display = 'none';
    statsBar.style.display = 'none';
    showEmpty(true);
    return;
  }

  showEmpty(false);
  statsBar.style.display = 'flex';
  totalCountEl.textContent = visible.length;
  updateStats();

  imageGrid.innerHTML = '';

  visible.forEach(img => {
    const card = document.createElement('div');
    card.className = 'img-card' + (selectedUrls.has(img.url) ? ' selected' : '');
    card.dataset.url = img.url;

    const isWebP = /\.webp(\?.*)?$/i.test(img.url);
    const dims = (img.width && img.height) ? `${img.width}×${img.height}` : '';
    const hostname = (() => { try { return new URL(img.url).hostname.replace('www.', ''); } catch { return ''; } })();

    card.innerHTML = `
      ${isWebP ? '<div class="webp-badge">WebP</div>' : ''}
      <img src="${escHtml(img.url)}" alt="${escHtml(img.alt || '')}" class="loading" loading="lazy">
      <div class="overlay">
        <div class="overlay-check">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0f0f11" stroke-width="3">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        ${dims ? `<div class="overlay-info">${dims}</div>` : ''}
      </div>
    `;

    const imgEl = card.querySelector('img');
    imgEl.addEventListener('load', () => {
      imgEl.classList.remove('loading');
      imgEl.classList.add('loaded');
    });
    imgEl.addEventListener('error', () => {
      card.style.display = 'none';
    });

    card.addEventListener('click', () => toggleSelect(card, img.url));
    imageGrid.appendChild(card);
  });

  updateFooter();
}

function toggleSelect(card, url) {
  if (selectedUrls.has(url)) {
    selectedUrls.delete(url);
    card.classList.remove('selected');
  } else {
    selectedUrls.add(url);
    card.classList.add('selected');
  }
  updateStats();
  updateFooter();
}

function updateStats() {
  selectedCountEl.textContent = selectedUrls.size;
}

function updateFooter() {
  const count = selectedUrls.size;
  if (count === 0) {
    footer.style.display = 'none';
    return;
  }

  footer.style.display = 'flex';

  const formatLabel = currentFormat === 'original' ? 'format original' : currentFormat.toUpperCase();
  footerInfoEl.innerHTML = `<strong>${count}</strong> image${count > 1 ? 's' : ''}<br><span style="font-size:10px;opacity:0.6">${formatLabel}</span>`;

  downloadBtn.disabled = count === 0;
  downloadBtn.textContent = '';
  downloadBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    Télécharger ${count > 1 ? count + ' fichiers' : '1 fichier'}
  `;
}

// ===== DOWNLOAD =====
downloadBtn.addEventListener('click', async () => {
  const selected = allImages.filter(img => selectedUrls.has(img.url));
  if (selected.length === 0) return;

  downloadBtn.disabled = true;
  downloadBtn.innerHTML = `<div class="spinner" style="width:14px;height:14px;border-width:2px;margin:0"></div> En cours…`;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'downloadImages',
      images: selected,
      format: currentFormat,
      quality: currentQuality
    });

    if (response.success) {
      const errors = response.results.filter(r => r.status === 'error').length;
      const ok = response.results.filter(r => r.status === 'ok').length;
      if (errors === 0) {
        showToast(`✓ ${ok} image${ok > 1 ? 's' : ''} téléchargée${ok > 1 ? 's' : ''}`, 'success');
      } else {
        showToast(`${ok} ok, ${errors} erreur${errors > 1 ? 's' : ''}`, 'error');
      }
    } else {
      showToast('Erreur lors du téléchargement', 'error');
    }
  } catch (e) {
    showToast('Erreur: ' + e.message, 'error');
  } finally {
    updateFooter();
  }
});

// ===== UI HELPERS =====
function showLoading(on) {
  loadingState.style.display = on ? 'flex' : 'none';
  if (on) {
    imageGrid.innerHTML = '';
    emptyState.style.display = 'none';
    statsBar.style.display = 'none';
    footer.style.display = 'none';
  }
}

function showEmpty(on) {
  emptyState.style.display = on ? 'flex' : 'none';
}

function showControls(on) {
  controlsBar.style.display = on ? 'flex' : 'none';
}

function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
