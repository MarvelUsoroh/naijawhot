import { Card } from '../types/game';
import { getCardEffect } from '../utils/whot-rules';
import { Zap, Users, SkipForward, Hand, Repeat } from 'lucide-react';

interface SpecialCardEffectProps {
  card: Card;
  showAnimation?: boolean;
}

export function SpecialCardEffect({ card, showAnimation = true }: SpecialCardEffectProps) {
  const effect = getCardEffect(card);
  
  if (!effect.type) return null;

  const getEffectIcon = () => {
    switch (effect.type) {
      case 'hold_on':
        return <Repeat className="w-8 h-8" />;
      case 'pick_two':
      case 'pick_three':
        return <Hand className="w-8 h-8" />;
      case 'suspension':
        return <SkipForward className="w-8 h-8" />;
      case 'general_market':
        return <Users className="w-8 h-8" />;
      default:
        return null;
    }
  };

  const getEffectColor = () => {
    switch (effect.type) {
      case 'hold_on':
        return 'from-yellow-500 to-orange-500';
      case 'pick_two':
      case 'pick_three':
        return 'from-red-500 to-red-700';
      case 'suspension':
        return 'from-blue-500 to-blue-700';
      case 'general_market':
        return 'from-green-500 to-green-700';
      default:
        return 'from-gray-500 to-gray-700';
    }
  };

  const getEffectLabel = () => {
    switch (effect.type) {
      case 'hold_on':
        return 'HOLD ON!';
      case 'pick_two':
        return 'PICK TWO';
      case 'pick_three':
        return 'PICK THREE';
      case 'suspension':
        return card.shape === 'star' ? 'SUSPENSION ×2' : 'SUSPENSION';
      case 'general_market':
        return 'GENERAL MARKET';
      default:
        return '';
    }
  };

  return (
    <div className={`absolute -top-24 left-1/2 -translate-x-1/2 z-20 ${showAnimation ? 'animate-bounce' : ''}`}>
      <div className={`bg-gradient-to-r ${getEffectColor()} text-white rounded-2xl px-8 py-4 shadow-2xl border-4 border-white flex items-center gap-4`}>
        {getEffectIcon()}
        <div>
          <p className="text-2xl tracking-wide">{getEffectLabel()}</p>
        </div>
      </div>
    </div>
  );
}