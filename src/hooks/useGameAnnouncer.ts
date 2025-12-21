import { useEffect, useRef } from 'react';
import { useYarnGPT } from '../utils/useYarnGPT';
import { GameState } from '../types/game';
import { CONFETTI_COLORS } from '../utils/theme-constants';
import confetti from 'canvas-confetti';

interface UseGameAnnouncerOptions {
  gameState: GameState | null;
  isMuted: boolean;
}

/**
 * Shared hook for game announcements using YarnGPT
 * Handles power card announcements, winner celebrations, and last card warnings
 */
export function useGameAnnouncer({ gameState, isMuted }: UseGameAnnouncerOptions) {
  const { play, preload, isPlaying, error } = useYarnGPT(!isMuted);
  
  const lastAnnouncedCard = useRef<string | null>(null);
  const lastAnnouncedWinner = useRef<string | null>(null);
  const lastAnnouncedAction = useRef<string | null>(null);
  const pendingContinue = useRef<boolean>(false);
  // Track game session to reset refs on new game
  const lastGameStartTime = useRef<number | null>(null);
  // Track if we've announced game start for current session
  const hasAnnouncedGameStart = useRef(false);
  const prevGameStarted = useRef<boolean | undefined>(undefined);
  // Track when game start was announced to delay power card announcements
  const gameStartAnnouncedAt = useRef<number | null>(null);

  // Preload common phrases
  useEffect(() => {
    if (isMuted) return;
    preload([
      'Game don start, na who sabi go win!',
      'Oya Pick Two!', 'Oya Pick Three!', 'Go to market my friend!', 'Hold On!',
      'Suspension!', 'Check Up!', 'Last Card oo!', 'Continue!',
      'I need Circle!', 'I need Square!', 'I need Triangle!', 'I need Star!', 'I need Cross!',
      'Warning! Two cards left!',
    ]);
  }, [isMuted, preload]);

  // Announce game start (only when gameStarted transitions from false to true)
  useEffect(() => {
    if (isMuted) return;
    const gameStarted = gameState?.gameStarted;
    
    // Detect transition: was not started, now is started
    if (gameStarted && !prevGameStarted.current && !hasAnnouncedGameStart.current) {
      hasAnnouncedGameStart.current = true;
      gameStartAnnouncedAt.current = Date.now();
      play('Game don start, na who sabi go win!');
    }
    
    // Reset when game ends (winner declared or gameStarted becomes false)
    if (!gameStarted && prevGameStarted.current) {
      hasAnnouncedGameStart.current = false;
      gameStartAnnouncedAt.current = null;
    }
    
    prevGameStarted.current = gameStarted;
  }, [gameState?.gameStarted, isMuted, play]);

  // Reset announcement tracking when a new game starts
  useEffect(() => {
    const turnStart = gameState?.turnStartTime;
    const gameStarted = gameState?.gameStarted;
    const winner = gameState?.winner;
    
    // Only reset on actual new game start, not on turn changes
    // Detect new game: gameStarted becomes true AND there's no winner (fresh game)
    if (gameStarted && !winner && turnStart && turnStart !== lastGameStartTime.current) {
      // Only reset if this is truly a new game (large time gap OR first game)
      const timeSinceLastGame = lastGameStartTime.current ? (turnStart - lastGameStartTime.current) : Infinity;
      
      // Reset only on new game start (not during gameplay)
      // A new game is indicated by: no previous timestamp OR gap > 30 seconds (longer than a turn)
      if (!lastGameStartTime.current || timeSinceLastGame > 30000) {
        lastAnnouncedCard.current = null;
        lastAnnouncedWinner.current = null;
        lastAnnouncedAction.current = null;
        pendingContinue.current = false;
      }
      lastGameStartTime.current = turnStart;
    }
    
    // Reset lastGameStartTime when game ends so next game is detected as new
    if (winner) {
      lastGameStartTime.current = null;
    }
  }, [gameState?.gameStarted, gameState?.turnStartTime, gameState?.winner]);

  // Announce power cards
  useEffect(() => {
    const topCard = gameState?.currentCard;
    const winner = gameState?.winner;
    
    if (!topCard || winner || isMuted) return;
    
    // For Whot cards, wait until selectedShape is set before announcing
    if (topCard.number === 20 && !gameState?.selectedShape) return;
    
    // Use card ID + selectedShape for Whot to ensure correct announcement
    // This prevents announcing stale shape from previous Whot play
    const cardKey = topCard.number === 20 
      ? `${topCard.id}-${gameState?.selectedShape}`
      : topCard.id;
    if (lastAnnouncedCard.current === cardKey) return;
    lastAnnouncedCard.current = cardKey;

    const rules = gameState?.rules;
    const isPowerCard = [1, 2, 5, 8, 14, 20].includes(topCard.number);

    // Check for pending "Continue" announcement
    if (pendingContinue.current && !winner) {
      if (!isPowerCard) {
        setTimeout(() => play('Continue!'), 1500);
      }
    }
    pendingContinue.current = false;

    // Determine delay: if game just started, delay power card announcement to avoid overlap
    const timeSinceGameStart = gameStartAnnouncedAt.current ? (Date.now() - gameStartAnnouncedAt.current) : Infinity;
    const delay = (isPowerCard && timeSinceGameStart < 3000) ? 2500 : 0;

    const announceCard = () => {
      switch (topCard.number) {
        case 2:
          if (rules?.pickTwo) play('Oya Pick Two!');
          break;
        case 5:
          if (rules?.pickThree) play('Oya Pick Three!');
          break;
        case 14:
          play('Go to market my friend!');
          pendingContinue.current = true;
          break;
        case 1:
          play('Hold On!');
          pendingContinue.current = true;
          break;
        case 8:
          play('Suspension!');
          break;
        case 20:
          if (gameState?.selectedShape) {
            const shape = gameState.selectedShape.charAt(0).toUpperCase() + gameState.selectedShape.slice(1);
            play(`I need ${shape}!`);
          }
          break;
      }
    };

    if (delay > 0) {
      const timeoutId = setTimeout(announceCard, delay);
      return () => clearTimeout(timeoutId);
    } else {
      announceCard();
    }
  }, [gameState?.currentCard, gameState?.selectedShape, gameState?.rules, gameState?.winner, isMuted, play]);

  // Announce last card warnings
  useEffect(() => {
    if (isMuted || gameState?.winner) return;
    const action = gameState?.lastAction?.toLowerCase() || '';
    
    // Create a unique key for this action to prevent duplicate announcements
    // Include a portion of the action text to differentiate between different warnings
    const actionKey = action.includes('last card') ? `lastcard-${action}` 
      : action.includes('warning') && action.includes('two cards') ? `twocard-${action}`
      : null;
    
    if (!actionKey || lastAnnouncedAction.current === actionKey) return;
    lastAnnouncedAction.current = actionKey;
    
    let timeoutId: number | undefined;

    if (action.includes('last card')) {
      timeoutId = window.setTimeout(() => play('Last Card oo!'), 2500);
    } else if (action.includes('warning') && action.includes('two cards')) {
      timeoutId = window.setTimeout(() => play('Warning! Two cards left!'), 2500);
    }

    return () => { if (timeoutId) window.clearTimeout(timeoutId); };
  }, [gameState?.lastAction, gameState?.winner, isMuted, play]);

  // Announce winner with confetti (pidgin style)
  useEffect(() => {
    if (isMuted) return;
    const winnerId = gameState?.winner;
    if (!winnerId || winnerId === lastAnnouncedWinner.current) return;
    lastAnnouncedWinner.current = winnerId;

    // Get winner's name and win count
    const winnerPlayer = gameState?.players?.find(p => p.id === winnerId);
    const winnerName = winnerPlayer?.name || 'Player';
    const winCount = gameState?.sessionWins?.[winnerId] || 1;
    
    // Pidgin winner announcement
    const winPhrase = winCount > 1 
      ? `${winnerName} don win again oo!`
      : `${winnerName} don win oo!`;
    
    play(winPhrase);

    // Play applause and confetti immediately
    const applauseAudio = new Audio('/sounds/applause.mp3');
    applauseAudio.play().catch(() => {});

    const fireConfetti = () => {
      const defaults = { 
        disableForReducedMotion: true, 
        ticks: 150, 
        gravity: 1.2, 
        scalar: 0.9, 
        colors: [...CONFETTI_COLORS] 
      };
      confetti({ ...defaults, particleCount: 40, angle: 60, spread: 50, origin: { x: 0, y: 0.8 } });
      confetti({ ...defaults, particleCount: 40, angle: 120, spread: 50, origin: { x: 1, y: 0.8 } });
    };

    fireConfetti();
    const intervalId = window.setInterval(fireConfetti, 600);
    const cleanupId = window.setTimeout(() => window.clearInterval(intervalId), 1200);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(cleanupId);
    };
  }, [isMuted, gameState?.winner, gameState?.players, gameState?.sessionWins, play]);

  return { isPlaying, error };
}
