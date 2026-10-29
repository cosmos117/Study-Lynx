import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS, IDLE, focusedMinutes, formatClock, isFinished, loadSettings, loadState,
  normalizeSettings, pause, remainingMs, resume, saveSettings, saveState, startBreak, startFocus,
} from './pomodoro.js';

const MINUTE = 60 * 1000;
const T0 = 1_700_000_000_000;
const settings = { focusMinutes: 25, breakMinutes: 5 };
const topic = { topicId: 3, topicName: 'Normalization', sessionId: 41 };

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) };
}

describe('focus and break phases', () => {
  it('counts down a focus block from the configured length', () => {
    const state = startFocus(topic, settings, T0);
    expect(state.phase).toBe('focus');
    expect(remainingMs(state, T0)).toBe(25 * MINUTE);
    expect(remainingMs(state, T0 + 10 * MINUTE)).toBe(15 * MINUTE);
    expect(isFinished(state, T0 + 25 * MINUTE - 1)).toBe(false);
    expect(isFinished(state, T0 + 25 * MINUTE)).toBe(true);
  });

  it('never reports negative time', () => {
    expect(remainingMs(startFocus(topic, settings, T0), T0 + 99 * MINUTE)).toBe(0);
  });

  it('moves to a break of the configured length and forgets the finished session', () => {
    const later = T0 + 25 * MINUTE;
    const breakState = startBreak(startFocus(topic, settings, T0), settings, later);
    expect(breakState).toMatchObject({ phase: 'break', topicName: 'Normalization', sessionId: null });
    expect(remainingMs(breakState, later)).toBe(5 * MINUTE);
  });

  it('reports the whole minutes focused so far', () => {
    const state = startFocus(topic, settings, T0);
    expect(focusedMinutes(state, T0 + 30 * 1000)).toBe(0);
    expect(focusedMinutes(state, T0 + 12 * MINUTE + 59 * 1000)).toBe(12);
  });

  it('idle has no time left and is never finished', () => {
    expect(remainingMs(IDLE, T0)).toBe(0);
    expect(isFinished(IDLE, T0)).toBe(false);
  });
});

describe('pause and resume', () => {
  it('freezes the time while paused and continues from there', () => {
    const running = startFocus(topic, settings, T0);
    const paused = pause(running, T0 + 5 * MINUTE);
    expect(remainingMs(paused, T0 + 60 * MINUTE)).toBe(20 * MINUTE);
    expect(isFinished(paused, T0 + 60 * MINUTE)).toBe(false);

    const resumed = resume(paused, T0 + 60 * MINUTE);
    expect(remainingMs(resumed, T0 + 60 * MINUTE)).toBe(20 * MINUTE);
    expect(isFinished(resumed, T0 + 80 * MINUTE)).toBe(true);
  });

  it('ignores pausing twice or resuming while running', () => {
    const running = startFocus(topic, settings, T0);
    const paused = pause(running, T0 + MINUTE);
    expect(pause(paused, T0 + 2 * MINUTE)).toBe(paused);
    expect(resume(running, T0)).toBe(running);
  });
});

describe('persistence across page loads', () => {
  it('restores a running timer with the right time left after a refresh', () => {
    const storage = memoryStorage();
    saveState(storage, startFocus(topic, settings, T0));
    const restored = loadState(storage);
    expect(restored).toMatchObject({ phase: 'focus', ...topic });
    expect(remainingMs(restored, T0 + 7 * MINUTE)).toBe(18 * MINUTE);
  });

  it('restores a paused timer', () => {
    const storage = memoryStorage();
    saveState(storage, pause(startFocus(topic, settings, T0), T0 + 4 * MINUTE));
    expect(remainingMs(loadState(storage), T0 + 99 * MINUTE)).toBe(21 * MINUTE);
  });

  it('falls back to idle for missing, corrupt or unreadable storage', () => {
    expect(loadState(memoryStorage())).toEqual(IDLE);
    const corrupt = memoryStorage();
    corrupt.setItem('lynx_pomodoro', '{not json');
    expect(loadState(corrupt)).toEqual(IDLE);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadState(broken)).toEqual(IDLE);
    expect(() => saveState(broken, IDLE)).not.toThrow();
  });
});

describe('settings', () => {
  it('defaults to 25/5', () => {
    expect(loadSettings(memoryStorage())).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps custom lengths within limits', () => {
    expect(normalizeSettings({ focusMinutes: 50, breakMinutes: 10 })).toEqual({ focusMinutes: 50, breakMinutes: 10 });
    expect(normalizeSettings({ focusMinutes: 1, breakMinutes: 99 })).toEqual({ focusMinutes: 5, breakMinutes: 30 });
    expect(normalizeSettings({ focusMinutes: 'abc', breakMinutes: '7' })).toEqual({ focusMinutes: 25, breakMinutes: 7 });
  });

  it('saves and reloads custom lengths', () => {
    const storage = memoryStorage();
    saveSettings(storage, { focusMinutes: 45, breakMinutes: 15 });
    expect(loadSettings(storage)).toEqual({ focusMinutes: 45, breakMinutes: 15 });
  });
});

describe('formatClock', () => {
  it.each([[25 * MINUTE, '25:00'], [61 * 1000, '01:01'], [500, '00:01'], [0, '00:00']])('%i ms shows as %s', (ms, text) => {
    expect(formatClock(ms)).toBe(text);
  });
});
