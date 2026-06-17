# MediaGrid

A zero-dependency, client-side media viewer for browsing images and videos from local directories, arranged in an infinite scrollable grid.

![screenshot](https://github.com/user-attachments/assets/3211d0f8-cebf-486f-8deb-fed773469e60)

## Usage

Open `MediaGrid.html` in your browser of choice.

> [!NOTE]
> Apply common sense during usage: decoding twenty 4K videos at once is probably not a good idea.

## Features

- **No building, no executables, no local server, no dependencies** - pure HTML, CSS, and ES2020+ JavaScript
- **Stateless** - no localStorage, cookies, or filesystem side effects; close the tab and nothing remains (except RAM cache)
- **Multi-directory loading** - pick directories via the file picker or drag & drop; queue up multiple before loading
- **Grid layout** - adjustable columns (1-9), responsive to viewport resizing
- **Media filtering** - show images only, videos only, or both; filter by file name with a regex
- **Auto-scroll** - configurable speed with play/pause toggle
- **Column scroll locking** - right-click a column to lock it in place while the rest scrolls
- **Column pixelation** - `Ctrl+click` on a column to blur/pixelate its contents
- **Zoom** - double-click or middle-click on a media item to view it fullscreen
- **Volume control** - per-session volume for video playback
- **Dark / light theme** - follows `prefers-color-scheme` by default, with manual toggle

## Configuration

Startup values in `config.js` can be edited before opening the page.

## Caveats

- Browsers will show a permission notice when selecting directories using the "Select directories..." button. This is standard and unavoidable. No data is transmitted - processing is entirely client-side. Drag & drop is unaffected.

