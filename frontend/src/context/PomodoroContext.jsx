import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useFeedback } from '../components/Feedback.jsx';
import { useAuth } from './AuthContext.jsx';
import { hubAPI, studySessionAPI } from '../services/api.js';
import { errorMessage } from '../utils/aiErrors.js';
import { playChime, unlockChime } from '../utils/chime.js';
import {
  IDLE, focusedMinutes, formatClock, isFinished, isPaused, loadSettings, loadState,
  pause as pauseState, remainingMs, resume as resumeState, saveSettings, saveState, startBreak, startFocus,
} from '../utils/pomodoro.js';

const PomodoroContext = createContext(null);
const TITLE_PREFIX = /^⏱ \d{2}:\d{2} · /;

/**
 * One Pomodoro timer for the whole app, so it keeps running while the student moves between pages.
 * Each focus block is a study session on the backend, so it counts toward the streak.
 */
export function PomodoroProvider({ children }) {
  const { user } = useAuth();
  const { toast, confirm } = useFeedback();
  const [state, setState] = useState(() => loadState(window.localStorage));
  const [settings, setSettingsState] = useState(() => loadSettings(window.localStorage));
  const [now, setNow] = useState(() => Date.now());
  const handling = useRef(false);
  // The break-over dialog starts a new block from inside an effect, so it calls the latest `start`.
  const startRef = useRef(null);

  const update = useCallback((next) => {
    setState(next);
    saveState(window.localStorage, next);
  }, []);

  // A different person signing in on this device should not inherit a running timer.
  useEffect(() => {
    if (!user && state.phase !== 'idle') update(IDLE);
  }, [user, state.phase, update]);

  // Tick once a second while a phase is running.
  useEffect(() => {
    if (state.phase === 'idle' || isPaused(state)) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state]);

  const remaining = remainingMs(state, now);
  const clock = formatClock(remaining);

  // Show the countdown in the browser tab, on top of whatever title the page set.
  useEffect(() => {
    const base = document.title.replace(TITLE_PREFIX, '');
    document.title = state.phase === 'idle' ? base : `⏱ ${clock} · ${base}`;
  }, [state.phase, clock]);

  const finishFocus = useCallback(async (current, minutes) => {
    if (!current.sessionId) return;
    try {
      if (minutes >= 1) await studySessionAPI.complete(current.sessionId, { actualDuration: minutes });
      else await studySessionAPI.skip(current.sessionId);
    } catch {
      // The timer must not get stuck on a failed save; the session simply isn't counted.
    }
  }, []);

  // When a phase reaches zero: log the focus block, chime, tell the student, then move on.
  useEffect(() => {
    if (!isFinished(state, now) || handling.current) return;
    handling.current = true;
    const current = state;
    (async () => {
      playChime();
      if (current.phase === 'focus') {
        await finishFocus(current, Math.round(current.durationMs / 60000));
        update(startBreak(current, settings, Date.now()));
        // Released before the popup, so the break still ends on time if the popup is left open.
        handling.current = false;
        confirm({ title: 'Time for a break', message: `Nice work on ${current.topicName}. Your ${settings.breakMinutes}-minute break has started.`, confirmLabel: 'OK', hideCancel: true });
      } else {
        update(IDLE);
        handling.current = false;
        const again = await confirm({ title: "Break's over", message: 'Ready for the next focus block?', confirmLabel: 'Start focus', cancelLabel: 'Done for now' });
        if (again) await startRef.current({ id: current.topicId, name: current.topicName });
      }
    })();
  }, [state, now, settings, update, confirm, finishFocus]);

  const start = useCallback(async (topic) => {
    unlockChime();
    if (state.phase !== 'idle') {
      if (!await confirm({ title: 'Start a new focus block?', message: 'The current timer will stop.', confirmLabel: 'Start new' })) return;
      if (state.phase === 'focus') await finishFocus(state, focusedMinutes(state, Date.now()));
    }
    try {
      const { data } = await hubAPI.studyNow(topic.id, { plannedDuration: settings.focusMinutes, technique: 'CUSTOM' });
      update(startFocus({ topicId: topic.id, topicName: topic.name, sessionId: data.data.session.id }, settings, Date.now()));
      setNow(Date.now());
    } catch (requestError) {
      toast(errorMessage(requestError, 'Unable to start the timer'), 'error');
    }
  }, [state, settings, confirm, finishFocus, update, toast]);

  startRef.current = start;

  const stop = useCallback(async () => {
    if (state.phase === 'focus') await finishFocus(state, focusedMinutes(state, Date.now()));
    update(IDLE);
  }, [state, finishFocus, update]);

  const pause = useCallback(() => update(pauseState(state, Date.now())), [state, update]);
  const resume = useCallback(() => update(resumeState(state, Date.now())), [state, update]);

  const setSettings = useCallback((next) => {
    saveSettings(window.localStorage, next);
    setSettingsState(loadSettings(window.localStorage));
  }, []);

  const value = useMemo(() => ({
    ...state, paused: isPaused(state), remaining, clock, settings, start, stop, pause, resume, setSettings,
  }), [state, remaining, clock, settings, start, stop, pause, resume, setSettings]);

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>;
}

export function usePomodoro() {
  const context = useContext(PomodoroContext);
  if (!context) throw new Error('usePomodoro must be used inside PomodoroProvider');
  return context;
}
