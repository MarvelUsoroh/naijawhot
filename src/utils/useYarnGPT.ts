import { useCallback, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase only if needed, or pass it in. 
// Ideally use the existing client from useGameConnection context, but creating lightweight one here is fine for storage/functions access using anon key.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Voice = 'Idera' | 'Mary' | 'David' | 'Emeka' | 'Fatima' | 'Tayo';

interface YarnGPTState {
  isPlaying: boolean;
  error: string | null;
}

export function useYarnGPT(enabled: boolean = true) {
  const [state, setState] = useState<YarnGPTState>({ isPlaying: false, error: null });
  const audioCache = useRef<Map<string, string>>(new Map()); // Cache text -> URL

  /**
   * Preload audio for a list of phrases to ensure smooth playback during game
   */
  const preload = useCallback(async (phrases: string[], voice: Voice = 'Idera') => {
    if (!enabled) return;
    

    // Stagger requests to avoid 503 Timeouts/Rate Limits
    for (const text of phrases) {
      play(text, voice, true); // dryRun = true
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }, [enabled]);

  /**
   * Play TTS for the given text
   * @param text Text to speak
   * @param voice Voice ID (default: Idera)
   * @param dryRun If true, only caches the URL, doesn't play
   */
  const play = useCallback(async (text: string, voice: Voice = 'Idera', dryRun: boolean = false) => {
    if (!enabled && !dryRun) return;

    try {
      const cacheKey = `${text}-${voice}`;
      let audioUrl = audioCache.current.get(cacheKey);

      if (!audioUrl) {
        // Call Edge Function to get audio URL (cached or generated)
        const { data, error } = await supabase.functions.invoke('whot-tts', {
          body: { text, voice }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        audioUrl = data.url;
        audioCache.current.set(cacheKey, audioUrl!);
      }

      if (dryRun || !audioUrl) return;

      const audio = new Audio(audioUrl);
      setState(prev => ({ ...prev, isPlaying: true, error: null }));
      
      audio.onended = () => setState(prev => ({ ...prev, isPlaying: false }));
      audio.onerror = (e) => {
        console.error('Audio playback error', e);
        setState(prev => ({ ...prev, isPlaying: false, error: 'Playback failed' }));
      };

      await audio.play();

    } catch (err: any) {
      console.error('YarnGPT Error:', err);
      setState(prev => ({ ...prev, error: err.message }));
    }
  }, [enabled]);

  return {
    play,
    preload,
    isPlaying: state.isPlaying,
    error: state.error
  };
}
