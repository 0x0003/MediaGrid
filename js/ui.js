/* File picker */
fileButton.addEventListener('click', () => fileInput.click());

/* Theme */
{
  let isLight;
  if (CONFIG.theme === 'light') {
    isLight = true;
  } else if (CONFIG.theme === 'dark') {
    isLight = false;
  } else {
    isLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  }
  document.documentElement.classList.toggle('light', isLight);
  if (themeToggle) themeToggle.textContent = isLight ? '\u2600' : '\u263E';
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const on = document.documentElement.classList.toggle('light');
    themeToggle.textContent = on ? '\u2600' : '\u263E';
    updateSliderFill(speedInput);
    updateSliderFill(volumeInput);
  });
}

/* Header visibility */
function updateHeaderVisibilityFromPointer(clientY, clientX) {
  if (loadPanel.classList.contains('visible')) return;
  const rect = topTrigger.getBoundingClientRect();
  const inTrigger = clientY >= rect.top && clientY <= rect.bottom;
  if (inTrigger) {
    header.classList.add('visible');
  } else {
    header.classList.remove('visible');
    const focused = header.querySelector(':focus');
    if (focused) focused.blur();
    if (viewport) viewport.focus();
  }
}

let lastX = -1, lastY = -1;
document.addEventListener('pointermove', (e) => {
  lastX = e.clientX; lastY = e.clientY;
  if (typeof e.clientY === 'number') updateHeaderVisibilityFromPointer(e.clientY, e.clientX);
});
document.addEventListener('pointerleave', () => { if (!loadPanel.classList.contains('visible')) header.classList.remove('visible'); });
topTrigger.addEventListener('pointerdown', (e) => updateHeaderVisibilityFromPointer(e.clientY, e.clientX), { passive: true });

/* Load panel toggle */
function toggleLoadPanel(show) {
  if (show === undefined) show = !loadPanel.classList.contains('visible');
  loadPanel.classList.toggle('visible', show);
  header.classList.toggle('visible', show);
}
loadPanelToggle.addEventListener('click', () => toggleLoadPanel());
document.getElementById('loadPanelClose').addEventListener('click', () => toggleLoadPanel(false));
toggleLoadPanel(CONFIG.loadPanelVisible ?? true);

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
toggleAutoBtn.addEventListener('click', () => {
  if (autoTicker) stopAuto();
  else startAuto();
  updateToggleText();
});
function updateToggleText() {
  if (!toggleAutoBtn) return;
  toggleAutoBtn.textContent = autoTicker ? 'Pause' : 'Resume';
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

  const block = Math.max(8, Math.floor(Math.min(w, h) / 55));
  const sw = Math.ceil(w / block), sh = Math.ceil(h / block);

  const temp = document.createElement('canvas');
  temp.width = sw; temp.height = sh;
  temp.getContext('2d').drawImage(img, 0, 0, sw, sh);

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(temp, 0, 0, sw, sh, 0, 0, w, h);
  ctx.imageSmoothingEnabled = true;

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
  const block = Math.max(8, Math.floor(Math.min(w, h) / 12));
  const sw = Math.ceil(w / block), sh = Math.ceil(h / block);
  const temp = document.createElement('canvas');
  temp.width = sw; temp.height = sh;
  temp.getContext('2d').drawImage(img, 0, 0, sw, sh);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(temp, 0, 0, sw, sh, 0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
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

Object.assign(zoomOverlay.style, {
  position: 'fixed',
  inset: '0',
  display: 'none',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9000,
  cursor: 'zoom-out',
  background: 'rgba(18,18,18,0.85)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
});
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
  function zoomURL(it) {
    return it.objectURL || URL.createObjectURL(it.file);
  }
  if (it.file.type.startsWith('image/')) {
    clone = document.createElement('img');
    const url = zoomURL(it);
    clone.src = url;
  } else if (it.file.type.startsWith('video/')) {
    clone = document.createElement('video');
    const url = zoomURL(it);
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

  Object.assign(clone.style, {
    maxWidth: '100vw',
    maxHeight: '100vh',
    width: 'auto',
    height: 'auto',
    objectFit: 'contain',
    display: 'block',
  });

  zoomOverlay.appendChild(clone);
  zoomedMedia = it;

  if (clone.tagName === 'VIDEO') {
    clone.play().catch(async () => {
      try {
        clone.muted = true;
        await clone.play();
        clone.muted = false;
      } catch (e) { }
    });
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
    Object.assign(borderEl.style, {
      position: 'absolute',
      inset: '0',
      border: `5px solid ${color}`,
      pointerEvents: 'none',
      boxSizing: 'border-box',
      opacity: '0.85',
      transition: 'opacity 0.28s ease',
    });
    wrap.appendChild(borderEl);
  } else {
    borderEl.style.borderColor = color;
    borderEl.style.opacity = '0.5';
  }
  return borderEl;
}

let activePopups = new Map();

function showInfoPopup(it, clientX, clientY) {
  const existing = activePopups.get(it.id);
  if (existing) {
    existing.popup.remove();
    if (existing.borderEl) existing.borderEl.remove();
    activePopups.delete(it.id);
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
  Object.assign(popup.style, {
    position: 'absolute',
    background: 'rgba(18,18,18,0.85)',
    color: '#e8e3e3',
    padding: '8px 12px',
    pointerEvents: 'auto',
    whiteSpace: 'nowrap',
    transition: 'opacity 0.3s',
    opacity: '0',
    zIndex: 5000,
    border: `5px solid ${color}`,
    boxSizing: 'border-box',
  });
  popup.innerHTML = `
    <div style="font-weight:600; margin-bottom:6px;">${escapeHtml(file.name)}</div>
    <div style="font-size:14px; opacity:.9; margin-bottom:4px;">Size: ${size}</div>
    <div style="font-size:13px; opacity:.8;">Path: ${escapeHtml(path)}</div>
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

  let fadeTimeout = setTimeout(() => fadeOut(), 3000);
  function fadeOut() {
    popup.style.opacity = '0';
    if (borderEl) borderEl.style.opacity = '0';
    setTimeout(() => {
      popup.remove();
      if (borderEl) borderEl.remove();
      activePopups.delete(it.id);
    }, 320);
  }
  popup.addEventListener('mouseenter', () => clearTimeout(fadeTimeout));
  popup.addEventListener('mouseleave', () => fadeTimeout = setTimeout(fadeOut, 3000));
  function onRightClick() { fadeOut(); document.removeEventListener('contextmenu', onRightClick); }
  document.addEventListener('contextmenu', onRightClick);
  function onEsc(e) { if (e.key === 'Escape') { fadeOut(); document.removeEventListener('keydown', onEsc); } }
  document.addEventListener('keydown', onEsc);
  activePopups.set(it.id, { popup, borderEl, color });
}

/* Hotkey reference popup */
const hotkeyOverlay = document.createElement('div');
Object.assign(hotkeyOverlay.style, {
  position: 'fixed',
  top: '0',
  left: '0',
  width: '100vw',
  height: '100vh',
  background: 'rgba(18,18,18,0.7)',
  backdropFilter: 'blur(6px)',
  zIndex: 9999,
  display: 'none',
});
document.body.appendChild(hotkeyOverlay);

const hotkeyPopup = document.createElement('div');
Object.assign(hotkeyPopup.style, {
  position: 'fixed',
  background: 'rgba(18,18,18,0)',
  color: '#e8e3e3',
  padding: '16px 24px',
  maxHeight: '70vh',
  overflowY: 'auto',
  fontSize: '22px',
  lineHeight: '1.5',
  whiteSpace: 'pre',
  display: 'none',
  zIndex: 10000,
  transform: 'translate(-50%, -50%)',
  top: '50%',
  left: '50%',
});
document.body.appendChild(hotkeyPopup);

function showHotkeyPopup() {
  hotkeyPopup.innerHTML = '';
  const grid = document.createElement('div');
  Object.assign(grid.style, {
    display: 'grid',
    gridTemplateColumns: 'max-content 1fr',
    columnGap: '24px',
    rowGap: '16px',
    whiteSpace: 'normal',
  });
  hotkeys.forEach(h => {
    const keyEl = document.createElement('div');
    keyEl.textContent = h.keys + ' :';
    keyEl.style.fontWeight = '600';
    keyEl.style.textAlign = 'right';
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
    columnWidth = Math.max(80, Math.floor(viewport.clientWidth / numColumns));
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
(function init() {
  createColumns(numColumns);
  assignBatch(ASSIGN_BATCH);
  raf = requestAnimationFrame(frame);
  updatePrompt();
})();
