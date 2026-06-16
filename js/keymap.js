const hotkeys = [];
const _hotkeyHandlers = [];
function onHotkey(keys, desc, ...rest) {
  if (keys) hotkeys.push({ keys, desc });
  if (rest.length === 2) {
    _hotkeyHandlers.push({ match: rest[0], handle: rest[1] });
  } else if (rest.length === 3) {
    rest[0].addEventListener(rest[1], rest[2]);
  }
}

/* UI toggles */
onHotkey('z / ?', 'Toggle this popup',
  e => e.key.toLowerCase() === 'z' || e.key === '?',
  e => { e.preventDefault(); toggleHotkeyPopup(); }
);

onHotkey('f / o', 'Toggle main menu',
  e => e.key.toLowerCase() === 'f' || e.key === 'o',
  e => { e.preventDefault(); togglePanel(); }
);

// null keys = hidden from popup (Escape is universal, no need to list it)
onHotkey(null, 'Close files card',
  e => e.key === 'Escape' && panel.classList.contains('visible') && !zoomedMedia && hotkeyPopup.style.display !== 'block',
  e => { e.preventDefault(); togglePanel(false); }
);

onHotkey(null, 'Close zoom / hotkey popup',
  e => e.key === 'Escape' && (zoomedMedia || hotkeyPopup.style.display === 'block'),
  e => { e.preventDefault(); if (zoomedMedia) _zoomExitHandler(); else hideHotkeyPopup(); }
);

/* Column operations */
onHotkey('Shift+1-9', 'Toggle column scroll lock',
  e => e.code.startsWith('Digit') && e.shiftKey,
  e => { e.preventDefault(); const n = Number(e.code.slice(5)); if (n >= 1 && n <= 9) toggleColumnLock(n - 1); }
);

onHotkey('1-9', 'Set number of columns',
  e => e.code.startsWith('Digit'),
  e => { e.preventDefault(); const n = Number(e.code.slice(5)); if (n >= 1 && n <= 9) setColumnsHotkey(n); }
);

function itemFromEvent(e) {
  const wrap = e.target.closest?.('.item');
  if (!wrap) return null;
  const id = Number(wrap.dataset.id);
  if (!Number.isFinite(id)) return null;
  return items[id] || null;
}

onHotkey('RMB', 'Toggle column scroll lock',
  container, 'contextmenu',
  (e) => {
    const it = itemFromEvent(e);
    if (!it) return;
    e.preventDefault();
    toggleColumnLock(it.col);
  });

onHotkey('Ctrl+LMB', 'Pixelate column',
  viewport, 'mousedown',
  (e) => {
    if (e.button !== 0 || !e.ctrlKey) return;
    const rect = viewport.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const col = Math.floor(x / columnWidth);
    toggleColumnBlur(col);
    e.preventDefault();
  });

/* Auto-scroll */
onHotkey('Space / p', 'Toggle auto-scroll',
  e => e.key === ' ' || e.key.toLowerCase() === 'p',
  e => { e.preventDefault(); if (autoTicker) stopAuto(); else startAuto(); updateToggleText(); }
);

onHotkey('ArrowRight / l / d', 'Increase auto-scroll speed',
  e => e.key === 'ArrowRight' || e.key.toLowerCase() === 'l' || e.key.toLowerCase() === 'd',
  e => { e.preventDefault(); speedInput.value = Math.min(25, Number(speedInput.value) + 1); speedInput.dispatchEvent(new Event('input')); }
);

onHotkey('ArrowLeft / h / a', 'Decrease auto-scroll speed',
  e => e.key === 'ArrowLeft' || e.key.toLowerCase() === 'h' || e.key.toLowerCase() === 'a',
  e => { e.preventDefault(); speedInput.value = Math.max(1, Number(speedInput.value) - 1); speedInput.dispatchEvent(new Event('input')); }
);

/* Navigation */
onHotkey('PageUp / Shift+K / Shift+W', 'Scroll up (page)',
  e => e.key === 'PageUp' || (e.shiftKey && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'w')),
  e => { e.preventDefault(); targetY -= viewport.clientHeight * 0.9; clampTarget(); }
);

onHotkey('PageDown / Shift+J / Shift+S', 'Scroll down (page)',
  e => e.key === 'PageDown' || (e.shiftKey && (e.key.toLowerCase() === 'j' || e.key.toLowerCase() === 's')),
  e => { e.preventDefault(); targetY += viewport.clientHeight * 0.9; clampTarget(); }
);

onHotkey('w / k', 'Scroll up (line)',
  e => e.key.toLowerCase() === 'w' || e.key.toLowerCase() === 'k',
  e => { e.preventDefault(); targetY -= 120; clampTarget(); }
);

onHotkey('s / j', 'Scroll down (line)',
  e => e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'j',
  e => { e.preventDefault(); targetY += 120; clampTarget(); }
);

/* Volume */
onHotkey('ArrowUp', 'Increase volume',
  e => e.key === 'ArrowUp',
  e => { e.preventDefault(); volumeInput.value = Math.max(0, Math.min(1, parseFloat(volumeInput.value) + 0.05)); volumeInput.dispatchEvent(new Event('input')); }
);

onHotkey('ArrowDown', 'Decrease volume',
  e => e.key === 'ArrowDown',
  e => { e.preventDefault(); volumeInput.value = Math.max(0, Math.min(1, parseFloat(volumeInput.value) - 0.05)); volumeInput.dispatchEvent(new Event('input')); }
);

/* Misc */
onHotkey('Enter / r', 'Reshuffle files',
  e => e.key.toLowerCase() === 'r' || e.key === 'Enter',
  e => { e.preventDefault(); reshuffleFiles(); }
);

document.addEventListener('keydown', (e) => {
  if (e.target.tagName.match(/^(input|textarea|select)$/i)) return;
  if (e.ctrlKey && e.code.startsWith('Digit')) {
    e.preventDefault();
    const n = Number(e.code.slice(5));
    if (n >= 1 && n <= 9) toggleColumnBlur(n - 1);
    return;
  }
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  for (const h of _hotkeyHandlers) {
    if (h.match(e)) { h.handle(e); return; }
  }
});

onHotkey('LMB', 'Show file info popup and copy name to clipboard',
  container, 'click',
  (e) => {
    if (zoomedMedia) return;
    const it = itemFromEvent(e);
    if (!it || !it.file) return;
    copyTextToClipboard(it.file.name);
    showInfoPopup(it, e.clientX, e.clientY);
  });

onHotkey('MMB', 'Zoom in on the media element',
  container, 'mousedown',
  (e) => {
    const it = itemFromEvent(e);
    if (!it) return;
    if (e.button === 1) {
      e.preventDefault();
      enterZoom(it);
    }
  });
onHotkey('Double-LMB', 'Zoom in on the media element',
  container, 'dblclick',
  (e) => {
    const it = itemFromEvent(e);
    if (!it) return;
    e.preventDefault();
    enterZoom(it);
  });

function setColumnsHotkey(n) {
  if (n < 1 || n > 9) return;
  columnsSelect.value = String(n);
  columnsSelect.dispatchEvent(new Event('change'));
}
