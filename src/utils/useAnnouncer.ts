import { useCallback, useRef } from 'react';

// Available sound files in /public/sounds/
type SoundName = 
  | 'pick_two'
  | 'pick_three'
  | 'general_market'
  | 'hold_on'
  | 'suspension'
  | 'check_up'
  | 'last_card'
  | 'warning'
  | 'i_need_circle'
  | 'i_need_cross'
  | 'i_need_square'
  | 'i_need_star'
  | 'i_need_triangle'
  | 'invalid_card'
  | 'defended'
  | 'continue'
  | 'play_again'
  | 'applause';

/**
 * Hook for playing voice announcements
 * @param enabled - Whether sounds should play (for mute functionality)
 */
export function useAnnouncer(enabled: boolean = true) {
  // Track currently playing audio to prevent overlaps
  const currentAudio = useRef<HTMLAudioElement | null>(null);

  const play = useCallback((soundName: SoundName) => {
    if (!enabled) return;

    // Stop any currently playing audio
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current = null;
    }

    try {
      // Most sounds are .m4a, but applause is .mp3
      const extension = soundName === 'applause' ? 'mp3' : 'm4a';
      const audio = new Audio(`/sounds/${soundName}.${extension}`);
      currentAudio.current = audio;
      
      audio.play().catch((err) => {
        // Autoplay might be blocked by browser - silently ignore
        console.warn('Audio playback blocked:', err.message);
      });

      // Clear reference when done
      audio.onended = () => {
        currentAudio.current = null;
      };
    } catch (err) {
      console.warn('Failed to create audio:', err);
    }
  }, [enabled]);

  // Helper to play shape-specific Whot announcements
  const playShapeCall = useCallback((shape: string) => {
    const shapeSound = `i_need_${shape.toLowerCase()}` as SoundName;
    play(shapeSound);
  }, [play]);

  return { play, playShapeCall };
}
