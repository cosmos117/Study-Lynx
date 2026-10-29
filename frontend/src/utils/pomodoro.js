// Pure Pomodoro timer logic, kept free of React so it can be unit tested.
// Time is stored as an absolute end time (`endsAt`), never as a counter, so the timer stays
// correct across page changes, refreshes and background tabs where intervals are throttled.

const MINUTE = 60 * 1000;
const STATE_KEY = 'lynx_pomodoro';
const SETTINGS_KEY = 'lynx_pomodoro_settings';

export const LIMITS = { focusMinutes: [5, 120], breakMinutes: [1, 30] };
export const DEFAULT_SETTINGS = { focusMinutes: 25, breakMinutes: 5 };
export const IDLE = { phase: 'idle', endsAt: null, pausedRemaining: null, durationMs: 0, topicId: null, topicName: null, sessionId: null };

const clamp = (value, [min, max], fallback) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

export function normalizeSettings(settings = {}) {
  return {
    focusMinutes: clamp(settings.focusMinutes, LIMITS.focusMinutes, DEFAULT_SETTINGS.focusMinutes),
    breakMinutes: clamp(settings.breakMinutes, LIMITS.breakMinutes, DEFAULT_SETTINGS.breakMinutes),
  };
}

export function startFocus({ topicId, topicName, sessionId }, settings, now) {
  const durationMs = settings.focusMinutes * MINUTE;
  return { phase: 'focus', endsAt: now + durationMs, pausedRemaining: null, durationMs, topicId, topicName, sessionId };
}

export function startBreak(state, settings, now) {
  const durationMs = settings.breakMinutes * MINUTE;
  return { ...state, phase: 'break', endsAt: now + durationMs, pausedRemaining: null, durationMs, sessionId: null };
}

export const isPaused = (state) => state.pausedRemaining !== null;

export function remainingMs(state, now) {
  if (state.phase === 'idle') return 0;
  if (isPaused(state)) return state.pausedRemaining;
  return Math.max(0, state.endsAt - now);
}

export function pause(state, now) {
  if (state.phase === 'idle' || isPaused(state)) return state;
  return { ...state, endsAt: null, pausedRemaining: remainingMs(state, now) };
}

export function resume(state, now) {
  if (!isPaused(state)) return state;
  return { ...state, endsAt: now + state.pausedRemaining, pausedRemaining: null };
}

/** True once a running (not paused) phase has reached zero. */
export const isFinished = (state, now) => state.phase !== 'idle' && !isPaused(state) && now >= state.endsAt;

/** Whole minutes actually spent focusing so far in this block. */
export const focusedMinutes = (state, now) => Math.floor((state.durationMs - remainingMs(state, now)) / MINUTE);

export function formatClock(ms) {
  const seconds = Math.ceil(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

// Storage can be unavailable (private mode, blocked site data), so every access is guarded.
function read(storage, key) {
  try {
    return JSON.parse(storage.getItem(key));
  } catch {
    return null;
  }
}

function write(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Not persisted; the timer still works for this page view.
  }
}

export function loadState(storage) {
  const saved = read(storage, STATE_KEY);
  const valid = saved && ['focus', 'break'].includes(saved.phase) && Number.isFinite(saved.durationMs)
    && (Number.isFinite(saved.endsAt) || Number.isFinite(saved.pausedRemaining));
  return valid ? { ...IDLE, ...saved } : IDLE;
}

export const saveState = (storage, state) => write(storage, STATE_KEY, state);
export const loadSettings = (storage) => normalizeSettings(read(storage, SETTINGS_KEY) || undefined);
export const saveSettings = (storage, settings) => write(storage, SETTINGS_KEY, normalizeSettings(settings));
