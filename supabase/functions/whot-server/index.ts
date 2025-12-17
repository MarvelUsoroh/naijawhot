import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { GameState, GameMessage, Card, Player } from "../_shared/game-types.ts";
import { 
  createDeck, 
  dealCards, 
  canPlayCard, 
  shuffleDeck, 
  applyCardEffect, 
  mustDrawCards, 
  canDefendAgainstPick, 
  getPlayableCards,
  getCardEffect,
  calculateScore,
  createInitialGameState
} from "../_shared/whot-rules.ts";

// Force rebuild: 2025-12-14T19:00

const app = new Hono();

// Explicit CORS Config
app.use("*", cors({
  origin: '*',
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-client-info', 'apikey']
}));

// Initialize Supabase Client
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// HELPER FUNCTIONS
// ==========================================

async function getGameState(roomCode: string): Promise<GameState | null> {
  const { data, error } = await supabase
    .from("rooms")
    .select("game_state")
    .eq("room_code", roomCode)
    .single();
  
  if (error || !data) return null;
  return data.game_state as GameState;
}

async function saveGameState(roomCode: string, state: GameState) {
  const { error } = await supabase
    .from("rooms")
    .upsert({ room_code: roomCode, game_state: state })
    .select();
  
  if (error) throw error;
}

async function broadcast(roomCode: string, event: string, payload: any) {
  // Use RPC to call the database function that inserts into realtime.messages
  const { error } = await supabase.rpc("broadcast_message", {
    p_topic: `whot-${roomCode}`,
    p_event: event,
    p_payload: {
      ...payload,
      timestamp: Date.now(),
    },
  });
  
  if (error) {
    console.error("Broadcast RPC error:", error);
    throw error;
  }
}

// ==========================================
// ANALYTICS LOGGING (Fire-and-forget)
// ==========================================

// Create or get game session for a room
async function getOrCreateSession(roomCode: string): Promise<string | null> {
  try {
    // Check for existing active session
    const { data: existing } = await supabase
      .from("game_sessions")
      .select("id")
      .eq("room_code", roomCode)
      .is("ended_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    
    if (existing) return existing.id;
    
    // Create new session
    const { data: newSession, error } = await supabase
      .from("game_sessions")
      .insert({ room_code: roomCode, player_count: 0 })
      .select("id")
      .single();
    
    if (error) {
      console.error("Analytics: Failed to create session", error);
      return null;
    }
    return newSession.id;
  } catch (e) {
    console.error("Analytics: Session error", e);
    return null;
  }
}

// Log player event (fire-and-forget - don't await this)
function logPlayerEvent(
  roomCode: string, 
  playerId: string, 
  playerName: string | undefined, 
  eventType: string, 
  metadata?: any
) {
  // Fire-and-forget - no await
  supabase
    .from("player_events")
    .insert({
      room_code: roomCode,
      player_id: playerId,
      player_name: playerName || "Unknown",
      event_type: eventType,
      metadata: metadata || null
    })
    .then(({ error }) => {
      if (error) console.error("Analytics: Event log failed", error);
    });
}

// Update game session
function updateSession(roomCode: string, updates: Record<string, any>) {
  supabase
    .from("game_sessions")
    .update(updates)
    .eq("room_code", roomCode)
    .is("ended_at", null)
    .then(({ error }) => {
      if (error) console.error("Analytics: Session update failed", error);
    });
}

// ==========================================
// ROUTES (Using wildcard prefix for flexibility)
// ==========================================

app.post("*/game/start", async (c) => {
  try {
    const { roomCode, players } = await c.req.json();
    
    if (!roomCode || !players || players.length < 2) {
      return c.json({ error: "Invalid room code or not enough players" }, 400);
    }

    // Create new Game State
    const initialState = createInitialGameState(roomCode, players);

    // Save to DB
    await saveGameState(roomCode, initialState);

    // Broadcast public state
    await broadcast(roomCode, "game-message", {
      type: "state_sync",
      playerId: "server",
      gameState: {
        ...initialState,
        playerHands: {}, // Hide hands in public state sync
        marketPile: [], // Hide market
      }
    });

    // Send deal messages (one per player) - Clients will listen
    for (const player of initialState.players) {
      await broadcast(roomCode, "game-message", {
        type: "deal",
        playerId: player.id,
        cards: initialState.playerHands[player.id],
        gameState: {
            ...initialState,
            playerHands: {},
            marketPile: []
        }
      });
    }

    // Analytics: Create session and log game start (fire-and-forget)
    getOrCreateSession(roomCode).then(() => {
      updateSession(roomCode, { 
        started_at: new Date().toISOString(), 
        player_count: players.length 
      });
      for (const player of initialState.players) {
        logPlayerEvent(roomCode, player.id, player.name, 'join');
      }
    });

    return c.json({ success: true, state: initialState });
  } catch (error) {
    console.error("Start error:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("*/game/play-card", async (c) => {
  try {
    const { roomCode, playerId, card, selectedShape } = await c.req.json();
    
    // Fetch State
    const state = await getGameState(roomCode);
    if (!state) return c.json({ error: "Game not found" }, 404);
    if (state.winner) return c.json({ error: "Game is over" }, 400);

    const playerIndex = state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return c.json({ error: "Player not found" }, 404);
    
    // Validate Turn
    if (playerIndex !== state.currentPlayerIndex) {
      return c.json({ error: "Not your turn" }, 400);
    }

    // Fetch Hand
    const hand = state.playerHands[playerId] || [];
    const cardInHand = hand.find(c => c.id === card.id);
    
    if (!cardInHand) {
        return c.json({ error: "Card not in hand" }, 400);
    }

    // Validate Move Rules strictly
    const isValid = canPlayCard(card, state.currentCard!, state.selectedShape);
    
    // Check for Effect Restrictions (Pick Two/Three CANNOT be defended anymore)
    if (state.effectActive === 'pick_two' || state.effectActive === 'pick_three') {
       // If Pick Effect is active, player MUST draw. They cannot play ANY card.
       // The exception is handled by the 'draw' endpoint.
       // So if they try to play a card here, it's ILLEGAL immediately.
       return c.json({ error: "Must draw cards (Market Penalties active)" }, 400);
    }

    if (!isValid) {
      return c.json({ error: "Invalid move: Card does not match shape or number" }, 400);
    }

    // Everything OK - Apply Move
    // Remove card
    state.playerHands[playerId] = hand.filter(c => c.id !== card.id);
    state.players[playerIndex].cardCount = state.playerHands[playerId].length;
    
    // Update State (Effect, Turn, piles)
    state.currentCard = card;
    state.discardPile.push(card);
    if (selectedShape) state.selectedShape = selectedShape; // Handle Whot shape selection
    else state.selectedShape = null;

    // Apply Effects & Next Turn
    const updatedState = applyCardEffect(state, card, playerId);

    // GENERAL MARKET: Initialize Manual Queue
    if (updatedState.effectActive === 'general_market') {
        const opponents = updatedState.players.filter(p => p.id !== playerId);
        updatedState.marketDue = opponents.map(p => p.id);
        updatedState.generalMarketInitiator = playerId;
        
        // Pass turn to first victim
        if (updatedState.marketDue.length > 0) {
            const firstVictimId = updatedState.marketDue[0];
            const firstVictimIndex = updatedState.players.findIndex(p => p.id === firstVictimId);
            if (firstVictimIndex !== -1) updatedState.currentPlayerIndex = firstVictimIndex;
            
            updatedState.lastAction = `${updatedState.players[playerIndex].name} played General Market!`;
        } else {
            // No opponents? Should not happen in MP, but reset if so
            updatedState.effectActive = null;
        }
    }

    // Check Card Counts & Winner
    const remainingCards = updatedState.playerHands[playerId].length;
    const playerName = updatedState.players[playerIndex].name;

    if (remainingCards === 0) {
      updatedState.winner = playerId;
      
      // Calculate Scores
      const scores = updatedState.players.map(p => {
          const score = calculateScore(updatedState.playerHands[p.id] || []);
          return `${p.name}: ${score}`;
      }).join(', ');
      
      updatedState.lastAction = `Final Scores: ${scores}`;
      updatedState.gameStarted = false;
      
      // Analytics: Log win and end session (fire-and-forget)
      logPlayerEvent(roomCode, playerId, playerName, 'win', { scores });
      updateSession(roomCode, { 
        ended_at: new Date().toISOString(), 
        winner_id: playerId, 
        winner_name: playerName 
      });
    } else if (remainingCards === 1) {
        // Last Card Warning
        updatedState.lastAction = `${playerName} is on last card!`;
    } else if (remainingCards === 2) {
        // Two Cards Warning
        updatedState.lastAction = `Warning, ${playerName} has two cards left!`;
    }
    
    // Analytics: Log card play (fire-and-forget)
    logPlayerEvent(roomCode, playerId, playerName, 'play_card', { 
      card: card, 
      shape: selectedShape 
    });

    // Parallelize Save and Broadcast for lower latency
    const publicState = {
        ...updatedState,
        playerHands: {}, // Security: Don't leak hands
        marketPile: [],
    };

    const savePromise = saveGameState(roomCode, updatedState);
    const broadcastPromise = broadcast(roomCode, "game-message", {
      type: "card_played",
      playerId,
      card: card,
      selectedShape: selectedShape,
      gameState: publicState
    });

    await Promise.all([savePromise, broadcastPromise]);
    
    // Sync state for everyone
    await broadcast(roomCode, "game-message", {
        type: "state_sync",
        playerId: "server",
        gameState: publicState
    });

    return c.json({ success: true, state: publicState });

  } catch (error) {
    console.error("Play error:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Event: Player Ready for Next Game
app.post("*/game/ready", async (c) => {
    try {
      const { roomCode, playerId } = await c.req.json();
      const state = await getGameState(roomCode);
      if (!state) return c.json({ error: "Game not found" }, 404);
      
      const playerIndex = state.players.findIndex(p => p.id === playerId);
      if (playerIndex !== -1) {
          state.players[playerIndex].isReady = true;
          
          await saveGameState(roomCode, state);
          await broadcast(roomCode, "game-message", {
              type: "state_sync",
              playerId: "server",
              gameState: state
          });
      }
      return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

app.post("*/game/draw", async (c) => {
    try {
      const { roomCode, playerId } = await c.req.json();
     
      const state = await getGameState(roomCode);
      if (!state) return c.json({ error: "Game not found" }, 404);
      
      const playerIndex = state.players.findIndex(p => p.id === playerId);
      if (playerIndex !== state.currentPlayerIndex) {
        return c.json({ error: "Not your turn" }, 400);
      }
  
      // Calculate how many to draw
      let drawCount = 1;
      if (state.effectActive === 'pick_two') drawCount = state.pickTwoChain * 2;
      else if (state.effectActive === 'pick_three') drawCount = state.pickThreeChain * 3;
      else if (state.effectActive === 'general_market') drawCount = 1; // Logic for GM is diff, handled usually by everyone drawing. simpler to handle singular draw for now?
      // For General Market, all players usually draw immediately.
      // But let's stick to simple "Draw" action for current player turn or penalty.
  
      // Draw cards
      const drawnCards: Card[] = [];
      for(let i=0; i<drawCount; i++) {
        if (state.marketPile.length === 0) {
            // Refill from discard
            if (state.discardPile.length > 1) {
                const topCard = state.discardPile.pop()!;
                const cardsToRecycle = [...state.discardPile];
                state.marketPile = shuffleDeck(cardsToRecycle);
                state.discardPile = [topCard];
                state.lastAction += " (Market Refilled)";
            } else {
                break; // Truly empty
            }
        }
        
        if (state.marketPile.length > 0) {
            drawnCards.push(state.marketPile.shift()!);
        }
      }
      
      // Update Hand
      state.playerHands[playerId] = [...(state.playerHands[playerId] || []), ...drawnCards];
      state.players[playerIndex].cardCount = state.playerHands[playerId].length;
  
      // Reset Effects ONLY if standard draw
      // If General Market, we handle differently
      if (state.effectActive === 'general_market') {
          // Remove from pending list
          state.marketDue = state.marketDue?.filter(id => id !== playerId) || [];
          
          if (state.marketDue.length === 0) {
              // All done! Return turn to initiator
              const initiatorIndex = state.players.findIndex(p => p.id === state.generalMarketInitiator);
              if (initiatorIndex !== -1) {
                  state.currentPlayerIndex = initiatorIndex;
                  state.lastAction = "Market Cleaned! Back to " + state.players[initiatorIndex].name;
              }
              state.effectActive = null;
              state.generalMarketInitiator = undefined;
          } else {
              // Next victim
              const nextId = state.marketDue[0];
              const nextIndex = state.players.findIndex(p => p.id === nextId);
              if (nextIndex !== -1) state.currentPlayerIndex = nextIndex;
              state.lastAction = `${state.players[playerIndex].name} drew. Waiting for ${state.players[state.currentPlayerIndex].name}`;
          }
      } else {
          // Standard Draw or Penalty Draw
          state.effectActive = null;
          state.pickTwoChain = 0;
          state.pickThreeChain = 0;
          
          // Draw usually passes turn
          state.currentPlayerIndex = (state.currentPlayerIndex + state.direction + state.players.length) % state.players.length;
      }
      
      state.deckCount = state.marketPile.length;
      if (!state.effectActive) {
          state.lastAction = `${state.players[playerIndex].name} picked ${drawnCards.length} cards`; 
      } 
  
      // Parallelize Save and Broadcasts
      const savePromise = saveGameState(roomCode, state);

      // Broadcast private deal to player
      const privateBroadcastPromise = broadcast(roomCode, "game-message", {
        type: "draw",
        playerId,
        count: drawnCards.length,
        cards: drawnCards 
      });

      // Broadcast public update
      const publicState = { ...state, playerHands: {}, marketPile: [] };
      const publicBroadcastPromise = broadcast(roomCode, "game-message", {
          type: "state_sync",
          playerId: "server",
          gameState: publicState
      });

      await Promise.all([savePromise, privateBroadcastPromise, publicBroadcastPromise]);
      
      // Analytics: Log draw (fire-and-forget)
      logPlayerEvent(roomCode, playerId, state.players[playerIndex].name, 'draw', { 
        count: drawnCards.length 
      });
  
      return c.json({ success: true, cards: drawnCards });
    } catch (error) {
      return c.json({ error: error.message }, 500);
    }
});

app.post("*/game/get-hand", async (c) => {
    try {
        const { roomCode, playerId } = await c.req.json();
        const state = await getGameState(roomCode);
        if (!state) return c.json({ error: "Game not found" }, 404);
        
        const hand = state.playerHands[playerId] || [];
        return c.json({ hand });
    } catch(e) {
        return c.json({error: e.message}, 500);
    }
});

// Get Game State (for Reconnection)
app.post("*/game/get-state", async (c) => {
    try {
        const { roomCode } = await c.req.json();
        const state = await getGameState(roomCode);
        if (!state) return c.json({ error: "Game not found" }, 404);
        
        // Return public state (hide hands and market)
        const publicState = {
            ...state,
            playerHands: {},
            marketPile: []
        };
        return c.json({ gameState: publicState });
    } catch(e) {
        return c.json({error: e.message}, 500);
    }
});
app.notFound((c: any) => {
  return c.json({ 
    error: `Route not found: ${c.req.path}`, 
    method: c.req.method,
    debug: "Using wildcard routing"
  }, 404);
});

Deno.serve(app.fetch);
