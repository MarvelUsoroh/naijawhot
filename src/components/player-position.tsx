import { Player } from '../types/game';

interface PlayerPositionProps {
  player: Player;
  position: 'top' | 'right' | 'bottom' | 'left';
  isCurrentTurn: boolean;
}

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-yellow-500',
  'bg-red-500',
  'bg-indigo-500',
  'bg-orange-500'
];

export function PlayerPosition({ player, position, isCurrentTurn }: PlayerPositionProps) {
  const avatarColor = AVATAR_COLORS[Math.abs(player.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % AVATAR_COLORS.length];
  
  const positionClasses = {
    top: 'absolute top-8 left-1/2 -translate-x-1/2',
    right: 'absolute right-8 top-1/2 -translate-y-1/2',
    bottom: 'absolute bottom-8 left-1/2 -translate-x-1/2',
    left: 'absolute left-8 top-1/2 -translate-y-1/2'
  };

  const cardFanRotation = {
    top: 'rotate-180',
    right: '-rotate-90',
    bottom: 'rotate-0',
    left: 'rotate-90'
  };

  return (
    <div className={`${positionClasses[position]} flex flex-col items-center gap-2 sm:gap-3`}>
      {/* Avatar with name badge */}
      <div className="relative">
        <div className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full ${avatarColor} border-4 flex items-center justify-center transition-all`} style={{ borderColor: isCurrentTurn ? 'var(--whot-accent-gold)' : 'white', boxShadow: isCurrentTurn ? '0 0 20px var(--whot-accent-gold)' : 'none' }}>
          <span className="text-lg sm:text-xl md:text-2xl text-white">{player.name.charAt(0).toUpperCase()}</span>
        </div>
        <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs whitespace-nowrap`} style={{ backgroundColor: isCurrentTurn ? 'var(--whot-accent-gold)' : 'rgba(255, 255, 255, 0.9)', color: isCurrentTurn ? 'var(--whot-table-dark)' : '#1f2937' }}>
          {player.name}
        </div>
      </div>

      {/* Card count indicator - fanned cards */}
      <div className="relative h-12 sm:h-14 md:h-16 flex items-center justify-center">
        {Array.from({ length: Math.min(player.cardCount, 5) }).map((_, index) => (
          <div
            key={index}
            className={`absolute w-10 h-14 sm:w-12 sm:h-16 rounded-lg shadow-lg ${cardFanRotation[position]}`}
            style={{
              left: `${index * 6}px`,
              zIndex: index,
              transform: `${cardFanRotation[position]} rotate(${(index - 2) * 5}deg)`,
              backgroundColor: 'var(--whot-card-back)',
              border: '2px solid white'
            }}
          >
            <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: 'var(--whot-text-secondary)' }}>
              Whot!
            </div>
          </div>
        ))}
        {player.cardCount > 5 && (
          <div className="absolute -top-2 -right-2 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs font-bold z-10" style={{ backgroundColor: 'var(--whot-accent-gold)', color: 'var(--whot-table-dark)' }}>
            {player.cardCount}
          </div>
        )}
      </div>
    </div>
  );
}