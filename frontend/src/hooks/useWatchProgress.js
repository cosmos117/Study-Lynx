import { useCallback, useEffect, useRef, useState } from 'react';
import { resourceAPI } from '../services/api.js';
import { ENDED, PAUSED, PLAYING, loadYouTubeApi, percentAt, shouldSave } from '../utils/youtube.js';

const SAMPLE_MS = 2000;

/**
 * Tracks a YouTube video for the student: the furthest point reached (as a percentage) and where
 * playback is now, saved while playing and whenever they pause, finish or leave, so the video
 * resumes where they stopped. `iframe` is a ref to an embed whose URL includes `enablejsapi=1`.
 *
 * Returns { percent, position, duration, seekTo(fraction) }.
 */
export default function useWatchProgress(resource, iframe, onSaved) {
  const [percent, setPercent] = useState(0);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerRef = useRef(null);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  // The page loads the video after the first render, so read what was saved when tracking starts.
  const saved = useRef({ percent: 0, position: 0 });
  saved.current = { percent: resource?.watchedPercent || 0, position: resource?.positionSeconds || 0 };
  const id = resource?.id;
  const videoId = resource?.youtubeVideoId;

  useEffect(() => {
    if (!id || !videoId || !iframe.current) return undefined;
    const progress = {
      furthest: saved.current.percent,
      saved: saved.current.percent,
      position: saved.current.position,
      savedPosition: saved.current.position,
      lastSavedAt: Date.now(),
    };
    setPercent(progress.furthest);
    setPosition(progress.position);
    let player = null;
    let timer = null;
    let cancelled = false;

    const sample = () => {
      if (!player?.getCurrentTime) return;
      const current = player.getCurrentTime();
      const length = player.getDuration();
      if (length > 0) setDuration(length);
      progress.position = Math.floor(current);
      setPosition(progress.position);
      const reached = percentAt(current, length);
      if (reached > progress.furthest) {
        progress.furthest = reached;
        setPercent(reached);
      }
    };

    const save = (force) => {
      const now = Date.now();
      const changed = progress.furthest > progress.saved || progress.position !== progress.savedPosition;
      if (force ? !changed : !shouldSave({ ...progress, now })) return;
      const update = { watchedPercent: progress.furthest, positionSeconds: progress.position };
      progress.saved = update.watchedPercent;
      progress.savedPosition = update.positionSeconds;
      progress.lastSavedAt = now;
      resourceAPI.progress(id, update)
        .then(({ data }) => onSavedRef.current?.(data.data.resource))
        .catch(() => { progress.saved -= 1; }); // retried on the next save
    };

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !iframe.current) return;
        player = new YT.Player(iframe.current, {
          events: {
            onReady: () => { playerRef.current = player; sample(); },
            onStateChange: ({ data: state }) => {
              if (state === PAUSED) { sample(); save(true); }
              // Finished: 100%, and next time it starts from the beginning.
              if (state === ENDED) {
                progress.furthest = 100;
                progress.position = 0;
                setPercent(100);
                setPosition(0);
                save(true);
              }
            },
          },
        });
        timer = setInterval(() => {
          if (player.getPlayerState?.() !== PLAYING) return;
          sample();
          save(false);
        }, SAMPLE_MS);
      })
      .catch(() => {}); // Without the API the video still plays; progress just isn't tracked.

    return () => {
      cancelled = true;
      clearInterval(timer);
      sample();
      save(true);
      playerRef.current = null;
    };
  }, [id, videoId, iframe]);

  /** Jumps to a point in the video, given as a fraction of its length (0 to 1). */
  const seekTo = useCallback((fraction) => {
    const player = playerRef.current;
    const length = player?.getDuration?.();
    if (!length) return false;
    const target = Math.max(0, Math.min(length - 1, fraction * length));
    player.seekTo(target, true);
    player.playVideo?.();
    setPosition(Math.floor(target));
    return true;
  }, []);

  return { percent, position, duration, seekTo };
}
