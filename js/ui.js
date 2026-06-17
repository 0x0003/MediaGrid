/* File picker */
fileButton.addEventListener('click', () => fileInput.click());

/* Theme */
{
  const isLight = CONFIG.theme === 'light' || (CONFIG.theme !== 'dark' && window.matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.classList.toggle('light', isLight);
}

themeToggle.addEventListener('click', () => {
  document.documentElement.classList.toggle('light');
  updateSliderFill(speedInput);
  updateSliderFill(volumeInput);
});

/* Top bar visibility */
function updateTopBarVisibility(clientY) {
  let show = panel.classList.contains('visible');
  if (!show && clientY != null) {
    const rect = topTrigger.getBoundingClientRect();
    show = clientY >= rect.top && clientY <= rect.bottom;
  }
  topBar.classList.toggle('visible', show);
  topRight.classList.toggle('visible', show);
}

document.addEventListener('pointermove', (e) => {
  updateTopBarVisibility(e.clientY);
});
document.addEventListener('pointerleave', () => updateTopBarVisibility());
topTrigger.addEventListener('pointerdown', (e) => updateTopBarVisibility(e.clientY), { passive: true });

/* Panel toggle */
function togglePanel(show) {
  if (show === undefined) show = !panel.classList.contains('visible');
  panel.classList.toggle('visible', show);
  updateTopBarVisibility();
}
menuToggle.addEventListener('click', () => togglePanel());
panelClose.addEventListener('click', () => togglePanel(false));
togglePanel(CONFIG.loadPanelVisible);

/* Panel drag */
let panelDrag, panelOffX, panelOffY;
function clampPanelPos() {
  if (!panel.classList.contains('visible')) return;
  const r = panel.getBoundingClientRect();
  let left = parseInt(panel.style.left, 10) || r.left;
  let top = parseInt(panel.style.top, 10) || r.top;
  const maxL = window.innerWidth - panel.offsetWidth;
  const maxT = window.innerHeight - panel.offsetHeight;
  if (maxL < 0) { left = 0; top = 0; return; }
  left = Math.max(0, Math.min(left, maxL));
  top = Math.max(0, Math.min(top, maxT));
  panel.style.left = left + 'px';
  panel.style.top = top + 'px';
}
panel.addEventListener('pointerdown', e => {
  if (e.target.closest('button, input, select, label, option, .custom-select, .cs-option, #panelCloseWrap, a') || e.target.closest('#dirList')) return;
  const rect = panel.getBoundingClientRect();
  panelOffX = e.clientX - rect.left;
  panelOffY = e.clientY - rect.top;
  panelDrag = true;
  panel.setPointerCapture(e.pointerId);
});
panel.addEventListener('pointermove', e => {
  if (!panelDrag) return;
  let left = e.clientX - panelOffX;
  let top = e.clientY - panelOffY;
  left = Math.max(0, Math.min(left, window.innerWidth - panel.offsetWidth));
  top = Math.max(0, Math.min(top, window.innerHeight - panel.offsetHeight));
  panel.style.left = left + 'px';
  panel.style.top = top + 'px';
});
panel.addEventListener('pointerup', () => { panelDrag = false; });
window.addEventListener('resize', clampPanelPos);

/* Columns / Filter / Reshuffle */
columnsSelect.addEventListener('change', () => {
  const n = parseInt(columnsSelect.value, 10) || 4;
  if (n === numColumns) return;
  numColumns = n;
  for (const colIndex of [...lockedColumns.keys()]) {
    if (colIndex >= n) lockedColumns.delete(colIndex);
  }
  const prevCurY = curY;
  createColumns(n);
assignBatch();
  targetY = curY = prevCurY;
});
filterSelect.addEventListener('change', () => applyFilterAndRebuild());
reshuffleBtn.addEventListener('click', reshuffleFiles);

/* Auto-scroll */
function flashOverlay(sym) {
  if (!CONFIG.flashIndicator) return;
  let el = document.getElementById('flashIndicator');
  if (!el) {
    el = document.createElement('div');
    el.id = 'flashIndicator';
    document.body.appendChild(el);
  }
  el.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><use href="#${sym}"/></svg>`;
  el.classList.add('active');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('active'), 350);
}
toggleAutoBtn.addEventListener('click', () => {
  if (autoTicker) stopAuto();
  else startAuto();
  updateToggleText();
});
function updateToggleText() {
  toggleAutoBtn.innerHTML = '<svg width="30" height="30"><use href="#' + (autoTicker ? 'pause' : 'play') + '"/></svg>';
}

/* Slider fill */
function updateSliderFill(el) {
  const min = parseFloat(el.min) || 0;
  const max = parseFloat(el.max) || 1;
  const val = parseFloat(el.value);
  const pct = Math.round(((val - min) / (max - min)) * 100);
  el.style.setProperty('--fill-pct', pct + '%');
}
updateSliderFill(speedInput);
updateSliderFill(volumeInput);
speedInput.addEventListener('input', () => updateSliderFill(speedInput));
volumeInput.addEventListener('input', () => updateSliderFill(volumeInput));

/* Volume */
volumeInput.addEventListener('input', e => {
  volumeLevel = parseFloat(e.target.value);
  for (const it of items) {
    if (it.el && it.el._video) it.el._video.volume = volumeLevel;
  }
});

/* Touch / Wheel */
let touchY = null;
viewport.addEventListener('touchstart', e => { if (e.touches.length === 1) touchY = e.touches[0].clientY; }, { passive: true });
viewport.addEventListener('touchmove', e => { if (touchY === null) return; const y = e.touches[0].clientY; targetY += (touchY - y); touchY = y; clampTarget(); }, { passive: false });
viewport.addEventListener('touchend', () => touchY = null);
viewport.addEventListener('wheel', e => { e.preventDefault(); targetY += e.deltaY; clampTarget(); }, { passive: false });

/* Column lock */
function toggleColumnLock(colIndex) {
  if (colIndex < 0 || colIndex >= columns.length) return;
  if (lockedColumns.has(colIndex)) {
    const lockBase = lockedColumns.get(colIndex);
    lockedColumns.delete(colIndex);
    const curYr = Math.round(curY);
    const delta = curYr - lockBase;
    if (delta !== 0) {
      const col = columns[colIndex];
      for (let i = 0; i < col.items.length; i++) {
        col.items[i].top += delta;
      }
      col.height += delta;
      recomputeTotals();
      for (const itm of col.items) {
        if (itm.el) {
          itm.el.style.top = itm.top + 'px';
          itm.el.style.height = itm.height + 'px';
        }
      }
    }
  } else {
    const lockBaseRounded = Math.round(curY);
    lockedColumns.set(colIndex, lockBaseRounded);
  }
}

/* Column blur / pixelation */
function renderPixelated(img, canvas, w, h, blockDivisor) {
  const block = Math.max(1, Math.floor(Math.min(w, h) / blockDivisor));
  const sw = Math.ceil(w / block), sh = Math.ceil(h / block);
  const temp = document.createElement('canvas');
  temp.width = sw; temp.height = sh;
  temp.getContext('2d').drawImage(img, 0, 0, sw, sh);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(temp, 0, 0, sw, sh, 0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
}

function pixelateImage(it) {
  const wrap = it.el;
  if (!wrap || wrap._pixelCanvas) return;
  const img = wrap._img;
  if (!img || !img.complete || !img.naturalWidth) return;
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  if (w === 0 || h === 0) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'media loaded';
  canvas.width = w;
  canvas.height = h;
  renderPixelated(img, canvas, w, h, CONFIG.pixelDetail);
  img.style.display = 'none';
  wrap.appendChild(canvas);
  wrap._pixelCanvas = canvas;
}

function unpixelateImage(it) {
  const wrap = it.el;
  if (!wrap) return;
  if (wrap._pixelCanvas) { wrap._pixelCanvas.remove(); wrap._pixelCanvas = null; }
  if (wrap._img) wrap._img.style.display = '';
}

function resizePixelCanvas(it) {
  const wrap = it.el;
  if (!wrap || !wrap._pixelCanvas) return;
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  if (w === 0 || h === 0) return;
  const canvas = wrap._pixelCanvas;
  if (canvas.width === w && canvas.height === h) return;
  canvas.width = w;
  canvas.height = h;
  const img = wrap._img;
  if (!img) return;
  renderPixelated(img, canvas, w, h, CONFIG.pixelDetail);
}

function applyColumnBlur() {
  for (const itm of items) {
    if (!itm.el) continue;
    if (blurredColumns.has(itm.col)) {
      if (itm.el._img) pixelateImage(itm);
      else itm.el.classList.add('blurred');
    } else {
      if (itm.el._img) unpixelateImage(itm);
      else itm.el.classList.remove('blurred');
    }
  }
}

function toggleColumnBlur(colIndex) {
  if (colIndex < 0 || colIndex >= numColumns) return;
  if (blurredColumns.has(colIndex)) blurredColumns.delete(colIndex);
  else blurredColumns.add(colIndex);
  applyColumnBlur();
}

/* Zoom */
let zoomedMedia = null;
let _zoomExitHandler = null;
const zoomOverlay = document.createElement('div');
zoomOverlay.className = 'overlay overlay-zoom glass';
document.body.appendChild(zoomOverlay);

function pauseAllGridVideos() {
  for (const v of container.querySelectorAll('video')) {
    if (!v.paused) v.pause();
  }
}

function resumeAllGridVideos() {
  for (const v of container.querySelectorAll('video')) {
    playObserver.observe(v);
    if (v.dataset.wasPlaying === 'true') {
      v.play().catch(() => {});
    }
  }
}

function enterZoom(it) {
  if (!it) return;

  container.querySelectorAll('video').forEach(v => {
    v.dataset.wasPlaying = !v.paused ? 'true' : 'false';
  });
  pauseAllGridVideos();

  zoomOverlay.innerHTML = '';
  zoomOverlay.style.display = 'flex';

  const originalEl = it.el?.querySelector('.media');
  if (!originalEl) { zoomOverlay.style.display = 'none'; resumeAllGridVideos(); return; }

  let clone;
  const url = createObjectURLFor(it);
  if (it.file.type.startsWith('image/')) {
    clone = document.createElement('img');
    clone.src = url;
  } else if (it.file.type.startsWith('video/')) {
    clone = document.createElement('video');
    clone.src = url;
    clone.volume = volumeLevel;
    clone.autoplay = true;
    clone.loop = true;
    clone.muted = false;
    clone.controls = true;
    clone.currentTime = originalEl.currentTime || 0;
  } else {
    zoomOverlay.style.display = 'none'; resumeAllGridVideos(); return;
  }

  clone.className = 'zoom-clone';

  zoomOverlay.appendChild(clone);
  zoomedMedia = it;

  if (clone.tagName === 'VIDEO') {
    playWithMutedFallback(clone);
  }

  function exitHandler() {
    if (clone.tagName === 'VIDEO' && originalEl.tagName === 'VIDEO') {
      try { originalEl.currentTime = clone.currentTime; } catch (e) { }
    }
    try { clone.remove(); } catch (e) { }
    zoomOverlay.style.display = 'none';
    zoomedMedia = null;
    resumeAllGridVideos();
    try { viewport.focus({ preventScroll: true }); } catch (e) { }
    _zoomExitHandler = null;
  }

  _zoomExitHandler = exitHandler;
  zoomOverlay.addEventListener('click', exitHandler, { once: true });
}

/* File info popup */
let popupColorIndex = 0;

function nextPopupColor() {
  const hue = (popupColorIndex * 137.508) % 360;
  popupColorIndex++;
  return `hsl(${hue.toFixed(1)}deg, 75%, 60%)`;
}

async function copyTextToClipboard(text) {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try { await navigator.clipboard.writeText(text); } catch (e) { console.warn('Clipboard write failed:', e); }
  }
}

function highlightMedia(it, color) {
  const wrap = it.el;
  if (!wrap) return null;
  let borderEl = wrap.querySelector('.highlight-border');
  if (!borderEl) {
    borderEl = document.createElement('div');
    borderEl.className = 'highlight-border';
    borderEl.style.border = `5px solid ${color}`;
    wrap.appendChild(borderEl);
  } else {
    borderEl.style.borderColor = color;
    borderEl.style.opacity = '0.5';
  }
  return borderEl;
}

let activePopups = new Map();

function showInfoPopup(it, clientX, clientY) {
  if (zoomedMedia) return;
  const existing = activePopups.get(it.id);
  if (existing) {
    existing.dismiss();
    return;
  }
  const file = it.file;
  const path = file.webkitRelativePath || file.relativePath || file.name;
  const size = (file.size >= 1024) ? `${(file.size / 1024).toFixed(2)} KB` : `${file.size} B`;

  const color = nextPopupColor();
  const borderEl = highlightMedia(it, color);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  const popup = document.createElement('div');
  popup.className = 'info-popup';
  popup.style.border = `5px solid ${color}`;
  popup.innerHTML = `
    <div class="popup-name">${escapeHtml(file.name)}</div>
    <div class="popup-size">Size: ${size}</div>
    <div class="popup-path">Path: ${escapeHtml(path)}</div>
  `;
  container.appendChild(popup);

  const containerRect = container.getBoundingClientRect();
  const OFFSET = 2;
  let x = clientX - containerRect.left + OFFSET;
  let y = clientY - containerRect.top + OFFSET;
  const rect = popup.getBoundingClientRect();
  if (x + rect.width > container.clientWidth) x = Math.max(0, container.clientWidth - rect.width);
  if (y + rect.height > container.clientHeight) y = Math.max(0, container.clientHeight - rect.height);

  popup.style.left = x + 'px';
  popup.style.top = y + 'px';
  requestAnimationFrame(() => popup.style.opacity = '1');

  let dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    clearTimeout(fadeTimeout);
    popup.remove();
    if (borderEl) borderEl.remove();
    activePopups.delete(it.id);
  }

  let fadeTimeout = setTimeout(fadeOut, CONFIG.popupFadeout);
  function fadeOut() {
    popup.style.opacity = '0';
    if (borderEl) borderEl.style.opacity = '0';
    fadeTimeout = setTimeout(dismiss, 320);
  }
  popup.addEventListener('click', (e) => { e.stopPropagation(); dismiss(); });
  popup.addEventListener('mouseenter', () => clearTimeout(fadeTimeout));
  popup.addEventListener('mouseleave', () => fadeTimeout = setTimeout(fadeOut, CONFIG.popupFadeout));
  function onRightClick() { fadeOut(); document.removeEventListener('contextmenu', onRightClick); }
  document.addEventListener('contextmenu', onRightClick);
  function onEsc(e) { if (e.key === 'Escape') { fadeOut(); document.removeEventListener('keydown', onEsc); } }
  document.addEventListener('keydown', onEsc);
  activePopups.set(it.id, { popup, borderEl, color, dismiss });
}

/* Hotkey reference popup */
const hotkeyOverlay = document.createElement('div');
hotkeyOverlay.className = 'overlay overlay-hotkey glass';
document.body.appendChild(hotkeyOverlay);

const hotkeyPopup = document.createElement('div');
hotkeyPopup.className = 'hotkey-popup';
document.body.appendChild(hotkeyPopup);

function showHotkeyPopup() {
  hotkeyPopup.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'hotkey-grid';
  hotkeys.forEach(h => {
    const keyEl = document.createElement('div');
    keyEl.className = 'key-label';
    keyEl.textContent = h.keys + ' :';
    const descEl = document.createElement('div');
    descEl.textContent = h.desc;
    grid.appendChild(keyEl);
    grid.appendChild(descEl);
  });
  hotkeyPopup.appendChild(grid);
  hotkeyPopup.style.display = 'block';
  hotkeyOverlay.style.display = 'block';
}

function hideHotkeyPopup() {
  hotkeyPopup.style.display = 'none';
  hotkeyOverlay.style.display = 'none';
}

function toggleHotkeyPopup() {
  if (hotkeyPopup.style.display === 'block') hideHotkeyPopup();
  else showHotkeyPopup();
}

hotkeyIcon.addEventListener('click', toggleHotkeyPopup);
hotkeyOverlay.addEventListener('click', hideHotkeyPopup);
hotkeyPopup.addEventListener('click', hideHotkeyPopup);

/* Resize */
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    recalcColumnWidth();
    for (let ci = 0; ci < columns.length; ci++) {
      const col = columns[ci];
      if (lockedColumns.has(ci)) continue;
      let t = 0;
      for (const it of col.items) {
        if (!it.el) {
          it.height = Math.round(EST_RATIO * columnWidth);
        } else {
          it.height = it.el.getBoundingClientRect().height;
          resizePixelCanvas(it);
        }
        it.top = t;
        t += it.height;
      }
      col.height = t;
    }
    recomputeTotals();
    container.style.transform = `translate3d(0, ${-curY}px, 0)`;
  }, 120);
});

/* Init */
createColumns(numColumns);
assignBatch();
raf = requestAnimationFrame(frame);
updatePrompt();
