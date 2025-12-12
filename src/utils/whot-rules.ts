import { Card, CardShape, CardNumber, GameState, Player } from '../types/game';

/**
 * Nigerian Whot Card Composition (54 cards total)
 * Circles: 1,2,3,4,5,7,8,10,11,12,13,14 (12 cards)
 * Triangles: 1,2,3,4,5,7,8,10,11,12,13,14 (12 cards)
 * Crosses: 1,2,3,5,7,10,11,13,14 (9 cards)
 * Squares: 1,2,3,5,7,10,11,13,14 (9 cards)
 * Stars: 1,2,3,4,5,7,8 (7 cards)
 * Whot: 20 (5 cards)
 */
export function createWhotDeck(): Card[] {
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
    deck.push({ id: `card-${id++}`, shape: 'circle', number: 20 }); // Whot cards use circle as placeholder
  }

  return shuffleDeck(deck);
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Check if a card can be played on top of the current card
 */
export function canPlayCard(card: Card, currentCard: Card, selectedShape: CardShape | null): boolean {
  // Whot (20) can always be played
  if (card.number === 20) {
    return true;
  }

  // If previous card was a Whot, match the selected shape
  if (currentCard.number === 20 && selectedShape) {
    return card.shape === selectedShape || (card.number as number) === 20;
  }

  // Match by shape or number
  return card.shape === currentCard.shape || card.number === currentCard.number;
}

/**
 * Get special card effect
 */
export function getCardEffect(card: Card): {
  type: 'hold_on' | 'pick_two' | 'pick_three' | 'suspension' | 'general_market' | null;
  description: string;
} {
  switch (card.number) {
    case 1:
      return {
        type: 'hold_on',
        description: 'HOLD ON - Play again!'
      };
    case 2:
      return {
        type: 'pick_two',
        description: 'PICK TWO - Next player draws 2 or plays another 2'
      };
    case 5:
      return {
        type: 'pick_three',
        description: 'PICK THREE - Next player draws 3 or plays another 5'
      };
    case 8:
      return {
        type: 'suspension',
        description: card.shape === 'star' ? 'SUSPENSION - Next 2 players skip turn' : 'SUSPENSION - Next player skips turn'
      };
    case 14:
      return {
        type: 'general_market',
        description: 'GENERAL MARKET - All other players draw 1 card'
      };
    default:
      return { type: null, description: '' };
  }
}

/**
 * Apply special card effect to game state
 */
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
      // Player plays again - don't advance turn
      newState.lastAction = `${state.players[playerIndex].name} played HOLD ON! Plays again...`;
      // currentPlayerIndex stays the same
      break;

    case 'pick_two':
      // Start or continue Pick Two chain
      newState.pickTwoChain = (state.pickTwoChain || 0) + 1;
      newState.effectActive = 'pick_two';
      newState.lastAction = `${state.players[playerIndex].name} played PICK TWO! (${newState.pickTwoChain * 2} cards)`;
      // Advance turn to next player
      newState.currentPlayerIndex = getNextPlayerIndex(state.currentPlayerIndex, state.players.length);
      break;

    case 'pick_three':
      // Start or continue Pick Three chain
      newState.pickThreeChain = (state.pickThreeChain || 0) + 1;
      newState.effectActive = 'pick_three';
      newState.lastAction = `${state.players[playerIndex].name} played PICK THREE! (${newState.pickThreeChain * 3} cards)`;
      // Advance turn to next player
      newState.currentPlayerIndex = getNextPlayerIndex(state.currentPlayerIndex, state.players.length);
      break;

    case 'suspension':
      const skips = card.shape === 'star' ? 2 : 1;
      newState.lastAction = `${state.players[playerIndex].name} played SUSPENSION! Next ${skips} player${skips > 1 ? 's' : ''} skip turn`;
      // Skip the appropriate number of players
      newState.currentPlayerIndex = state.currentPlayerIndex;
      for (let i = 0; i < skips + 1; i++) {
        newState.currentPlayerIndex = getNextPlayerIndex(newState.currentPlayerIndex, state.players.length);
      }
      break;

    case 'general_market':
      newState.lastAction = `${state.players[playerIndex].name} played GENERAL MARKET! All others draw 1 card`;
      // Turn does NOT pass - player who played 14 plays again after opponents draw
      break;

    default:
      // Normal card - just advance turn
      newState.lastAction = `${state.players[playerIndex].name} played ${card.shape.toUpperCase()} ${card.number}`;
      newState.currentPlayerIndex = getNextPlayerIndex(state.currentPlayerIndex, state.players.length);
      // Clear any pick chains
      newState.pickTwoChain = 0;
      newState.pickThreeChain = 0;
      newState.effectActive = null;
      break;
  }

  return newState;
}

/**
 * Get the next player index, skipping any suspended players
 */
export function getNextPlayerIndex(currentIndex: number, playerCount: number): number {
  return (currentIndex + 1) % playerCount;
}

/**
 * Deal cards to players from deck
 */
export function dealCards(deck: Card[], playerCount: number, cardsPerPlayer: number = 6): {
  hands: Card[][];
  remainingDeck: Card[];
  startCard: Card;
} {
  const hands: Card[][] = [];
  let deckIndex = 0;

  // Deal cards to each player
  for (let i = 0; i < playerCount; i++) {
    hands.push(deck.slice(deckIndex, deckIndex + cardsPerPlayer));
    deckIndex += cardsPerPlayer;
  }

  // Get start card (skip special cards if possible)
  let startCard = deck[deckIndex];
  deckIndex++;

  // Try to avoid starting with special cards
  while (startCard.number === 20 && deckIndex < deck.length) {
    startCard = deck[deckIndex];
    deckIndex++;
  }

  const remainingDeck = deck.slice(deckIndex);

  return { hands, remainingDeck, startCard };
}

/**
 * Check if player must draw cards due to Pick Two/Three
 */
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

/**
 * Check if player can defend against Pick Two/Three with their own
 */
export function canDefendAgainstPick(card: Card, state: GameState): boolean {
  if (state.effectActive === 'pick_two' && card.number === 2) {
    return true;
  }
  if (state.effectActive === 'pick_three' && card.number === 5) {
    return true;
  }
  return false;
}

/**
 * Get playable cards from hand
 */
export function getPlayableCards(hand: Card[], currentCard: Card, selectedShape: CardShape | null, state: GameState): Card[] {
  return hand.filter(card => {
    // If there's a Pick Two/Three effect, can only play the same number or draw
    if (state.effectActive === 'pick_two' || state.effectActive === 'pick_three') {
      return canDefendAgainstPick(card, state); // Strictly enforce defense (only 2s or 5s)
    }
    
    return canPlayCard(card, currentCard, selectedShape);
  });
}

/**
 * Calculate penalty points for remaining cards
 */
export function calculatePenalty(hand: Card[]): number {
  return hand.reduce((total, card) => {
    if (card.number === 20) return total + 20; // Whot
    if (card.shape === 'star') return total + (card.number * 2); // Stars count double
    return total + card.number;
  }, 0);
}
