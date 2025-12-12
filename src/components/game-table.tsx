import { Card, Player } from '../types/game';
import { WhotCard } from './card';
import { PlayerPosition } from './player-position';
import { SpecialCardEffect } from './special-card-effect';

interface GameTableProps {
  players: Player[];
  currentCard: Card | null;
  deckCount: number;
  currentPlayerIndex: number;
  lastAction: string;
}

export function GameTable({ players, currentCard, deckCount, currentPlayerIndex, lastAction }: GameTableProps) {
  // Position players around the table based on count
  const getPlayerPositions = () => {
    const positions: Array<'top' | 'right' | 'bottom' | 'left'> = [];
    const count = players.length;

    if (count === 1) {
      positions.push('bottom');
    } else if (count === 2) {
      positions.push('top', 'bottom');
    } else if (count === 3) {
      positions.push('top', 'left', 'right');
    } else if (count === 4) {
      positions.push('top', 'right', 'bottom', 'left');
    } else if (count === 5) {
      positions.push('top', 'top', 'right', 'bottom', 'left');
    } else {
      // 6+ players, spread them out
      const sides: Array<'top' | 'right' | 'bottom' | 'left'> = ['top', 'right', 'bottom', 'left'];
      for (let i = 0; i < count; i++) {
        positions.push(sides[i % 4]);
      }
    }

    return positions;
  };

  const positions = getPlayerPositions();

  return (
    <div className="relative w-screen h-screen overflow-hidden flex items-center justify-center" style={{ backgroundColor: 'var(--whot-table-bg)' }}>
      {/* Wooden table texture overlay */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `repeating-linear-gradient(
            90deg,
            rgba(139, 69, 19, 0.3) 0px,
            rgba(160, 82, 45, 0.3) 2px,
            rgba(139, 69, 19, 0.3) 4px
          )`
        }}
      />

      {/* Players positioned around table */}
      {players.map((player, index) => (
        <PlayerPosition
          key={player.id}
          player={player}
          position={positions[index]}
          isCurrentTurn={index === currentPlayerIndex}
        />
      ))}

      {/* Center table area - Deck and Current Card - Responsive sizing */}
      <div className="flex items-center gap-8 sm:gap-12 md:gap-16 lg:gap-20">
        {/* Draw Pile (Market) */}
        <div className="relative">
          {/* Stacked deck effect */}
          <div className="absolute -top-1 -left-1 w-24 h-32 sm:w-28 sm:h-36 md:w-32 md:h-40 rounded-xl" style={{ backgroundColor: 'var(--whot-card-back-dark)', opacity: 0.5 }} />
          <div className="absolute -top-0.5 -left-0.5 w-24 h-32 sm:w-28 sm:h-36 md:w-32 md:h-40 rounded-xl" style={{ backgroundColor: 'var(--whot-card-back-dark)', opacity: 0.7 }} />
          <div className="relative w-24 h-32 sm:w-28 sm:h-36 md:w-32 md:h-40 rounded-xl border-4 border-white shadow-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--whot-card-back)' }}>
            <div className="text-center">
              <p className="text-base sm:text-lg md:text-xl mb-1 sm:mb-2" style={{ color: 'var(--whot-text-secondary)' }}>Market</p>
              <p className="text-3xl sm:text-4xl md:text-5xl tabular-nums" style={{ color: 'var(--whot-text-primary)' }}>{deckCount}</p>
            </div>
          </div>
        </div>

        {/* Current Card (Discard Pile) */}
        <div className="relative">
          {currentCard ? (
            <>
              {/* Show special card effect if applicable */}
              <SpecialCardEffect card={currentCard} />
              
              <div className="transform scale-125 sm:scale-150 md:scale-[1.75]">
                <WhotCard card={currentCard} />
              </div>
              <p className="text-center mt-4 sm:mt-6 md:mt-8 text-sm sm:text-base" style={{ color: 'var(--whot-text-primary)' }}>Last Played</p>
            </>
          ) : (
            <div className="w-24 h-32 sm:w-28 sm:h-36 md:w-32 md:h-40 border-4 border-dashed rounded-xl flex items-center justify-center" style={{ borderColor: 'var(--whot-border-light)' }}>
              <span className="text-xs sm:text-sm text-center" style={{ color: 'var(--whot-text-secondary)' }}>Waiting<br />for card</span>
            </div>
          )}
        </div>
      </div>

      {/* Last Action - Top Center - Responsive */}
      {lastAction && (
        <div className="absolute top-4 sm:top-6 md:top-8 left-1/2 -translate-x-1/2 backdrop-blur-sm px-4 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 rounded-xl sm:rounded-2xl border-2 max-w-xs sm:max-w-md md:max-w-2xl" style={{ backgroundColor: 'var(--whot-overlay-darker)', borderColor: 'var(--whot-border-light)' }}>
          <p className="text-center text-sm sm:text-base md:text-lg" style={{ color: 'var(--whot-text-primary)' }}>{lastAction}</p>
        </div>
      )}
    </div>
  );
}