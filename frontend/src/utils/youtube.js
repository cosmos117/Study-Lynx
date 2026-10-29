// YouTube's IFrame Player API lets the page ask the embedded player how far the video has played.

const API_SRC = 'https://www.youtube.com/iframe_api';
export const PLAYING = 1;
export const PAUSED = 2;
export const ENDED = 0;

let apiPromise = null;

/** Loads the player API once; resolves with `window.YT`. */
export function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ||= new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = API_SRC;
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error('Unable to load the YouTube player API'));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

/** Whole percent of the video reached at `currentTime`, between 0 and 100. */
export function percentAt(currentTime, duration) {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(100, Math.max(0, Math.floor((currentTime / duration) * 100)));
}

/**
 * Whether to save now: the furthest point moved forward by `step` percent, or, once `minMs` has
 * passed, either the furthest point or the playback position (by `minSeconds`) changed.
 */
export function shouldSave({ furthest, saved, position = 0, savedPosition = 0, lastSavedAt, now, step = 5, minMs = 20000, minSeconds = 10 }) {
  if (furthest - saved >= step) return true;
  if (now - lastSavedAt < minMs) return false;
  return furthest > saved || Math.abs(position - savedPosition) >= minSeconds;
}

/** Seconds as a video timestamp: 245 → "4:05", 3910 → "1:05:10". */
export function formatTimestamp(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}
