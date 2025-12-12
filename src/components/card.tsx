import { Circle, Square, Triangle, Star, Cross } from 'lucide-react';

export type CardShape = 'circle' | 'square' | 'triangle' | 'star' | 'cross';
export type CardNumber = 1 | 2 | 3 | 4 | 5 | 7 | 8 | 10 | 11 | 12 | 13 | 14 | 20;

export interface Card {
  id: string;
  shape: CardShape;
  number: CardNumber;
}

interface CardProps {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  faceDown?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const shapeColors: Record<CardShape, string> = {
  circle: 'text-red-600',
  square: 'text-blue-600',
  triangle: 'text-green-600',
  star: 'text-yellow-600',
  cross: 'text-purple-600',
};

const ShapeIcon = ({ shape, className }: { shape: CardShape; className?: string }) => {
  const iconProps = { className, strokeWidth: 2.5 };
  
  switch (shape) {
    case 'circle':
      return <Circle {...iconProps} />;
    case 'square':
      return <Square {...iconProps} />;
    case 'triangle':
      return <Triangle {...iconProps} />;
    case 'star':
      return <Star {...iconProps} />;
    case 'cross':
      return <Cross {...iconProps} />;
  }
};

export function WhotCard({ card, onClick, disabled, faceDown, className = '', style }: CardProps) {
  const shapeColor = shapeColors[card.shape];
  
  // Card Back Design - Mimicking the detailed red pattern
  if (faceDown) {
    return (
      <div
        style={{ 
          backgroundColor: 'var(--whot-card-back)',
          backgroundImage: `
            repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 8px),
            repeating-linear-gradient(-45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 8px)
          `,
          boxShadow: 'var(--whot-card-shadow)',
          ...style
        }}
        className={`w-24 h-36 rounded-xl border-4 border-white/90 flex flex-col items-center justify-center cursor-pointer transition-transform duration-300 hover:scale-105 hover:-translate-y-1 ${className}`}
        onClick={onClick}
      >
        <div className="w-16 h-24 border-2 border-white/30 rounded-lg flex items-center justify-center">
            <div className="text-white font-serif font-bold text-lg rotate-180 opacity-60" style={{ writingMode: 'vertical-rl' }}>WHOT</div>
        </div>
      </div>
    );
  }

  // Card Front Design
  return (
    <div
      style={{ boxShadow: 'var(--whot-card-shadow)', ...style }}
      className={`relative w-24 h-36 rounded-xl bg-white flex flex-col items-center justify-center transition-all duration-300 ${
        disabled ? 'opacity-60 cursor-not-allowed grayscale-[0.5]' : 'cursor-pointer hover:scale-110 hover:-translate-y-4 hover:shadow-2xl z-10'
      } ${className}`}
      onClick={!disabled ? onClick : undefined}
    >
      {/* Corner Indices */}
      <div className="absolute top-1 left-1 flex flex-col items-center leading-none">
        <span className={`text-lg font-bold ${shapeColor}`}>{card.number}</span>
        <ShapeIcon shape={card.shape} className={`w-3 h-3 ${shapeColor}`} />
      </div>
      <div className="absolute bottom-1 right-1 flex flex-col items-center leading-none rotate-180">
        <span className={`text-lg font-bold ${shapeColor}`}>{card.number}</span>
        <ShapeIcon shape={card.shape} className={`w-3 h-3 ${shapeColor}`} />
      </div>

      {/* Center Graphics */}
      <div className="flex flex-col items-center gap-1">
        <ShapeIcon shape={card.shape} className={`w-12 h-12 ${shapeColor} drop-shadow-sm`} />
        <span className={`text-4xl font-black ${shapeColor} tracking-tighter drop-shadow-sm`}>
          {card.number}
        </span>
      </div>

      {/* Special Label */}
      {card.number === 20 && (
        <div className="absolute bottom-6 bg-yellow-400 text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm uppercase tracking-wider">
          Whot!
        </div>
      )}
    </div>
  );
}