import { Card, CardShape } from '../types/game';
import { createWhotDeck, canPlayCard as whotCanPlayCard } from './whot-rules';

export function generateRoomCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Use authentic Nigerian Whot deck
export function createDeck(): Card[] {
  return createWhotDeck();
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Use authentic Whot rules for card matching
export function canPlayCard(card: Card, currentCard: Card, selectedShape: CardShape | null): boolean {
  if (!currentCard) return false;
  return whotCanPlayCard(card, currentCard, selectedShape);
}

export function generatePlayerId(): string {
  return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}