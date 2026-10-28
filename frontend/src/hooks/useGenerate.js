import { useCallback, useRef, useState } from 'react';

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export default function useGenerate() {
  const cancelled = useRef(false);
  const [running, setRunning] = useState(false);

  const run = useCallback(async (request) => {
    cancelled.current = false;
    setRunning(true);
    const deadline = Date.now() + 90 * 1000;

    try {
      while (!cancelled.current) {
        try {
          return await request();
        } catch (error) {
          const code = error.response?.data?.code;
          if (code !== 'AI_BUSY' || Date.now() >= deadline) throw error;
          await wait(3000);
        }
      }
      throw new Error('Generation cancelled');
    } finally {
      setRunning(false);
    }
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
  }, []);

  return { running, run, cancel };
}
