export type CardShape = 'circle' | 'square' | 'triangle' | 'star' | 'cross';
export type CardNumber = 1 | 2 | 3 | 4 | 5 | 7 | 8 | 10 | 11 | 12 | 13 | 14 | 20;

// Configurable game rules
export interface GameRules {
  pickTwo: boolean;        // Card 2 forces next player to pick 2 (default: true)
  pickThree: boolean;      // Card 5 forces next player to pick 3 (default: false)
  defendPick: boolean;     // Can counter Pick 2/3 with another Pick 2/3 (default: false)
  winWithHoldOn: boolean;  // Can win by playing Hold On (1) as last card (default: false)
}

// Default rules configuration
export const DEFAULT_RULES: GameRules = {
  pickTwo: true,
  pickThree: false,
  defendPick: false,
  winWithHoldOn: false,
};

export interface Card {
  id: string;
  shape: CardShape;
  number: CardNumber;
}

export interface Player {
  id: string;
  name: string;
  cardCount: number;
  isHost: boolean;
  hand?: Card[]; // Full hand for the player themselves
  mustPick?: number; // Cards to pick due to Pick Two/Pick Three chain
  suspended?: boolean; // Skipped due to Suspension
  isReady?: boolean; // For "Play Again" synchronization
}

export interface GameState {
  roomCode: string;
  players: Player[];
  currentCard: Card | null;
  currentPlayerIndex: number;
  direction: number; // 1 for clockwise, -1 for counter-clockwise
  selectedShape: CardShape | null; // For Whot card (20)
  lastAction: string;
  gameStarted: boolean;
  winner: string | null;
  deckCount: number;
  // Special card effects
  pickTwoChain: number; // Number of consecutive Pick Two cards played
  pickThreeChain: number; // Number of consecutive Pick Three cards played
  effectActive: 'pick_two' | 'pick_three' | 'suspension' | 'general_market' | null;
  generalMarketInitiator?: string;
  marketDue?: string[];
  // GAME MASTER ARCHITECTURE: Server-managed deck and hands
  marketPile: Card[]; // Remaining cards in the deck (draw pile)
  discardPile: Card[]; // Cards that have been played
  playerHands: Record<string, Card[]>; // Map of playerId -> their private hand
  sessionWins?: Record<string, number>; // Wins per player during room session
  // Configurable rules (set before first action, immutable after)
  rules: GameRules;
  rulesLocked: boolean; // True after first card is played
  totalTurns: number; // Track turns for rules locking
  // Turn timer
  turnStartTime?: number; // Timestamp when current turn started
}

export interface GameMessage {
  type: 'player_joined' | 'player_left' | 'card_played' | 'game_started' | 'shape_selected' | 'turn_changed' | 'cards_drawn' | 'special_effect' | 'deal' | 'state_sync' | 'join' | 'play' | 'draw' | 'chat_message' | 'activate_chat' | 'toggle_chat' | 'toggle_mute' | 'mute_status' | 'rules_update';
  playerId: string;
  playerName?: string;
  card?: Card;
  cards?: Card[];
  gameState?: GameState;
  count?: number;
  shape?: CardShape;
  cardsDrawn?: number;
  effect?: string;
  message?: string; // For chat messages
  rules?: Partial<GameRules>; // For rules updates
  timestamp?: number; // Auto-added by sendMessage
}