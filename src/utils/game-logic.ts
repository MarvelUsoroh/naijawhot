import { Card, CardShape, CardNumber } from '../types/game';

const SHAPES: CardShape[] = ['circle', 'square', 'triangle', 'star', 'cross'];
const NUMBERS: CardNumber[] = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14, 20];

export const SPECIAL_CARDS = {
  PICK_TWO: 2,
  PICK_THREE: 5,
  HOLD_ON: 1,
  GENERAL_MARKET: 14,
  WHOT: 20,
} as const;

export function createDeck(): Card[] {
  const deck: Card[] = [];
  let id = 0;

  SHAPES.forEach(shape => {
    NUMBERS.forEach(number => {
      const count = number === 20 ? 1 : 2;
      for (let i = 0; i < count; i++) {
        deck.push({ id: `${id++}`, shape, number });
      }
    });
  });

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

export function canPlayCard(card: Card, currentCard: Card | null, selectedShape: CardShape | null): boolean {
  if (!currentCard) return false;
  if (card.number === SPECIAL_CARDS.WHOT) return true;
  if (selectedShape) {
    return card.shape === selectedShape || card.number === currentCard.number;
  }
  return card.shape === currentCard.shape || card.number === currentCard.number;
}

export function generateRoomCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}
