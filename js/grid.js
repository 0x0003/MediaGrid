/* constants */
const ASSIGN_BATCH = CONFIG.assignBatch ?? 48;
const PRELOAD_SCREENS = CONFIG.preloadScreens ?? 4;
const EST_RATIO = CONFIG.estRatio ?? 0.75;
const OBS_THRESHOLD = CONFIG.obsThreshold ?? 0.45;
const EASE = CONFIG.ease ?? 0.12;

/* grid state */
let allFiles = [];
let baseOrder = [];
let filesFiltered = [];
let pendingIndex = 0;
let numColumns = parseInt(columnsSelect.value, 10) || 4;
let columnWidth = 0;
let columns = []; // per-column {height, items}
let items = [];   // flattened list of items
let totalHeight = 0;
let targetY = 0, curY = 0;
let raf = null;
let autoTicker = null;
let volumeLevel = parseFloat(volumeInput.value) || 0.1;
const blurredColumns = new Set();
const lockedColumns = new Map();

/* IntersectionObserver to play/pause visible videos */
const playObserver = new IntersectionObserver(entries => {
  for (const e of entries) {
    const v = e.target;
    if (e.intersectionRatio >= OBS_THRESHOLD) {
      v.play().catch(async () => {
        try { v.muted = true; await v.play(); v.muted = false; } catch (_) { }
      });
    } else {
      v.pause();
    }
  }
}, { threshold: [OBS_THRESHOLD] });

/* show/hide prompt depending on files loaded */
function updatePrompt() {
  if (!emptyPrompt) return;
  const isEmpty = allFiles.length === 0;
  emptyPrompt.style.display = isEmpty ? 'flex' : 'none';
  emptyPrompt.setAttribute('aria-hidden', String(!isEmpty));
}

function clampTarget() {
  if (totalHeight <= 0) { targetY = 0; return; }
  if (Math.abs(targetY) > 1e9) targetY = ((targetY % totalHeight) + totalHeight) % totalHeight;
}

/* objectURL reference helpers - share one URL per File across all items */
const fileURLMap = new Map();
function createObjectURLFor(it) {
  if (it.objectURL) return it.objectURL;
  const entry = fileURLMap.get(it.file);
  if (entry) {
    entry.refCount++;
    it.objectURL = entry.url;
    return entry.url;
  }
  const url = URL.createObjectURL(it.file);
  fileURLMap.set(it.file, { url, refCount: 1 });
  it.objectURL = url;
  return url;
}
function releaseItemURL(it) {
  if (!it.objectURL) return;
  const entry = fileURLMap.get(it.file);
  if (!entry) { it.objectURL = null; return; }
  entry.refCount--;
  if (entry.refCount <= 0) {
    fileURLMap.delete(it.file);
    try { URL.revokeObjectURL(entry.url); } catch (e) { }
  }
  it.objectURL = null;
}

/* columns & assignment */
function createColumns(n) {
  numColumns = n;
  columnWidth = Math.max(80, Math.floor(viewport.clientWidth / numColumns));
  columns = [];
  for (let i = 0; i < n; i++) columns.push({ height: 0, items: [] });
  items = [];
  pendingIndex = 0;
  totalHeight = 0;
  container.replaceChildren();
  for (const { url } of fileURLMap.values()) { try { URL.revokeObjectURL(url); } catch (e) { } }
  fileURLMap.clear();
}

function recomputeTotals() {
  totalHeight = 0;
  for (const c of columns) if (c.height > totalHeight) totalHeight = c.height;
  container.style.height = totalHeight + 'px';
}

function assignBatch(count = ASSIGN_BATCH) {
  if (!filesFiltered.length) return;
  for (let k = 0; k < count; k++) {
    if (pendingIndex >= filesFiltered.length) {
      pendingIndex = 0;
    }
    const j = pendingIndex % columns.length;
    const file = filesFiltered[pendingIndex++];
    const estH = Math.max(24, Math.round((file._estRatio || EST_RATIO) * columnWidth));
    const it = {
      id: items.length,
      file,
      fileIndex: pendingIndex - 1,
      col: j,
      top: columns[j].height,
      height: estH,
      el: null,
      objectURL: null,
    };
    columns[j].items.push(it);
    columns[j].height += it.height;
    items.push(it);
  }
  recomputeTotals();
}

function adjustColumnAfter(colIndex, itemIndexInCol, delta) {
  if (delta === 0) return;
  const col = columns[colIndex];
  for (let i = itemIndexInCol + 1; i < col.items.length; i++) {
    const it = col.items[i];
    it.top += delta;
    if (it.el) it.el.style.top = it.top + 'px';
  }
  col.height += delta;
  recomputeTotals();
}

/* mount media */
function mountMediaInto(wrap, it, idxInCol) {
  const url = createObjectURLFor(it);
  if (it.file.type.startsWith('image/')) {
    const img = document.createElement('img');
    img.className = 'media';
    img.loading = 'eager';
    img.decoding = 'async';
    img.src = url;
    img.addEventListener('load', function onload() {
      img.removeEventListener('load', onload);
      img.classList.add('loaded');
      const realH = Math.round((this.naturalHeight / this.naturalWidth) * wrap.clientWidth);
      const delta = realH - it.height;
      if (Math.abs(delta) > 4) {
        it.height = realH;
        wrap.style.height = realH + 'px';
        adjustColumnAfter(it.col, idxInCol, delta);
      }
      if (blurredColumns.has(it.col)) pixelateImage(it);
    }, { once: true });
    wrap.appendChild(img);
    wrap._img = img;
    return img;
  } else {
    const vid = document.createElement('video');
    vid.className = 'media';
    vid.loop = true;
    vid.autoplay = true;
    vid.muted = false;
    vid.playsInline = true;
    vid.volume = volumeLevel;
    vid.src = url;
    vid.addEventListener('loadedmetadata', function onlm() {
      vid.classList.add('loaded');
      const realH = Math.round((vid.videoHeight / vid.videoWidth) * wrap.clientWidth);
      const delta = realH - it.height;
      if (Math.abs(delta) > 4) {
        it.height = realH;
        wrap.style.height = realH + 'px';
        adjustColumnAfter(it.col, idxInCol, delta);
      }
      try { playObserver.observe(vid); } catch (e) { }
    }, { once: true });
    vid.addEventListener('error', function onerr() {
      vid.classList.remove('loaded');
    });
    wrap.appendChild(vid);
    wrap._video = vid;
    if (blurredColumns.has(it.col)) wrap.classList.add('blurred');
    return vid;
  }
}

function materialize() {
  const viewH = viewport.clientHeight;
  const boundsTop = curY - viewH * 0.5;
  const boundsBottom = curY + viewH + viewH * PRELOAD_SCREENS;

  for (let ci = 0; ci < columns.length; ci++) {
    const col = columns[ci];
    const colLocked = lockedColumns.has(ci);

    for (let idx = 0; idx < col.items.length; idx++) {
      const it = col.items[idx];
      const itemTop = it.top;

      const shouldExist = colLocked || (itemTop + it.height >= boundsTop && itemTop <= boundsBottom);

      if (shouldExist && !it.el) {
        const wrap = document.createElement('div');
        wrap.className = 'item';
        wrap.style.left = (it.col * 100 / numColumns) + '%';
        wrap.style.width = (100 / numColumns) + '%';
        wrap.style.top = itemTop + 'px';
        wrap.style.height = it.height + 'px';
        wrap.dataset.id = it.id;
        const ph = document.createElement('div');
        ph.className = 'placeholder';
        ph.textContent = it.file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
        wrap.appendChild(ph);
        container.appendChild(wrap);
        it.el = wrap;
        mountMediaInto(wrap, it, idx);
      }

      if (!shouldExist && it.el && !colLocked) {
        unpixelateImage(it);
        const wrap = it.el;
        if (wrap._video) {
          try { playObserver.unobserve(wrap._video); } catch (e) { }
          try { wrap._video.pause(); } catch (e) { }
          try { wrap._video.removeAttribute('src'); } catch (e) { }
          wrap._video = null;
        } else {
          const img = wrap._img;
          if (img) try { img.removeAttribute('src'); } catch (e) { }
        }
        releaseItemURL(it);
        try { wrap.remove(); } catch (e) { }
        it.el = null;
      }

      if (!colLocked && !it.el && itemTop > boundsBottom) break;
    }
  }
}

function ensureAssigned() {
  if (!columns.length) return;
  let shortest = columns[0].height;
  for (let i = 1; i < columns.length; i++) if (columns[i].height < shortest) shortest = columns[i].height;
  const viewBottom = curY + viewport.clientHeight;
  if (shortest < viewBottom + viewport.clientHeight * PRELOAD_SCREENS) {
    assignBatch(ASSIGN_BATCH);
  }
}

/* main frame loop */
function frame() {
  if (columns.length === 0) {
    raf = requestAnimationFrame(frame);
    return;
  }

  const allLocked = lockedColumns.size === columns.length;
  if (allLocked) {
    raf = requestAnimationFrame(frame);
    return;
  }

  curY += (targetY - curY) * EASE;
  if (Math.abs(targetY - curY) < 0.5) curY = targetY;

  if (totalHeight > 0 && curY < 0) { curY = 0; targetY = 0; }

  const curYr = Math.round(curY);
  container.style.transform = `translate3d(0, ${-curYr}px, 0)`;

  const children = container.children;
  if (lockedColumns.size === 0) {
    for (let i = 0; i < children.length; i++) {
      const node = children[i];
      if (node.style.transform) node.style.transform = '';
    }
    materialize();
    ensureAssigned();
    raf = requestAnimationFrame(frame);
    return;
  }

  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    const nodeId = +node.dataset.id;
    if (!Number.isFinite(nodeId)) continue;
    const nodeIt = items[nodeId];
    if (!nodeIt) continue;

    const col = nodeIt.col;
    if (lockedColumns.has(col)) {
      const lockBase = lockedColumns.get(col);
      const delta = curYr - lockBase;
      node.style.transform = `translate3d(0, ${delta}px, 0)`;
      node.classList.add('locked');
    } else {
      if (node.style.transform) node.style.transform = '';
      node.classList.remove('locked');
    }
  }

  materialize();
  ensureAssigned();

  raf = requestAnimationFrame(frame);
}

/* auto-scroll controls */
function startAuto() {
  if (autoTicker) return;
  autoTicker = setInterval(() => { targetY += Number(speedInput.value); clampTarget(); }, 16);
  if (raf === null) raf = requestAnimationFrame(frame);
}
function stopAuto() {
  if (autoTicker) { clearInterval(autoTicker); autoTicker = null; }
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

function reshuffleFiles() {
  if (allFiles.length === 0) return;
  if (shuffleToggle.checked) shuffle(allFiles);
  else if (baseOrder.length) { allFiles.length = 0; allFiles.push(...baseOrder); }
  applyFilterAndRebuild();
}
