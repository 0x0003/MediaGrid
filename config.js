// startup values
const CONFIG = {
  /* General */
  // Number of columns (1-9)
  columns: 4,

  // Media filter: 'both' | 'images' | 'videos'
  filter: 'both',

  // Shuffle on load
  shuffle: true,

  // Auto-scroll speed
  speed: 3,
  speedMin: 1,
  speedMax: 25,

  // Volume
  volume: 0.1,
  volumeStep: 0.01,

  // Theme: 'system' | 'light' | 'dark'
  theme: 'system',

  // Filter files from subdirectories
  ignoreSubdirs: true,

  // Regex filter (empty = *)
  regexFilter: '',

  // Show the files panel at startup
  loadPanelVisible: true,

  // How long the file info popup will stay visible before automatically closing
  popupFadeout: 3000,

  /* Grid engine */
  // Number of items assigned per batch
  assignBatch: 48,

  // Screens to preload ahead of viewport
  preloadScreens: 2,

  // Fallback aspect ratio (width/height)
  estRatio: 0.75,

  // Intersection ratio to trigger video play
  obsThreshold: 0.15,

  // Scroll easing factor
  ease: 0.12,

  // Higher = more detail retained when pixelating columns
  pixelDetail: 35,
};
