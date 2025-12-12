/**
 * Shared types for Naija Whot
 * These types are mirrored from src/types/game.ts to be available in Edge Functions (Deno)
 */

export type CardShape = 'circle' | 'square' | 'triangle' | 'star' | 'cross';
export type CardNumber = 1 | 2 | 3 | 4 | 5 | 7 | 8 | 10 | 11 | 12 | 13 | 14 | 20;

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
  // Specific tracking for General Market
  generalMarketInitiator?: string; // Player ID who played the 14
  marketDue?: string[]; // List of Player IDs who need to draw
  // GAME MASTER ARCHITECTURE: Server-managed deck and hands
  marketPile: Card[]; // Remaining cards in the deck (draw pile)
  discardPile: Card[]; // Cards that have been played
  playerHands: Record<string, Card[]>; // Map of playerId -> their private hand
}

export interface GameMessage {
  type: 'player_joined' | 'player_left' | 'card_played' | 'game_started' | 'shape_selected' | 'turn_changed' | 'cards_drawn' | 'special_effect' | 'deal' | 'state_sync' | 'join' | 'play' | 'draw';
  playerId: string;
  playerName?: string;
  card?: Card;
  cards?: Card[];
  gameState?: GameState;
  count?: number;
  shape?: CardShape;
  cardsDrawn?: number;
  effect?: string;
  timestamp: number;
}
