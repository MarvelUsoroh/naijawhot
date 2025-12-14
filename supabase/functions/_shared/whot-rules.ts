/**
 * Shared game rules for Naija Whot
 * Mirrored for Edge Function use
 */

import { Card, CardShape, CardNumber, GameState, Player } from './game-types.ts';

// Special Cards
export const SPECIAL_CARDS = {
  PICK_TWO: 2,
  PICK_THREE: 5,
  HOLD_ON: 1,
  SUSPENSION: 8,
  GENERAL_MARKET: 14,
  WHOT: 20,
} as const;

export function createDeck(): Card[] {
  const deck: Card[] = [];
  let id = 1;

  // Circles - 12 cards
  const circleNumbers: CardNumber[] = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14];
  circleNumbers.forEach(num => {
    deck.push({ id: `card-${id++}`, shape: 'circle', number: num });
  });

  // Triangles - 12 cards
  const triangleNumbers: CardNumber[] = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14];
  triangleNumbers.forEach(num => {
    deck.push({ id: `card-${id++}`, shape: 'triangle', number: num });
  });

  // Crosses - 9 cards
  const crossNumbers: CardNumber[] = [1, 2, 3, 5, 7, 10, 11, 13, 14];
  crossNumbers.forEach(num => {
    deck.push({ id: `card-${id++}`, shape: 'cross', number: num });
  });

  // Squares - 9 cards
  const squareNumbers: CardNumber[] = [1, 2, 3, 5, 7, 10, 11, 13, 14];
  squareNumbers.forEach(num => {
    deck.push({ id: `card-${id++}`, shape: 'square', number: num });
  });

  // Stars - 7 cards
  const starNumbers: CardNumber[] = [1, 2, 3, 4, 5, 7, 8];
  starNumbers.forEach(num => {
    deck.push({ id: `card-${id++}`, shape: 'star', number: num });
  });

  // Whot cards - 5 cards (all numbered 20)
  for (let i = 0; i < 5; i++) {
    deck.push({ id: `card-${id++}`, shape: 'circle', number: 20 });
  }

  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function canPlayCard(card: Card, currentCard: Card, selectedShape: CardShape | null): boolean {
  if (!currentCard) return true;
  
  if (card.number === 20) {
    return true;
  }

  if (currentCard.number === 20 && selectedShape) {
    return card.shape === selectedShape || (card.number as number) === 20;
  }

  return card.shape === currentCard.shape || card.number === currentCard.number;
}

export function getCardEffect(card: Card): {
  type: 'hold_on' | 'pick_two' | 'pick_three' | 'suspension' | 'general_market' | null;
  description: string;
} {
  switch (card.number) {
    case 1:
      return { type: 'hold_on', description: 'HOLD ON - Play again!' };
    case 2:
      return { type: 'pick_two', description: 'PICK TWO - Next player draws 2' };
    case 5:
      return { type: 'pick_three', description: 'PICK THREE - Next player draws 3' };
    case 8:
      return { type: 'suspension', description: 'SUSPENSION - Next player skips turn' };
    case 14:
      return { type: 'general_market', description: 'GENERAL MARKET - All others draw 1' };
    default:
      return { type: null, description: '' };
  }
}

export function getNextPlayerIndex(currentIndex: number, playerCount: number): number {
  return (currentIndex + 1) % playerCount;
}

export function dealCards(deck: Card[], playerCount: number, cardsPerPlayer: number = 6): {
  hands: Card[][];
  remainingDeck: Card[];
  startCard: Card;
} {
  const hands: Card[][] = [];
  let deckIndex = 0;

  for (let i = 0; i < playerCount; i++) {
    hands.push(deck.slice(deckIndex, deckIndex + cardsPerPlayer));
    deckIndex += cardsPerPlayer;
  }

  let startCard = deck[deckIndex];
  deckIndex++;

  while (startCard.number === 20 && deckIndex < deck.length) {
    startCard = deck[deckIndex];
    deckIndex++;
  }

  const remainingDeck = deck.slice(deckIndex);
  return { hands, remainingDeck, startCard };
}

export function mustDrawCards(state: GameState, playerId: string): number {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex !== state.currentPlayerIndex) return 0;

  if (state.effectActive === 'pick_two') {
    return state.pickTwoChain * 2;
  }
  if (state.effectActive === 'pick_three') {
    return state.pickThreeChain * 3;
  }
  return 0;
}

export function canDefendAgainstPick(card: Card, state: GameState): boolean {
  // STRICT RULE CHANGE: No Defense allowed.
  // Victim must always go to market.
  return false;
}

export function getPlayableCards(hand: Card[], currentCard: Card, selectedShape: CardShape | null, state: GameState): Card[] {
  // If Pick Two/Three is active against you, you CANNOT play any card.
  // You MUST draw.
  if (state.effectActive === 'pick_two' || state.effectActive === 'pick_three') {
     return [];
  }

  return hand.filter(card => {
    return canPlayCard(card, currentCard, selectedShape);
  });
}

export function applyCardEffect(
  state: GameState,
  card: Card,
  playerId: string
): GameState {
  const newState = { ...state };
  const effect = getCardEffect(card);
  const playerIndex = state.players.findIndex(p => p.id === playerId);

  switch (effect.type) {
    case 'hold_on':
      newState.lastAction = `${state.players[playerIndex].name} played HOLD ON!`;
      break;

    case 'pick_two':
      newState.pickTwoChain = (state.pickTwoChain || 0) + 1;
      newState.effectActive = 'pick_two';
      newState.lastAction = `${state.players[playerIndex].name} played PICK TWO!`;
      newState.currentPlayerIndex = getNextPlayerIndex(state.currentPlayerIndex, state.players.length);
      break;

    case 'pick_three':
      newState.pickThreeChain = (state.pickThreeChain || 0) + 1;
      newState.effectActive = 'pick_three';
      newState.lastAction = `${state.players[playerIndex].name} played PICK THREE!`;
      newState.currentPlayerIndex = getNextPlayerIndex(state.currentPlayerIndex, state.players.length);
      break;

    case 'suspension':
       newState.lastAction = `${state.players[playerIndex].name} played SUSPENSION!`;
       
       const skipCount = 1;

       // Skip players
       for(let i=0; i<skipCount; i++) {
           newState.currentPlayerIndex = getNextPlayerIndex(newState.currentPlayerIndex, state.players.length);
       }
       // Move to the player who actually plays
       newState.currentPlayerIndex = getNextPlayerIndex(newState.currentPlayerIndex, state.players.length);
       break;

    case 'general_market':
       newState.lastAction = `${state.players[playerIndex].name} played GENERAL MARKET!`;
       newState.effectActive = 'general_market'; 
       
       // Setup Manual Draw
       newState.generalMarketInitiator = playerId; // Remember who played it
       // List of all OTHER players
       newState.marketDue = state.players
           .filter(p => p.id !== playerId)
           .map(p => p.id);
           
       // Pass turn to the first person who needs to draw
       if (newState.marketDue.length > 0) {
           const nextPlayerId = newState.marketDue[0];
           newState.currentPlayerIndex = state.players.findIndex(p => p.id === nextPlayerId);
       }
       break;

    default:
       newState.lastAction = `${state.players[playerIndex].name} played ${card.shape} ${card.number}`;
       newState.currentPlayerIndex = getNextPlayerIndex(state.currentPlayerIndex, state.players.length);
       // Clear chains if normal card played (and not defending)
       if (!state.effectActive) {
         newState.pickTwoChain = 0;
         newState.pickThreeChain = 0;
       }
       break;
  }

  return newState;
}

export function calculateScore(hand: Card[]): number {
    return hand.reduce((total, card) => {
        let value = card.number as number;
        if (card.shape === 'star') {
            value = value * 2;
        }
        if (card.number === 20) {
            value = 20;
        }
        return total + value;
    }, 0);
}
