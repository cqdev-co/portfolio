import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Smart scroll hook with momentum detection.
 *
 * Features:
 * - Auto-scrolls to bottom when at bottom
 * - Tracks scroll velocity to detect user intent
 * - Won't interrupt user who is actively scrolling up
 * - Resumes auto-scroll after user stops or scrolls down
 */
export function useScrollToBottom() {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Refs for tracking state without re-renders
  const isAtBottomRef = useRef(true);
  const isUserScrollingRef = useRef(false);

  // Velocity tracking
  const lastScrollTopRef = useRef(0);
  const lastScrollTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const isScrollingUpRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  const checkIfAtBottom = useCallback(() => {
    if (!containerRef.current) {
      return true;
    }
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // Consider "at bottom" if within 100px of the end
    return scrollTop + clientHeight >= scrollHeight - 100;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (!containerRef.current) {
      return;
    }
    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior,
    });
  }, []);

  // Handle user scroll events with velocity tracking
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let scrollTimeout: ReturnType<typeof setTimeout>;
    let velocityDecayInterval: ReturnType<typeof setInterval>;

    const handleScroll = () => {
      const now = Date.now();
      const currentScrollTop = container.scrollTop;
      const timeDelta = now - lastScrollTimeRef.current;

      // Calculate velocity (pixels per millisecond)
      if (timeDelta > 0) {
        const scrollDelta = currentScrollTop - lastScrollTopRef.current;
        const newVelocity = scrollDelta / timeDelta;

        // Smooth velocity with exponential moving average
        velocityRef.current = velocityRef.current * 0.7 + newVelocity * 0.3;

        // Detect if user is actively scrolling up
        // Negative velocity = scrolling up
        isScrollingUpRef.current = velocityRef.current < -0.3;
      }

      lastScrollTopRef.current = currentScrollTop;
      lastScrollTimeRef.current = now;

      // Mark as user scrolling
      isUserScrollingRef.current = true;
      clearTimeout(scrollTimeout);

      const atBottom = checkIfAtBottom();
      setIsAtBottom(atBottom);
      isAtBottomRef.current = atBottom;

      // Reset user scrolling flag after pause
      scrollTimeout = setTimeout(() => {
        isUserScrollingRef.current = false;
        isScrollingUpRef.current = false;
        velocityRef.current = 0;
      }, 150);
    };

    // Decay velocity when not scrolling
    velocityDecayInterval = setInterval(() => {
      if (!isUserScrollingRef.current) {
        velocityRef.current *= 0.9;
        if (Math.abs(velocityRef.current) < 0.01) {
          velocityRef.current = 0;
        }
      }
    }, 50);

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
      clearInterval(velocityDecayInterval);
    };
  }, [checkIfAtBottom]);

  // Auto-scroll when content changes (smart momentum)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const scrollIfNeeded = () => {
      // Don't auto-scroll if:
      // 1. Not at bottom
      // 2. User is actively scrolling
      // 3. User is scrolling UP (negative velocity)
      const shouldScroll =
        isAtBottomRef.current &&
        !isUserScrollingRef.current &&
        !isScrollingUpRef.current;

      if (shouldScroll) {
        requestAnimationFrame(() => {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'instant',
          });
          setIsAtBottom(true);
          isAtBottomRef.current = true;
        });
      }
    };

    // Observe content changes
    const mutationObserver = new MutationObserver(scrollIfNeeded);
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Observe size changes
    const resizeObserver = new ResizeObserver(scrollIfNeeded);
    resizeObserver.observe(container);

    for (const child of Array.from(container.children)) {
      resizeObserver.observe(child);
    }

    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, []);

  return {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    // Expose velocity for advanced use cases
    getScrollVelocity: () => velocityRef.current,
    isScrollingUp: () => isScrollingUpRef.current,
  };
}
