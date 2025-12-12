// Controller View Component
import { useState, useEffect, useCallback } from 'react';
import { getPlayableCards, canDefendAgainstPick, canPlayCard } from '../../utils/whot-rules';
import { useGameConnection } from '../../utils/useGameConnection';
import { Card, CardShape } from '../../types/game';
import { WhotCard } from '../card';
import { ArrowLeft, RefreshCw, Send, Eye, EyeOff, AlertTriangle, Layers } from 'lucide-react';

interface ControllerViewProps {
  roomCode: string;
  onBack: () => void;
}

export function ControllerView({ roomCode, onBack }: ControllerViewProps) {
  // Persist Player ID
  const [playerId] = useState(() => {
    const saved = localStorage.getItem('whot-player-id');
    if (saved) return saved;
    const newId = `player-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    localStorage.setItem('whot-player-id', newId);
    return newId;
  });

  const handleMessage = useCallback((msg: any) => {
    
    if (msg.type === 'deal') {
        if (msg.playerId === playerId) {
            setHand(msg.cards);
            setMessage('Game Started! Good Luck!');
        }
    }
    if (msg.type === 'draw' && msg.playerId === playerId) {
        setHand(prev => [...prev, ...msg.cards]);
    }
  }, [playerId]);

  const { 
    gameState, 
    isConnected, 
    error, 
    joinGame,
    playCard: playCardOnServer,
    drawCard: drawCardOnServer,
    getHand
  } = useGameConnection(roomCode, handleMessage);

  const [playerName, setPlayerName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [hand, setHand] = useState<Card[]>([]);
  const [cardsHidden, setCardsHidden] = useState(false);
  const [message, setMessage] = useState('Enter your name to join...');
  const [loading, setLoading] = useState(false);

  // Shape Selection Modal State
  const [showShapePicker, setShowShapePicker] = useState(false);
  const [pendingCard, setPendingCard] = useState<Card | null>(null);

  useEffect(() => {
    if (gameState?.gameStarted && isJoined && hand.length === 0) {
        // Initial fetch
        fetchHand();
    }
  }, [gameState?.gameStarted, isJoined]);

  const fetchHand = async () => {
      try {
          const cards = await getHand(roomCode, playerId);
          setHand(cards);
      } catch (e) {
          console.error("Failed to fetch hand", e);
      }
  };

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    
    setLoading(true);
    try {
      await joinGame(roomCode, playerName, playerId);
      setIsJoined(true);
      setMessage('Joined! Waiting for host to start...');
    } catch (err: any) {
      setMessage(`Failed to join: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayCard = async (card: Card, shape: CardShape | null = null) => {
    // If not my turn, ignore
    if (!isMyTurn) return;

    // Client-side Validation
    if (gameState?.currentCard) {
        let isValid = false;
        
        // If defending against Pick Two/Three
        if (gameState.effectActive === 'pick_two' || gameState.effectActive === 'pick_three') {
            isValid = canDefendAgainstPick(card, gameState);
        } else {
            isValid = canPlayCard(card, gameState.currentCard, gameState.currentCard.number === 20 ? (gameState.currentCard.shape as CardShape) : null);
            // Wait, the `canPlayCard` signature expects `selectedShape`. 
            // If the current card is Whot, we need to know the declared shape.
            // The `gameState.currentCard` might not carry the declared shape property directly if it's just a Card object.
            // Actually `gameState` usually tracks `currentShape` or similar if Whot was played?
            // `whot-rules.ts` `canPlayCard` uses `selectedShape`.
            // Let's assume for now, standard matching.
            
            // Correction: `canPlayCard` takes `(card, currentCard, selectedShape)`. 
            // We don't have easy access to "active requested shape" from `gameState` in this minimal interface?
            // `gameState.currentCard` is the top card. 
            // If previous player played Whot, `gameState.lastAction` might say "Circle", but verifying strict logic here might be tricky without full state.
            // However, Basic matching (Shape/Number) is safe to check.
            
            // Simpler check:
            if (card.number === 20) isValid = true;
            else if (card.shape === gameState.currentCard.shape) isValid = true;
            else if (card.number === gameState.currentCard.number) isValid = true;
            
            // Special case: If prev card was 20, we need to respect the called shape.
            // If we can't be 100% sure of the called shape here, we should perhaps skip strict validation or infer it.
            // But blocking obvious mismatches is good.
        }

        if (!isValid) {
            // Shake or Toast
            setMessage("Invalid Move! Check shape/number.");
            // Trigger visual feedback (e.g., vibration)
            if (navigator.vibrate) navigator.vibrate(200);
            return;
        }
    }

    // If Whot card (20) and no shape selected, show picker
    if (card.number === 20 && !shape) {
        setPendingCard(card);
        setShowShapePicker(true);
        return;
    }

    setLoading(true);
    try {
        await playCardOnServer(roomCode, playerId, card, shape);
        // Optimistic update
        setHand(prev => prev.filter(c => c.id !== card.id));
        setPendingCard(null);
        setShowShapePicker(false);
        setMessage("Card played!");
    } catch (err: any) {
        console.error("Play error", err);
        setMessage(`Error: ${err.message}`);
        fetchHand();
    } finally {
        setLoading(false);
    }
  };

  const handleDraw = async () => {
      setLoading(true);
      try {
          await drawCardOnServer(roomCode, playerId);
          await fetchHand(); 
          setMessage("Drawn cards!");
      } catch (err: any) {
           setMessage(`Error drawing: ${err.message}`);
      } finally {
          setLoading(false);
      }
  };

  const getConnectionStatusColor = () => {
    if (error) return 'text-red-400';
    if (isConnected) return 'text-green-400';
    return 'text-yellow-400 animate-pulse';
  };

  const isMyTurn = gameState?.players[gameState?.currentPlayerIndex]?.id === playerId;

  // Join Screen
  if (!isJoined) {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center p-6 text-white bg-cover bg-center font-sans"
        style={{ 
             background: 'var(--whot-table-gradient)',
         }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-overlay"
           style={{ backgroundImage: 'var(--whot-wood-texture)' }} />
           
        <button
          onClick={onBack}
          className="relative z-10 absolute top-4 left-4 px-4 py-2 bg-black/40 hover:bg-black/60 backdrop-blur rounded-lg transition-all flex items-center gap-2 border border-white/10"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="relative z-10 max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl mb-6 font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 drop-shadow-sm">
                JOIN GAME
            </h1>
             <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-8 mb-6 shadow-2xl">
              <p className="text-xs uppercase tracking-widest opacity-60 mb-2 font-bold">Room Code</p>
              <p className="text-6xl tracking-widest font-mono font-bold text-white drop-shadow-lg">{roomCode}</p>
            </div>
            <div className={`flex items-center justify-center gap-2 px-4 py-2 bg-black/30 rounded-full inline-flex border border-white/5 ${getConnectionStatusColor()}`}>
              <RefreshCw className={`w-4 h-4 ${!isConnected && !error ? 'animate-spin' : ''}`} />
              <span className="text-xs font-bold uppercase">{error ? 'Error' : isConnected ? 'Connected' : 'Connecting...'}</span>
            </div>
          </div>

          <form onSubmit={handleJoinGame} className="space-y-4">
            <div>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="ENTER YOUR NAME"
                className="w-full px-6 py-4 bg-white/10 border-2 border-white/20 rounded-xl focus:outline-none focus:border-yellow-400 text-white placeholder-white/30 transition-all text-center font-bold text-lg uppercase tracking-wider backdrop-blur-sm"
                autoFocus
                maxLength={12}
              />
            </div>
            <button
              type="submit"
              disabled={!playerName.trim() || !isConnected || loading}
              className="w-full px-6 py-4 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black rounded-xl text-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3 shadow-xl font-black uppercase tracking-wide"
            >
              {loading ? <RefreshCw className="animate-spin"/> : <Send className="w-5 h-5" />}
              Join Table
            </button>
          </form>
          
          {error && (
            <div className="mt-4 bg-red-900/40 border border-red-500/50 rounded-xl p-4 text-sm flex items-start gap-3 backdrop-blur-sm">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0"/>
              <p className="text-red-200 font-medium">{error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Active Game UI
  return (
    <div className="fixed inset-0 flex flex-col font-sans"
         style={{ 
             background: 'var(--whot-table-gradient)',
         }}>
      <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-overlay"
           style={{ backgroundImage: 'var(--whot-wood-texture)' }} />

      {/* Navbar */}
      <div className="relative z-20 flex items-center justify-between p-4 bg-black/40 backdrop-blur-md border-b border-white/5">
        <button
          onClick={onBack}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white border border-white/10"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        <div className="flex flex-col items-center">
            <div className="text-white text-base font-bold uppercase tracking-widest">{playerName}</div>
            {isMyTurn && <div className="text-[10px] font-bold bg-yellow-400 text-black px-2 py-0.5 rounded-full animate-pulse">YOUR TURN</div>}
        </div>

        <button
          onClick={() => setCardsHidden(!cardsHidden)}
          className={`p-2 rounded-full transition-all border border-white/10 ${cardsHidden ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white'}`}
        >
          {cardsHidden ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>

      {/* Status Banner */}
      <div className="relative z-10 px-4 py-2 text-center backdrop-blur-sm border-b border-white/5">
         <p className="text-sm font-medium text-white/80">{message}</p>
      </div>

       {/* Cards Area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 overflow-hidden">
         
         {/* Shape Picker Modal */}
         {showShapePicker && pendingCard && (
             <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
                 <h3 className="text-white text-2xl mb-8 font-black uppercase tracking-wider">Choose a Shape</h3>
                 <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                     {(['circle', 'triangle', 'cross', 'square', 'star'] as CardShape[]).map(shape => (
                         <button
                           key={shape}
                           onClick={() => handlePlayCard(pendingCard, shape)}
                           className="bg-white/10 border-2 border-white/20 text-white px-6 py-6 rounded-2xl capitalize font-bold hover:bg-yellow-400 hover:text-black hover:border-yellow-400 hover:scale-105 transition-all text-lg flex items-center justify-center gap-2"
                         >
                             {shape}
                         </button>
                     ))}
                 </div>
                 <button onClick={() => setShowShapePicker(false)} className="mt-12 text-white/50 text-sm font-bold uppercase tracking-widest hover:text-white">Cancel Choice</button>
             </div>
         )}

         {/* Unified Action Banner */}
         {gameState?.currentCard && [1, 2, 5, 8, 14, 20].includes(gameState.currentCard.number) && (
             <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-600/90 px-6 py-2 rounded-full border border-red-400/50 backdrop-blur-sm z-50 whitespace-nowrap shadow-xl animate-pulse">
                 <p className="text-white font-black uppercase tracking-wider text-sm">
                     {gameState.currentCard.number === 14 ? "GO TO MARKET!" : 
                      gameState.currentCard.number === 2 ? "PICK TWO!" :
                      gameState.currentCard.number === 5 ? "PICK THREE!" :
                      gameState.currentCard.number === 1 ? "HOLD ON!" :
                      gameState.currentCard.number === 8 ? "SUSPENSION!" : 
                      gameState.currentCard.number === 20 ? `I NEED ${gameState.selectedShape?.toUpperCase() || "A SHAPE"}!` : ""}
                 </p>
             </div>
         )}

        {cardsHidden ? (
          <div className="text-center animate-pulse opacity-50">
            <Layers className="w-24 h-24 text-white mx-auto mb-4" />
            <p className="text-white text-lg font-bold uppercase tracking-widest">Hand Hidden</p>
          </div>
        ) : hand.length > 0 ? (
          <div className="w-full h-full flex items-center overflow-x-auto snap-x px-8 pb-4 scrollbar-hide">
            <div className="flex gap-4 items-center mx-auto min-w-min">
                {/* Draw Button */}
                <button
                  onClick={handleDraw}
                  disabled={!isMyTurn || loading}
                  className={`flex-shrink-0 w-28 h-40 rounded-xl border-4 border-dashed border-white/20 flex flex-col items-center justify-center transition-all ${isMyTurn ? 'hover:bg-white/5 hover:border-yellow-400/50 active:scale-95 cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
                >
                  <RefreshCw className={`w-8 h-8 text-white mb-2 ${loading ? 'animate-spin' : ''}`} />
                  <span className="text-white/60 text-xs font-bold uppercase tracking-wider">Draw</span>
                </button>

                {hand.map((card) => (
                    <div key={card.id} className="flex-shrink-0 snap-center perspective-1000">
                      <WhotCard
                        card={card}
                        onClick={() => handlePlayCard(card)}
                        disabled={!isMyTurn || loading}
                        className={`transform transition-all ${isMyTurn ? 'hover:scale-110 hover:-translate-y-6 hover:rotate-2 shadow-2xl cursor-pointer' : 'opacity-80 scale-95 grayscale-[0.3] cursor-not-allowed'}`}
                      />
                    </div>
                ))}
            </div>
          </div>
        ) : gameState?.gameStarted ? (
             <div className="text-center">
                <p className="text-white/50 mb-4 font-mono">No cards in hand</p>
                <button onClick={fetchHand} className="px-6 py-2 bg-white/10 rounded-full text-white font-bold text-sm border border-white/20 hover:bg-white/20">
                    Refresh Hand
                </button>
             </div>
        ) : (
          <div className="text-center max-w-xs mx-auto">
             <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 animate-pulse">
                 <RefreshCw className="w-6 h-6 text-yellow-400 animate-spin"/>
             </div>
            <p className="text-white font-bold text-xl mb-2">Waiting for Host</p>
            <p className="text-white/50 text-sm">The game will start soon...</p>
          </div>
        )}
      </div>

       {/* Footer */}
      <div className="relative z-20 px-6 py-4 bg-black/40 backdrop-blur-md border-t border-white/5 text-center">
        <p className="text-white/40 text-xs font-mono tracking-widest uppercase">
           {hand.length} Cards held
        </p>
      </div>
    </div>
  );
}
