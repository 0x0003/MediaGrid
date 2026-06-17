/* Zoom - zoomed media view */

let zoomedMedia = null;
let _zoomExitHandler = null;
let _zoomLevel = 1;
let _panX = 0;
let _panY = 0;
let _zoomClone = null;
let _zoomIsImage = false;
let _zoomWasAutoScrolling = false;

function _applyZoom() {
  if (!_zoomClone) return;
  _zoomClone.style.transform = `translate(${_panX}px, ${_panY}px) scale(${_zoomLevel})`;
}
function zoomPan(dx, dy) {
  _panX += dx; _panY += dy;
  _applyZoom();
}
function _minZoom() {
  if (!_zoomClone) return 0.1;
  const cw = _zoomClone.clientWidth;
  const ch = _zoomClone.clientHeight;
  if (cw === 0 || ch === 0) return 0.1;
  return Math.max(0.01, 250 / Math.min(cw, ch));
}
function _zoomExit(clone, originalEl) {
  if (clone?.tagName === 'VIDEO' && originalEl?.tagName === 'VIDEO') {
    try { originalEl.currentTime = clone.currentTime; } catch (e) { }
  }
  clone?.remove();
  _zoomClone = null;
  if (_zoomWasAutoScrolling) { startAuto(); updateToggleText(); }
  zoomOverlay.style.display = 'none';
  zoomedMedia = null;
  resumeAllGridVideos();
  try { viewport.focus({ preventScroll: true }); } catch (e) { }
  clearTimeout(_zcTimer);
  zoomControls.classList.remove('visible');
  _zoomExitHandler = null;
}
function _setupVideoClone(clone, originalEl) {
  clone.volume = volumeLevel;
  clone.autoplay = true;
  clone.loop = true;
  clone.muted = false;
  clone.controls = true;
  clone.currentTime = originalEl.currentTime || 0;
  playWithMutedFallback(clone);
  let playStateOnMousedown;
  clone.addEventListener('mousedown', () => { playStateOnMousedown = clone.paused; }, { passive: true });
  clone.addEventListener('click', e => {
    e.stopPropagation();
    setTimeout(() => {
      if (clone.paused === playStateOnMousedown) {
        clone.paused ? clone.play() : clone.pause();
      }
    }, 0);
  });
  clone.addEventListener('volumechange', () => {
    volumeInput.value = volumeLevel = clone.volume;
    updateSliderFill(volumeInput);
    for (const it of items) {
      if (it.el && it.el._video) it.el._video.volume = volumeLevel;
    }
  });
}
function _activateZoomClone(clone, item) {
  clone.className = 'zoom-clone';
  _zoomClone = clone;
  _zoomIsImage = item.file.type.startsWith('image/');
  clone.style.cursor = _zoomIsImage ? 'grab' : 'default';
  zoomOverlay.appendChild(clone);
  zoomedMedia = item;
}

let _zcTimer = null;

function _showZoomControls() {
  clearTimeout(_zcTimer);
  zoomControls.classList.add('visible');
  _zcTimer = setTimeout(() => {
    if (!zoomControls.matches(':hover')) {
      zoomControls.classList.remove('visible');
    }
  }, 500);
}

zoomOverlay.addEventListener('pointermove', e => {
  const rect = zoomOverlay.getBoundingClientRect();
  clearTimeout(_zcTimer);
  const x = e.clientX - rect.left;
  if (x < 170 && e.clientY - rect.top > rect.height - 120) {
    zoomControls.classList.add('visible');
  } else {
    _zcTimer = setTimeout(() => zoomControls.classList.remove('visible'), 500);
  }
});
zoomOverlay.addEventListener('mouseleave', () => {
  clearTimeout(_zcTimer);
  zoomControls.classList.remove('visible');
});
zoomControls.addEventListener('mouseenter', () => {
  clearTimeout(_zcTimer);
  zoomControls.classList.add('visible');
});
zoomControls.addEventListener('mouseleave', () => {
  _zcTimer = setTimeout(() => {
    zoomControls.classList.remove('visible');
  }, 500);
});

zoomControls.querySelector('.zc-w').addEventListener('click', e => { e.stopPropagation(); if (zoomedMedia) _traverseZoom(-numColumns); });
zoomControls.querySelector('.zc-a').addEventListener('click', e => { e.stopPropagation(); if (zoomedMedia) _traverseZoom(-1); });
zoomControls.querySelector('.zc-s').addEventListener('click', e => { e.stopPropagation(); if (zoomedMedia) _traverseZoom(numColumns); });
zoomControls.querySelector('.zc-d').addEventListener('click', e => { e.stopPropagation(); if (zoomedMedia) _traverseZoom(1); });

zoomOverlay.addEventListener('wheel', e => {
  if (!zoomedMedia) return;
  e.preventDefault();
  if (_zoomIsImage) {
    const old = _zoomLevel;
    _zoomLevel = Math.max(_minZoom(), Math.min(10, _zoomLevel + (e.deltaY > 0 ? -CONFIG.zoomStep : CONFIG.zoomStep)));
    const rect = zoomOverlay.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    _panX = cx - (cx - _panX) * (_zoomLevel / old);
    _panY = cy - (cy - _panY) * (_zoomLevel / old);
    _applyZoom();
  } else {
    const step = +volumeInput.step;
    volumeInput.value = Math.max(0, Math.min(1, +volumeInput.value + (e.deltaY > 0 ? -step : step)));
    volumeInput.dispatchEvent(new Event('input'));
  }
}, { passive: false });

zoomOverlay.addEventListener('mousedown', e => {
  if (!zoomedMedia) return;
  if (e.button !== 0 && e.button !== 1) return;
  if (e.button === 1 && !_zoomIsImage) return;

  // Background click → exit on mouseup
  if (e.target === zoomOverlay) {
    e.preventDefault();
    function onUp() {
      document.removeEventListener('mouseup', onUp);
      _zoomExitHandler && _zoomExitHandler();
    }
    document.addEventListener('mouseup', onUp);
    return;
  }

  // Image drag/click
  if (_zoomIsImage) {
    e.preventDefault();
    _zoomClone.style.cursor = 'grabbing';
    const sx = e.clientX, sy = e.clientY;
    const spx = _panX, spy = _panY;
    let dragged = false;
    function onMove(e) {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (dx * dx + dy * dy > 25) dragged = true;
      _panX = spx + dx;
      _panY = spy + dy;
      _applyZoom();
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      _zoomClone.style.cursor = 'grab';
      if (!dragged) _zoomExitHandler && _zoomExitHandler();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }
});

document.addEventListener('keydown', e => {
  if (!zoomedMedia) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); _zoomExitHandler(); return; }
  if (e.ctrlKey) {
    if (!_zoomIsImage) { e.stopImmediatePropagation(); return; }
    switch (e.key) {
      case '=': _zoomLevel = Math.max(_minZoom(), Math.min(10, _zoomLevel + CONFIG.zoomStep)); _applyZoom(); break;
      case '-': _zoomLevel = Math.max(_minZoom(), Math.min(10, _zoomLevel - CONFIG.zoomStep)); _applyZoom(); break;
      case '0': _zoomLevel = 1; _panX = 0; _panY = 0; _applyZoom(); break;
      default: e.stopImmediatePropagation(); return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  if (e.altKey || e.metaKey) { e.stopImmediatePropagation(); return; }
  let handled = false;
  if (_zoomIsImage) {
    handled = true;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.shiftKey) {
      const dir = { 'ArrowUp': 1, 'k': 1, 'ArrowDown': -1, 'j': -1 }[e.key.toLowerCase()];
      if (dir) { _zoomLevel = Math.max(_minZoom(), Math.min(10, _zoomLevel + dir * CONFIG.zoomStep)); _applyZoom(); }
    } else {
      const step = 80 / _zoomLevel;
      switch (e.key) {
        case 'w': _traverseZoom(-numColumns); break;
        case 's': _traverseZoom(numColumns);  break;
        case 'a': _traverseZoom(-1);          break;
        case 'd': _traverseZoom(1);           break;
        case 'k': case 'ArrowUp':    zoomPan(0, step);   break;
        case 'j': case 'ArrowDown':  zoomPan(0, -step);  break;
        case 'h': case 'ArrowLeft':  zoomPan(step, 0);   break;
        case 'l': case 'ArrowRight': zoomPan(-step, 0);  break;
        default: _zoomExitHandler();
      }
    }
  } else {
    if (e.shiftKey) { e.stopImmediatePropagation(); return; }
    const step = +volumeInput.step;
    switch (e.key) {
      case ' ':
        handled = true;
        if (_zoomClone.paused) _zoomClone.play(); else _zoomClone.pause();
        break;
      case 'w': _traverseZoom(-numColumns); handled = true; break;
      case 's': _traverseZoom(numColumns);  handled = true; break;
      case 'a': _traverseZoom(-1);          handled = true; break;
      case 'd': _traverseZoom(1);           handled = true; break;
      case 'k': case 'ArrowUp':
        handled = true;
        volumeInput.value = Math.min(1, +volumeInput.value + step);
        volumeInput.dispatchEvent(new Event('input'));
        break;
      case 'j': case 'ArrowDown':
        handled = true;
        volumeInput.value = Math.max(0, +volumeInput.value - step);
        volumeInput.dispatchEvent(new Event('input'));
        break;
      case 'h': case 'ArrowLeft':
        handled = true;
        _zoomClone.currentTime = Math.max(0, _zoomClone.currentTime - 5);
        break;
      case 'l': case 'ArrowRight':
        handled = true;
        _zoomClone.currentTime = Math.min(_zoomClone.duration || Infinity, _zoomClone.currentTime + 5);
        break;
    }
    if (handled) { e.preventDefault(); e.stopImmediatePropagation(); }
  }
});

function _createZoomClone(item, url, originalEl) {
  if (item.file.type.startsWith('image/')) {
    const clone = document.createElement('img');
    clone.src = url;
    return clone;
  }
  if (item.file.type.startsWith('video/')) {
    const clone = document.createElement('video');
    clone.src = url;
    _setupVideoClone(clone, originalEl);
    return clone;
  }
  return null;
}

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
    playObserver.unobserve(v);
  });
  pauseAllGridVideos();

  _zoomWasAutoScrolling = !!autoTicker;
  if (_zoomWasAutoScrolling) { stopAuto(); updateToggleText(); }

  zoomOverlay.innerHTML = '';
  zoomOverlay.style.display = 'flex';

  const originalEl = it.el?.querySelector('.media');
  if (!originalEl) { _zoomExit(null, null); return; }

  const url = createObjectURLFor(it);
  const clone = _createZoomClone(it, url, originalEl);
  if (!clone) { _zoomExit(null, null); return; }

  _activateZoomClone(clone, it);
  _zoomExitHandler = () => _zoomExit(clone, originalEl);
  _showZoomControls();
}

function _traverseZoom(delta) {
  if (!zoomedMedia || !_zoomExitHandler) return;

  const curIdx = items.indexOf(zoomedMedia);
  if (curIdx === -1) return;
  const newIdx = curIdx + delta;
  if (newIdx < 0 || newIdx >= items.length) return;
  const newItem = items[newIdx];
  if (!newItem) return;

  // Force materialize the new item if needed
  if (!newItem.el) {
    const col = columns[newItem.col];
    const idxInCol = col.items.indexOf(newItem);
    const wrap = document.createElement('div');
    wrap.className = 'item';
    wrap.style.left = (newItem.col * 100 / numColumns) + '%';
    wrap.style.width = (100 / numColumns) + '%';
    wrap.style.top = newItem.top + 'px';
    wrap.style.height = newItem.height + 'px';
    wrap.dataset.id = newItem.id;
    const ph = document.createElement('div');
    ph.className = 'placeholder';
    ph.textContent = newItem.file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
    wrap.appendChild(ph);
    container.appendChild(wrap);
    newItem.el = wrap;
    mountMediaInto(wrap, newItem, idxInCol);

    // Silence newly materialized video during zoom
    const nv = wrap.querySelector('video');
    if (nv) {
      playObserver.unobserve(nv);
      nv.pause();
      nv.addEventListener('loadedmetadata', function gm() {
        if (zoomedMedia) { playObserver.unobserve(nv); nv.pause(); }
        nv.removeEventListener('loadedmetadata', gm);
      }, { once: true });
    }
  }

  // Only scroll if the visible fraction is below obsThreshold
  const thr = CONFIG.obsThreshold;
  const itemTop = newItem.top;
  const itemBottom = newItem.top + newItem.height;
  const visibleTop = Math.max(itemTop, curY);
  const visibleBottom = Math.min(itemBottom, curY + viewport.clientHeight);
  const visible = Math.max(0, visibleBottom - visibleTop) / newItem.height >= thr;
  if (!visible) {
    targetY = itemTop + newItem.height / 2 - viewport.clientHeight / 2;
    clampTarget();
  }

  const originalEl = newItem.el?.querySelector('.media');
  if (!originalEl) return;

  zoomOverlay.innerHTML = '';
  _zoomClone = null;
  _zoomLevel = 1;
  _panX = 0;
  _panY = 0;

  const url = createObjectURLFor(newItem);
  const clone = _createZoomClone(newItem, url, originalEl);
  if (!clone) { _zoomExitHandler(); return; }

  _activateZoomClone(clone, newItem);
  _zoomExitHandler = () => _zoomExit(clone, originalEl);
  _showZoomControls();
}