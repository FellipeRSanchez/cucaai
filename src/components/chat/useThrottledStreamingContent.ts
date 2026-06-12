import { useEffect, useRef, useState } from 'react';

interface UseThrottledStreamingContentOptions {
  isStreaming: boolean;
  intervalMs?: number;
}

export function useThrottledStreamingContent(
  content: string,
  options: UseThrottledStreamingContentOptions
) {
  const { isStreaming, intervalMs = 32 } = options;
  const [throttledContent, setThrottledContent] = useState(content);
  const lastFlushRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearPendingFlush = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const scheduleFlush = (delayMs: number) => {
      clearPendingFlush();
      timeoutRef.current = setTimeout(() => {
        setThrottledContent(content);
        lastFlushRef.current = Date.now();
        timeoutRef.current = null;
      }, Math.max(0, delayMs));
    };

    if (!isStreaming) {
      scheduleFlush(0);
      return () => {
        clearPendingFlush();
      };
    }

    const now = Date.now();
    const elapsed = now - lastFlushRef.current;

    if (elapsed >= intervalMs) {
      scheduleFlush(0);
    } else {
      scheduleFlush(intervalMs - elapsed);
    }

    return () => {
      clearPendingFlush();
    };
  }, [content, isStreaming, intervalMs]);

  return throttledContent;
}
