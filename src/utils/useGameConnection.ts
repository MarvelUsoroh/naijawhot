import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './supabase-client';
import { GameState, GameMessage, Card, CardShape } from '../types/game';

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
  fetchGameState: (roomCode: string) => Promise<void>;
  sendMessage: (message: GameMessage) => Promise<void>; // Basic broadcast
}

export function useGameConnection(roomCode: string | null, onMessage?: (msg: GameMessage) => void): GameConnection {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);

  const channelRef = useRef<any>(null);

  // Subscribe to Realtime Channel
  useEffect(() => {
    if (!roomCode) return;


    const channel = supabase.channel(`whot-${roomCode}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'game-message' }, (payload: { payload: GameMessage }) => {
        // console.log('[GameConn] Received:', payload.payload); // Verbose
        if (onMessage) onMessage(payload.payload);
        
        // Auto-update local state if it's a sync message
        if (payload.payload.type === 'state_sync' && payload.payload.gameState) {
          setGameState(payload.payload.gameState);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {

          setIsConnected(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[GameConn] Connection error:', status);
          setError(`Connection failed: ${status}`);
          setIsConnected(false);
        }
      });

    return () => {

      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [roomCode, onMessage]);

  // Edge Function Calls
  
  const startGame = useCallback(async (code: string, players: {id: string, name: string}[]) => {
    const { data, error } = await supabase.functions.invoke('whot-server', {
      body: { 
        // We probably need a 'router' in the function or different endpoints?
        // The implementation created /game/start, /game/play-card etc.
        // supabase-js `invoke` sends to the function root.
        // Hono handles routing. But invoke sends request to the root URL.
        // We need to ensure the URL matches Hono routes.
        // Usually invoke('whot-server') -> POST https://.../functions/v1/whot-server
        // Our Hono app has `app.post('/game/start', ...)`
        // So we might need to append path to the invoke URL? 
        // invoke does not easily support subpaths unless configured?
        // Actually, looking at docs: supabase.functions.invoke('whot-server', { headers: ... }) sends to root.
        // Hono routes are relative to function mount.
        // If function is mounted at `whot-server`, then `app.post('/game/start')` implies `whot-server/game/start`.
        // Standard Supabase functions don't really do sub-routing easily with `invoke` unless we pass the path in body or header to route internally?
        // Wait, Hono on Supabase Functions usually handles the full path.
        // If I call invoke('whot-server'), it hits the root. 
        // If I want /game/start, I might need to use `fetch` with the full URL, or tweak Hono.
        // Let's assume standard Hono routing:
        // We can pass the intent in the body?
        // OR better: Create a "router" helper or just use fetch?
        // Let's use `invoke` but maybe change the Hono setup to just handle logic based on "action" field?
        // I defined types with `action: 'join' | 'play' ...` in `types.ts` but implemented standard REST in `index.ts`.
        // Let's try to match the REST implementation:
        // Hono `app.post('/game/start')` expects `POST /game/start`.
        // Supabase `invoke` sends to `POST /`. 
        // Implementation might fail routing if Hono expects `/game/start`.
        // FIX: I will modify this hook to use `fetch` with constructed URL to be safe, OR wrap in a helper.
        // But `supabase.functions.invoke` conveniently handles auth.
        // Let's use invoke but we need to route.
        // Strategy: Modify Hono to use a single endpoint or use `c.req.path`? 
        // Actually, invoke supports passing custom headers/method.
        // But the PATH is the issue.
        // Let's stick to REST structure I wrote. To call it, maybe `invoke` isn't best?
        // Let's use `supabase.auth.getSession()` token + fetch?
        // Or simpler: Update `whot-server/index.ts` to standard "Action" pattern if deployment complicates routing? 
        // NO, standard REST is better.
        // Let's verify how to call subpaths.
        // We can append path to the function name? `invoke('whot-server/game/start')` ? No.
        // Let's assume the Hono router handles `/*` and we are sending to standard paths.
        // I will use `fetch` with the function URL for now to be precise.
      }
    });
    // Placeholder implementation below using fetch for clarity
  }, []);

  const invokeFunctions = async (endpoint: string, body: any) => {
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
    
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; // If using RLS or explicit Auth header
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    // Construct base URL
    const projectUrl = import.meta.env.VITE_SUPABASE_URL;
    const functionUrl = `${projectUrl}/functions/v1/whot-server${endpoint}`;

    const headers: any = {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${token || anonKey}` // Use session token if available, else anon
    };

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
       } catch (e) {
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
      if (!channelRef.current) throw new Error("No connection");
      await channelRef.current.send({
        type: 'broadcast',
        event: 'game-message',
        payload: {
           type: 'join', 
           playerId: playerId, 
           playerName,
           timestamp: Date.now()
        }
      });
      // But we should set playerId locally
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
      const res = await invokeFunctions('/game/get-hand', { roomCode, playerId });
      return res.hand;
    },
    sendMessage: async (msg) => {
       if (channelRef.current) {
         await channelRef.current.send({
            type: 'broadcast',
            event: 'game-message',
            payload: { ...msg, timestamp: Date.now() }
         });
       }
    },
    setReady: async (roomCode: string, playerId: string) => {
        await invokeFunctions('/game/ready', { roomCode, playerId });
    },
    fetchGameState: async (roomCode: string) => {
        try {
            const res = await invokeFunctions('/game/get-state', { roomCode });
            if (res.gameState) {
                setGameState(res.gameState);
            }
        } catch (e) {
            console.error('[GameConn] Failed to fetch game state:', e);
        }
    }
  };
}
