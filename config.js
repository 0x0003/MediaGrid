// startup values
const CONFIG = {
  /* General */
  // Number of columns (1-9)
  columns: 4,

  // Media filter: 'both' | 'images' | 'videos'
  filter: 'both',

  // Shuffle on load
  shuffle: true,

  // Auto-scroll speed (1–25)
  speed: 3,
  speedMin: 1,
  speedMax: 25,

  // Volume
  volume: 0.1,
  volumeStep: 0.05,

  // Theme: 'system' | 'light' | 'dark'
  theme: 'system',

  // Exclude files in subdirectories
  ignoreSubdirs: true,

  // Zoom increment per step
  zoomStep: 0.3,

  // Regex filter (empty string = .*)
  regexFilter: '',

  // Show the files panel at startup
  loadPanelVisible: true,

  // Popup auto-close delay (ms)
  popupFadeout: 3000,

  // Flash play/pause symbol in the center on toggle
  flashIndicator: true,

  /* Grid engine */
  // Number of items assigned per batch
  assignBatch: 48,

  // Grid rows to preload ahead of scroll direction
  preloadScreens: 2,

  // Fallback aspect ratio (width/height)
  estRatio: 0.75,

  // Visible fraction threshold to trigger video autoplay
  obsThreshold: 0.15,

  // Scroll easing factor
  ease: 0.12,

  // Higher = more detail retained when pixelating columns
  pixelDetail: 35,
};
