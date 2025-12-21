import { useEffect, useRef, useState, useMemo, useCallback } from 'react';

export const TURN_TIMEOUT_MS = 30000; // 30 seconds
export const COUNTDOWN_WARNING_MS = 10000; // Show countdown in last 10 seconds

interface UseAutoPlayOptions {
  isMyTurn: boolean;
  gameStarted: boolean;
  hasWinner: boolean;
  turnStartTime?: number;
  roomCode: string;
  playerId: string;
  onAutoPlay: (roomCode: string, playerId: string) => Promise<void>;
  /** Optional: Function to re-validate turn before triggering auto-play */
  validateTurn?: () => boolean;
}

export function useAutoPlay({
  isMyTurn,
  gameStarted,
  hasWinner,
  turnStartTime,
  roomCode,
  playerId,
  onAutoPlay,
  validateTurn
}: UseAutoPlayOptions) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoPlayTriggeredRef = useRef(false);
  // Track the turnStartTime this timer was created for
  const currentTurnStartRef = useRef<number | undefined>(undefined);

  // Determine if timer should be active
  const shouldRunTimer = isMyTurn && gameStarted && !hasWinner;

  // Memoized auto-play handler with validation
  const handleAutoPlay = useCallback(async () => {
    // Re-validate that it's still our turn before calling server
    if (validateTurn && !validateTurn()) {
      console.log('[AutoPlay] Turn validation failed, skipping auto-play');
      return;
    }
    
    // Also check if turnStartTime changed (turn moved on)
    if (currentTurnStartRef.current !== turnStartTime) {
      console.log('[AutoPlay] Turn changed, skipping auto-play');
      return;
    }

    try {
      await onAutoPlay(roomCode, playerId);
    } catch (err) {
      console.error('[AutoPlay] Failed:', err);
    }
  }, [onAutoPlay, roomCode, playerId, validateTurn, turnStartTime]);

  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Reset state when timer shouldn't run
    if (!shouldRunTimer) {
      autoPlayTriggeredRef.current = false;
      currentTurnStartRef.current = undefined;
      // Use setTimeout to avoid synchronous setState in effect
      const resetId = setTimeout(() => setTimeRemaining(null), 0);
      return () => clearTimeout(resetId);
    }

    const turnStart = turnStartTime || Date.now();
    autoPlayTriggeredRef.current = false;
    currentTurnStartRef.current = turnStart;

    const updateTimer = () => {
      // Check if turn changed while timer was running
      if (currentTurnStartRef.current !== turnStart) {
        return;
      }

      const elapsed = Date.now() - turnStart;
      const remaining = Math.max(0, TURN_TIMEOUT_MS - elapsed);
      setTimeRemaining(remaining);

      if (remaining <= 0 && !autoPlayTriggeredRef.current) {
        autoPlayTriggeredRef.current = true;
        handleAutoPlay();
      }
    };

    // Initial update after a tick to avoid sync setState
    const initialId = setTimeout(updateTimer, 0);
    timerRef.current = setInterval(updateTimer, 100);

    return () => {
      clearTimeout(initialId);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [shouldRunTimer, turnStartTime, handleAutoPlay]);

  // Derived values using useMemo to avoid recalculation
  const { showCountdown, isCritical, secondsLeft } = useMemo(() => ({
    showCountdown: timeRemaining !== null && timeRemaining <= COUNTDOWN_WARNING_MS,
    isCritical: timeRemaining !== null && timeRemaining <= 5000,
    secondsLeft: timeRemaining !== null ? Math.ceil(timeRemaining / 1000) : null
  }), [timeRemaining]);

  return { timeRemaining, showCountdown, isCritical, secondsLeft };
}
