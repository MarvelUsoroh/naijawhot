import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './supabase-client';
import { GameState, GameMessage, Card, CardShape } from '../types/game';
import type { RealtimeChannel } from '@supabase/supabase-js';

type BroadcastEnvelope = {
  type: 'broadcast';
  event: 'game-message';
  payload: GameMessage;
};

interface GameConnection {
  isConnected: boolean;
  error: string | null;
  gameState: GameState | null;
  playerId: string | null;
  joinGame: (roomCode: string, playerName: string, playerId: string) => Promise<void>;
  startGame: (roomCode: string, players: {id: string, name: string}[]) => Promise<void>;
  playCard: (roomCode: string, playerId: string, card: Card, selectedShape?: CardShape | null) => Promise<void>;
  drawCard: (roomCode: string, playerId: string) => Promise<void>;
  getHand: (roomCode: string, playerId: string) => Promise<Card[]>;
  setReady: (roomCode: string, playerId: string) => Promise<void>;
  fetchGameState: (roomCode: string) => Promise<GameState | null>;
  sendMessage: (message: GameMessage) => Promise<void>; // Basic broadcast
}

export function useGameConnection(roomCode: string | null, onMessage?: (msg: GameMessage) => void): GameConnection {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef(false);
  const pendingBroadcastsRef = useRef<BroadcastEnvelope[]>([]);
  const accessTokenRef = useRef<string | null>(null);
  const lastGameStateTimestampRef = useRef<number>(0);

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!isMounted) return;
        accessTokenRef.current = session?.access_token ?? null;
      })
      .catch(() => {
        // Ignore session lookup failures; fall back to anon key
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      accessTokenRef.current = session?.access_token ?? null;
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const sendBroadcast = useCallback(async (payload: GameMessage) => {
    const channel = channelRef.current;
    if (!channel) throw new Error('No connection');

    const envelope: BroadcastEnvelope = {
      type: 'broadcast',
      event: 'game-message',
      payload,
    };

    if (isSubscribedRef.current) {
      await channel.send(envelope);
      return;
    }

    pendingBroadcastsRef.current.push(envelope);
  }, []);

  // Subscribe to Realtime Channel
  useEffect(() => {
    if (!roomCode) return;


    isSubscribedRef.current = false;
    pendingBroadcastsRef.current = [];
    const channel = supabase.channel(`whot-${roomCode}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'game-message' }, (payload: { payload: GameMessage }) => {
        // console.log('[GameConn] Received:', payload.payload); // Verbose
        if (onMessage) onMessage(payload.payload);
        
        // Auto-update local state whenever a message carries a full game state.
        // This avoids controller desync when a client misses a `state_sync` but receives
        // another message (e.g. `card_played`) that still contains `gameState`.
        // Use timestamp to prevent out-of-order updates from overwriting newer state.
        if (payload.payload.gameState) {
          const incomingTs = payload.payload.timestamp;

          if (typeof incomingTs === 'number' && incomingTs > 0) {
            if (incomingTs < lastGameStateTimestampRef.current) return;
            lastGameStateTimestampRef.current = incomingTs;
          }

          setGameState(payload.payload.gameState);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          isSubscribedRef.current = true;
          setIsConnected(true);

          const channel = channelRef.current;
          const queued = pendingBroadcastsRef.current;
          pendingBroadcastsRef.current = [];

          if (channel && queued.length > 0) {
            (async () => {
              for (const msg of queued) {
                await channel.send(msg);
              }
            })().catch((e) => {
              console.error('[GameConn] Failed to flush queued broadcasts:', e);
            });
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[GameConn] Connection error:', status);
          setError(`Connection failed: ${status}`);
          setIsConnected(false);
          isSubscribedRef.current = false;
        }
      });

    return () => {

      isSubscribedRef.current = false;
      pendingBroadcastsRef.current = [];
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [roomCode, onMessage]);

  // Edge Function Calls
  const invokeFunctions = async (endpoint: string, body: Record<string, unknown>) => {
    // Get function URL
    // In local dev: http://localhost:54321/functions/v1/whot-server/...
    // In prod: https://[project].supabase.co/functions/v1/whot-server/...
    
    // We can rely on supabase-js to get the base URL?
    // supabase.functions.getUrl('whot-server') is available in newer versions?
    // If not, we construct it.
    
    // Let's try to use `invoke` but modify the server to handle `/` with action dispatch?
    // Re-reading my server code: `app.post("/game/start", ...)`
    // This expects the path.
    // It's safer to use `fetch` with the session token.
    
    const token = accessTokenRef.current; // Avoid per-request session lookup
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const functionRegion = import.meta.env.VITE_SUPABASE_FUNCTION_REGION as string | undefined;
    
    // Construct base URL
    const projectUrl = import.meta.env.VITE_SUPABASE_URL;
    const functionUrl = `${projectUrl}/functions/v1/whot-server${endpoint}`;

     const headers: Record<string, string> = {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${token || anonKey}`, // Use session token if available, else anon
    };

    if (functionRegion) {
      headers['x-region'] = functionRegion;
    }

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
       let errorMessage = 'Server error';
       try {
          const err = await response.json();
          errorMessage = err.error || errorMessage;
       } catch {
          // If not JSON, use status text or raw text
          const text = await response.text();
          errorMessage = text || `Error ${response.status}: ${response.statusText}`;
       }
       throw new Error(errorMessage);
    }

    return await response.json();
  };

  return {
    isConnected,
    error,
    gameState,
    playerId,
    joinGame: async (roomCode, playerName, playerId) => {
      // Just set local state, presence handled via interactions or explicit join?
      // POC: Join via subscribing to channel + sending 'join' message
      // But server needs to know?
      // My server `game/start` initializes players from the request body?
      // Ah, the server `start` takes a list of players.
      // So players "join" by signaling the host?
      // Yes, Host collects "join" messages via Realtime, then sends the list to `game/start`.
      // So `joinGame` is just a Realtime broadcast.
      await sendBroadcast({
        type: 'join',
        playerId: playerId,
        playerName,
        timestamp: Date.now()
      });
      setPlayerId(playerId);
    },
    startGame: async (roomCode, players) => {
      await invokeFunctions('/game/start', { roomCode, players });
    },
    playCard: async (roomCode, playerId, card, selectedShape) => {
      await invokeFunctions('/game/play-card', { roomCode, playerId, card, selectedShape });
    },
    drawCard: async (roomCode, playerId) => {
      await invokeFunctions('/game/draw', { roomCode, playerId });
    },
    getHand: async (roomCode, playerId) => {
      const res = (await invokeFunctions('/game/get-hand', { roomCode, playerId })) as { hand: Card[] };
      return res.hand;
    },
    sendMessage: async (msg) => {
       if (!channelRef.current) return;
       await sendBroadcast({ ...msg, timestamp: Date.now() });
    },
    setReady: async (roomCode: string, playerId: string) => {
        await invokeFunctions('/game/ready', { roomCode, playerId });
    },
    fetchGameState: async (roomCode: string) => {
        try {
        const res = (await invokeFunctions('/game/get-state', { roomCode })) as { gameState?: GameState };
        const fetched = res.gameState ?? null;
        if (fetched) setGameState(fetched);
        return fetched;
        } catch (e) {
            console.error('[GameConn] Failed to fetch game state:', e);
            return null;
        }
    }
  };
}
