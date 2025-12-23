import { useCallback, useRef, useState } from 'react';
import { supabase } from './supabase-client';

type Voice = 'Idera' | 'Mary' | 'David' | 'Emeka' | 'Fatima' | 'Tayo';

interface YarnGPTState {
  isPlaying: boolean;
  error: string | null;
}

export function useYarnGPT(enabled: boolean = true) {
  const [state, setState] = useState<YarnGPTState>({ isPlaying: false, error: null });
  const audioCache = useRef<Map<string, string>>(new Map()); // Cache text -> URL
  const inFlight = useRef<Map<string, Promise<string | null>>>(new Map());

  const warmAudio = useCallback((url: string) => {
    try {
      const audio = new Audio(url);
      audio.preload = 'auto';
      audio.load();
    } catch {
      // Best-effort warmup only.
    }
  }, []);

  const getOrFetchAudioUrl = useCallback(async (text: string, voice: Voice): Promise<string | null> => {
    const cacheKey = `${text}-${voice}`;
    const cached = audioCache.current.get(cacheKey);
    if (cached) return cached;

    const existingPromise = inFlight.current.get(cacheKey);
    if (existingPromise) return existingPromise;

    const promise = (async () => {
      // Call Edge Function to get audio URL (cached or generated)
      const { data, error } = await supabase.functions.invoke('whot-tts', {
        body: { text, voice }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const url: string | undefined = data?.url;
      if (url) {
        audioCache.current.set(cacheKey, url);
        warmAudio(url);
        return url;
      }
      return null;
    })();

    inFlight.current.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      inFlight.current.delete(cacheKey);
    }
  }, [warmAudio]);

  /**
   * Prefetch (and warm) a phrase so playback feels instant later.
   */
  const prefetch = useCallback(async (text: string, voice: Voice = 'Idera') => {
    if (!enabled) return;
    try {
      await getOrFetchAudioUrl(text, voice);
    } catch (err: unknown) {
      // Prefetch is best-effort; don't surface noisy errors.
      const message = err instanceof Error ? err.message : String(err);
      console.debug('YarnGPT prefetch failed:', message);
    }
  }, [enabled, getOrFetchAudioUrl]);

  /**
   * Preload audio for a list of phrases to ensure smooth playback during game
   */
  const preload = useCallback(async (phrases: string[], voice: Voice = 'Idera') => {
    if (!enabled) return;
    

    // Stagger requests to avoid 503 Timeouts/Rate Limits
    for (const text of phrases) {
      await prefetch(text, voice);
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }, [enabled, prefetch]);

  /**
   * Play TTS for the given text
   * @param text Text to speak
   * @param voice Voice ID (default: Idera)
   * @param dryRun If true, only caches the URL, doesn't play
   */
  const play = useCallback(async (text: string, voice: Voice = 'Idera', dryRun: boolean = false) => {
    if (!enabled && !dryRun) return;

    try {
      const audioUrl = await getOrFetchAudioUrl(text, voice);

      if (dryRun || !audioUrl) return;

      const audio = new Audio(audioUrl);
      setState(prev => ({ ...prev, isPlaying: true, error: null }));
      
      audio.onended = () => setState(prev => ({ ...prev, isPlaying: false }));
      audio.onerror = (e) => {
        console.error('Audio playback error', e);
        setState(prev => ({ ...prev, isPlaying: false, error: 'Playback failed' }));
      };

      await audio.play();

    } catch (err: unknown) {
      console.error('YarnGPT Error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setState(prev => ({ ...prev, error: message }));
    }
  }, [enabled, getOrFetchAudioUrl]);

  return {
    play,
    prefetch,
    preload,
    isPlaying: state.isPlaying,
    error: state.error
  };
}
