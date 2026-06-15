/* multi-directory buffer */
let pendingDirectories = []; // { name, files, loaded }

function getDirName(files) {
  const rel = files[0]?.webkitRelativePath || '';
  return rel.split('/')[0] || 'Folder';
}

function removeDirAt(index) {
  pendingDirectories.splice(index, 1);
  updateDirList();
}

function updateDirList() {
  if (!dirList) return;
  const hasUnloaded = pendingDirectories.some(d => !d.loaded);
  const hasPendingRemoval = pendingDirectories.some(d => d._pendingRemove);
  dirList.replaceChildren();
  pendingDirectories.forEach((d, i) => {
    const el = document.createElement('div');
    el.textContent = `${i + 1}. ${d.name}`;
    if (d.loaded && d._pendingRemove) {
      el.classList.add('pending-remove');
      el.addEventListener('click', () => { delete d._pendingRemove; updateDirList(); });
    } else if (d.loaded) {
      el.classList.add('loaded-dir', 'clickable');
      el.addEventListener('click', () => { d._pendingRemove = true; updateDirList(); });
    } else {
      el.classList.add('clickable');
      el.addEventListener('click', () => removeDirAt(i));
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); removeDirAt(i); });
    }
    dirList.appendChild(el);
  });
  if (loadBtn) loadBtn.disabled = !(hasUnloaded || hasPendingRemoval);
}

fileInput.addEventListener('change', (e) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  const filesArray = Array.from(files);
  pendingDirectories.push({ name: getDirName(filesArray), files: filesArray, loaded: false });
  fileInput.value = '';
  updateDirList();
  updatePrompt();
});

ignoreSubdirsCheckbox.addEventListener('change', () => {
  for (const d of pendingDirectories) {
    if (d.loaded) {
      const removeSet = new Set(d.files);
      allFiles = allFiles.filter(f => !removeSet.has(f));
      baseOrder = baseOrder.filter(f => !removeSet.has(f));
      d.loaded = false;
    }
  }
  updateDirList();
});

loadBtn.addEventListener('click', () => {
  const toRemove = pendingDirectories.filter(d => d._pendingRemove);
  const toAdd = pendingDirectories.filter(d => !d.loaded);
  if (toRemove.length === 0 && toAdd.length === 0) return;

  for (const dir of toAdd) {
    dir.files.sort((a, b) => {
      const ap = a.webkitRelativePath || a.relativePath || a.name || '';
      const bp = b.webkitRelativePath || b.relativePath || b.name || '';
      return ap < bp ? -1 : ap > bp ? 1 : 0;
    });
  }

  for (const dir of toRemove) {
    const removeSet = new Set(dir.files);
    allFiles = allFiles.filter(f => !removeSet.has(f));
    baseOrder = baseOrder.filter(f => !removeSet.has(f));
    const idx = pendingDirectories.indexOf(dir);
    if (idx !== -1) pendingDirectories.splice(idx, 1);
  }

  for (const dir of toAdd) {
    const regexValue = regexInput.value.trim() || null;
    const re = regexValue ? new RegExp(regexValue, 'i') : null;
    const ignoreSubdirs = !!(ignoreSubdirsCheckbox && ignoreSubdirsCheckbox.checked);

    for (const f of dir.files) {
      if (!f || !f.type || !(f.type.startsWith('image/') || f.type.startsWith('video/'))) continue;
      const rel = f.webkitRelativePath || f.relativePath || f.name || '';
      const depth = rel.split('/').filter(Boolean).length;
      if (ignoreSubdirs && depth > 2) continue;
      if (re && !re.test(f.name)) continue;
      f._estRatio = EST_RATIO;
      allFiles.push(f);
      baseOrder.push(f);
    }
    dir.loaded = true;
  }

  updateDirList();
  toggleLoadPanel(false);

  if (shuffleToggle && shuffleToggle.checked) shuffle(allFiles);
  applyFilterAndRebuild();
  updatePrompt();
  if (raf === null) raf = requestAnimationFrame(frame);
});

regexInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { regexInput.blur(); return; }
  if (e.key === 'Enter') {
    e.preventDefault();
    applyFilterAndRebuild();
  }
});

function updateMediaStatus() {
  if (!mediaStatusEl) return;
  if (!filesFiltered || filesFiltered.length === 0) {
    mediaStatusEl.textContent = '';
    return;
  }
  let img = 0, vid = 0;
  for (const f of filesFiltered) {
    if (f.type.startsWith('image/')) img++;
    else vid++;
  }
  mediaStatusEl.textContent = `${filesFiltered.length} files (${img} img · ${vid} vid)`;
}

/* drag and drop zone */
const dropOverlay = document.getElementById('dropOverlay');

function traverseEntry(entry, path) {
  return new Promise(resolve => {
    if (entry.isFile) {
      entry.file(file => {
        try { Object.defineProperty(file, 'webkitRelativePath', { value: path + file.name }); } catch (e) {}
        resolve(file);
      }, () => resolve(null));
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const promises = [];
      function readBatch() {
        reader.readEntries(entries => {
          if (entries.length === 0) {
            Promise.all(promises).then(nested => resolve(nested.filter(Boolean).flat()));
          } else {
            promises.push(...entries.map(e => traverseEntry(e, path + entry.name + '/')));
            readBatch();
          }
        }, () => resolve([]));
      }
      readBatch();
    } else {
      resolve([]);
    }
  });
}

let dragCounter = 0;

window.addEventListener('dragenter', e => {
  dragCounter++;
  if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
    dropOverlay.classList.add('visible');
    toggleLoadPanel(true);
  }
});

window.addEventListener('dragover', e => e.preventDefault());

window.addEventListener('dragleave', () => {
  dragCounter--;
  if (dragCounter <= 0) { dragCounter = 0; dropOverlay.classList.remove('visible'); }
});

/* Traverse a modern FileSystemDirectoryHandle (persists beyond event handler) */
async function traverseFileSystemHandle(handle, path) {
  const result = [];
  for await (const [name, child] of handle.entries()) {
    if (child.kind === 'file') {
      try {
        const file = await child.getFile();
        try { Object.defineProperty(file, 'webkitRelativePath', { value: path + name }); } catch (e) {}
        result.push(file);
      } catch (e) {}
    } else if (child.kind === 'directory') {
      const children = await traverseFileSystemHandle(child, path + name + '/');
      result.push(...children);
    }
  }
  return result;
}

window.addEventListener('drop', async e => {
  e.preventDefault();
  dropOverlay.classList.remove('visible');
  dragCounter = 0;

  const items = e.dataTransfer.items;
  if (!items || items.length === 0) return;

  const allFiles = [];
  for (const item of items) {
    if (item.kind !== 'file') continue;

    /* Prefer modern FileSystemHandle API — handles survive async boundaries */
    if (item.getAsFileSystemHandle) {
      try {
        const handle = await item.getAsFileSystemHandle();
        if (!handle || handle.kind !== 'directory') continue;
        const files = await traverseFileSystemHandle(handle, handle.name + '/');
        allFiles.push(...files);
        continue;
      } catch (e) {}
    }

    /* Fallback: legacy webkitGetAsEntry */
    const getAsEntry = item.getAsEntry || item.webkitGetAsEntry;
    const entry = getAsEntry ? getAsEntry.call(item) : null;
    if (!entry || entry.isFile) continue;
    const files = await traverseEntry(entry, '');
    allFiles.push(...files);
  }

  if (allFiles.length === 0) return;

  const dirName = allFiles[0]?.webkitRelativePath?.split('/')[0] || 'Folder';
  pendingDirectories.push({ name: dirName, files: allFiles, loaded: false });
  updateDirList();
  updatePrompt();
  toggleLoadPanel(true);
});

function applyFilterAndRebuild() {
  const mode = filterSelect.value;
  const regexValue = regexInput.value.trim();
  let regex = null;
  if (regexValue) {
    try { regex = new RegExp(regexValue, 'i'); } catch (err) { console.warn('Invalid regex:', err); regex = null; }
  }
  filesFiltered = allFiles.filter(f => {
    if (mode === 'images' && !f.type.startsWith('image/')) return false;
    if (mode === 'videos' && !f.type.startsWith('video/')) return false;
    if (regex && !regex.test(f.name)) return false;
    return true;
  });
  createColumns(numColumns);
  assignBatch(ASSIGN_BATCH);
  targetY = curY = 0;
  updateMediaStatus();
}
