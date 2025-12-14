// Controller View Component
import { useState, useEffect, useCallback } from 'react';
import { getPlayableCards, canDefendAgainstPick, canPlayCard } from '../../utils/whot-rules';
import { useGameConnection } from '../../utils/useGameConnection';
import { Card, CardShape } from '../../types/game';
import { WhotCard } from '../card';
import { ArrowLeft, RefreshCw, Send, Eye, EyeOff, AlertTriangle, Layers, Circle, Square, Triangle, Star, Grab, X as Cross, Trophy, MessageCircle } from 'lucide-react';
import { WinnerOverlay } from './winner-overlay';

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
    getHand,
    setReady,
    fetchGameState,
    sendMessage
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

  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [isChatFocused, setIsChatFocused] = useState(false);

  // Fetch current game state on mount (for reconnection)
  useEffect(() => {
    if (isConnected && roomCode && !gameState) {
        console.log('[Controller] Fetching game state on mount...');
        fetchGameState(roomCode);
    }
  }, [isConnected, roomCode, gameState, fetchGameState]);

  useEffect(() => {
    if (gameState?.gameStarted && isJoined && hand.length === 0) {
        // Initial fetch
        fetchHand();
    }
  }, [gameState?.gameStarted, isJoined]);

  // Auto-Reconnect Logic
  useEffect(() => {
    if (gameState?.gameStarted && !isJoined && playerId) {
        // Check if we are already in the game
        const myPlayer = gameState.players.find(p => p.id === playerId);
        if (myPlayer) {
            console.log("Found existing session, auto-reconnecting...");
            setPlayerName(myPlayer.name);
            setIsJoined(true);
            setMessage('Welcome back!');
        }
    }
  }, [gameState, isJoined, playerId]);

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

    // BLOCK PLAY if General Market is active - MUST PICK
    if (gameState?.effectActive === 'general_market') {
        setMessage("General Market! You must PICK a card.");
        if (navigator.vibrate) navigator.vibrate(200);
        return;
    }

    // Client-side Validation
    if (gameState?.currentCard) {
        let isValid = false;
        
        // If defending against Pick Two/Three
        if (gameState.effectActive === 'pick_two' || gameState.effectActive === 'pick_three') {
            isValid = canDefendAgainstPick(card, gameState);
        } else {
            // Correctly pass the globally selected shape (from previous Whot play)
            isValid = canPlayCard(card, gameState.currentCard, gameState.selectedShape);
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
        // Confirm state from server (non-blocking - don't await)
        fetchHand();
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

  const winner = gameState?.winner;
  const iWon = winner === playerId;

  // Sync Message from Server
  // Sync Message from Server with Privacy Filter
  useEffect(() => {
     if (gameState?.lastAction) {
       let msg = gameState.lastAction;
       // Remove "Warning, [Me] has..." or "[Me] is on last card"
       if (playerName && msg.includes(playerName)) {
           // Regex to remove the warning part
           const twoCardRegex = new RegExp(`Warning, ${playerName} has two cards left!`, 'i');
           const lastCardRegex = new RegExp(`\\. ${playerName} is on last card!`, 'i'); // Preceding dot
           
           msg = msg.replace(twoCardRegex, '').replace(lastCardRegex, '');
           
           // Clean up trailing dots/spaces if any
           msg = msg.trim();
           if (msg.endsWith('.')) msg = msg.slice(0, -1);
       }
       setMessage(msg);
     }
  }, [gameState?.lastAction, playerName]);

  // Connect Status Color
  const getConnectionStatusColor = () => {
    if (error) return 'text-red-400';
    if (isConnected) return 'text-green-400';
    return 'text-yellow-400 animate-pulse';
  };

  const isMyTurn = gameState?.players[gameState?.currentPlayerIndex]?.id === playerId;

  // Join Screen
  if (!isJoined) {
    // ... (existing join screen code)
    return (
      <div 
        className="relative min-h-screen flex flex-col items-center justify-center p-6 text-white bg-cover bg-center font-sans overflow-hidden"
        style={{ background: 'var(--whot-table-gradient)' }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-overlay"
           style={{ backgroundImage: 'var(--whot-wood-texture)' }} />
           
        <button onClick={onBack} className="absolute top-4 left-4 z-50 px-4 py-2 bg-black/40 hover:bg-black/60 backdrop-blur rounded-lg transition-all flex items-center gap-2 border border-white/10 text-sm font-bold shadow-lg">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="relative z-10 max-w-md w-full">
          {/* ... existing join form ... */}
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
         style={{ background: 'var(--whot-table-gradient)' }}>
      <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-overlay"
           style={{ backgroundImage: 'var(--whot-wood-texture)' }} />

      {/* GAME OVER OVERLAY */}
      {winner && (
          <WinnerOverlay 
               winnerName={gameState.players.find(p => p.id === winner)?.name}
               isMe={iWon}
               players={gameState.players}
               isHost={false}
               myPlayerId={playerId}
               onPlayAgain={() => setReady(roomCode, playerId)}
          />
      )}

      {/* Navbar */}
      <div className="relative z-20 flex items-center justify-between p-4 bg-black/40 backdrop-blur-md border-b border-white/5">
        <button onClick={onBack} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white border border-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        <div className="flex flex-col items-center">
            <div className="text-white text-base font-bold uppercase tracking-widest">{playerName}</div>
            
            {/* INCREASED SIZE FOR 'YOUR TURN' */}
            {isMyTurn && (
                <div className="text-sm font-black bg-yellow-400 text-black px-4 py-1 rounded-full animate-pulse shadow-lg mt-1 tracking-wider border-2 border-yellow-200">
                    YOUR TURN
                </div>
            )}
        </div>

        <button onClick={() => setCardsHidden(!cardsHidden)} className={`p-2 rounded-full transition-all border border-white/10 ${cardsHidden ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white'}`}>
          {cardsHidden ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>

      {/* Status Banner */}
      <div className={`relative z-10 px-4 py-3 text-center backdrop-blur-sm border-b border-white/5 transition-colors duration-300 ${message.toLowerCase().includes('warning') || message.toLowerCase().includes('last card') ? 'bg-red-900/50 border-red-500/30' : ''}`}>
         <p className={`text-sm font-medium ${message.toLowerCase().includes('warning') || message.toLowerCase().includes('last card') ? 'text-red-200 animate-pulse font-bold uppercase tracking-wide' : 'text-white/80'}`}>
             {message}
         </p>
      </div>

       {/* Cards Area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 overflow-hidden">
         {/* Table Visuals (Market + Current Card) */}
         {!cardsHidden && (
                <div className="relative z-20">
                    {/* Current Card on Table */}
                    {gameState?.currentCard && (
                        <div className="transform scale-125 shadow-2xl border-4 border-white/10 rounded-xl">
                             <WhotCard card={gameState.currentCard} />
                        </div>
                    )}
                     <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white/50 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap mt-2">
                         Table
                     </div>
                </div>
         )}
         
         {/* Shape Picker Modal */}
         {showShapePicker && pendingCard && (
             <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
                 <h3 className="text-white text-xl md:text-3xl mb-6 md:mb-10 font-black uppercase tracking-wider">Choose a Shape</h3>
                 <div className="grid grid-cols-2 gap-3 md:gap-6 w-full max-w-sm md:max-w-xl">
                     {(['circle', 'triangle', 'cross', 'square', 'star'] as CardShape[]).map(shape => {
                         const getIcon = () => {
                             const props = { className: "w-8 h-8 md:w-12 md:h-12", strokeWidth: 3 };
                             switch(shape) {
                                 case 'circle': return <Circle {...props} />;
                                 case 'triangle': return <Triangle {...props} />;
                                 case 'cross': return <Cross {...props} />;
                                 case 'square': return <Square {...props} />;
                                 case 'star': return <Star {...props} />;
                             }
                         };
                         
                         const getColor = () => {
                             switch(shape) {
                                 case 'circle': return "text-red-500 border-red-500/50 hover:bg-red-500";
                                 case 'triangle': return "text-green-500 border-green-500/50 hover:bg-green-500";
                                 case 'cross': return "text-purple-500 border-purple-500/50 hover:bg-purple-500";
                                 case 'square': return "text-blue-500 border-blue-500/50 hover:bg-blue-500";
                                 case 'star': return "text-yellow-500 border-yellow-500/50 hover:bg-yellow-500";
                             }
                         };

                         return (
                           <button
                               key={shape}
                               onClick={() => handlePlayCard(pendingCard, shape)}
                               className={`bg-white/5 border-2 ${getColor()} hover:text-white px-4 py-4 md:px-8 md:py-8 rounded-2xl capitalize font-bold hover:scale-105 transition-all text-base md:text-xl flex flex-col items-center justify-center gap-2 md:gap-3 group backdrop-blur-sm shadow-xl`}
                           >
                               <div className="group-hover:scale-110 transition-transform duration-200">{getIcon()}</div>
                               <span className="text-sm tracking-wider opacity-80 group-hover:opacity-100">{shape}</span>
                           </button>
                         );
                     })}
                 </div>
                 <button onClick={() => setShowShapePicker(false)} className="mt-12 text-white/50 text-sm font-bold uppercase tracking-widest hover:text-white">Cancel Choice</button>
             </div>
         )}

         {/* Unified Action Banner - SMART & TARGETED */}
         {(() => {
             // Hide banner if Shape Picker is open
             if (showShapePicker && pendingCard) return null;

             if (!gameState?.currentCard) return null;
             const num = gameState.currentCard.number;
             
             // Logic to decide if WE are the target
             let showBanner = false;
             let message = "";

             if (num === 20) {
                 showBanner = true; // Always show Whot requirement
                 message = `I NEED ${gameState.selectedShape?.toUpperCase() || "A SHAPE"}!`;
             } else if (num === 14) {
                 // ONLY if we are in the due list
                 if (gameState.marketDue?.includes(playerId)) {
                     showBanner = true;
                     message = "GO TO MARKET!";
                 }
             } else if (num === 2) {
                 // ONLY if it's our turn AND effect is active
                 if (isMyTurn && gameState.effectActive === 'pick_two') {
                     showBanner = true;
                     message = "PICK TWO!";
                 }
             } else if (num === 5) {
                 if (isMyTurn && gameState.effectActive === 'pick_three') {
                     showBanner = true;
                     message = "PICK THREE!";
                 }
             } else if (num === 1 && isMyTurn) {
                 showBanner = true;
                 message = "HOLD ON! Play Again";
             } else if (num === 8 && gameState.lastAction.includes('SUSPENSION')) {
                 // Suspension is tricky, usually not targeted at 'current' player but the one skipped.
                 // Just show generic if it's the top card?
                 // Let's hide it to reduce noise, or show only if we were just skipped? Hard to track.
                 // Simplest: Hide unless specifically needed.
             }

             if (!showBanner) return null;

             return (
                 <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-600/90 px-6 py-2 rounded-full border border-red-400/50 backdrop-blur-sm z-50 whitespace-nowrap shadow-xl animate-pulse">
                     <p className="text-white font-black uppercase tracking-wider text-sm">
                         {message}
                     </p>
                 </div>
             );
         })()}

        {hand.length > 0 ? (
          <div className="w-full h-full flex items-center overflow-x-auto snap-x px-8 pb-4 scrollbar-hide">
            <div className="flex gap-4 items-center mx-auto min-w-min">
                {/* Market Pile (Draw Button) */}
                <div className="relative flex-shrink-0 flex flex-col items-center gap-2">
                    <button
                      onClick={handleDraw}
                      disabled={!isMyTurn || loading}
                      className={`relative w-28 h-40 rounded-xl flex flex-col items-center justify-center transition-all group ${isMyTurn ? 'cursor-pointer hover:scale-105 active:scale-95' : 'opacity-50 cursor-not-allowed'}`}
                    >
                       {/* Deck Visuals matching Host View */}
                       {/* Stack effect */}
                       <div className="absolute top-1 left-1 w-full h-full bg-red-950 rounded-xl border border-white/10 rotate-3 shadow-lg -z-20 transition-transform group-hover:rotate-6"/>
                       <div className="absolute top-0.5 left-0.5 w-full h-full bg-red-900 rounded-xl border border-white/10 rotate-1 shadow-lg -z-10 transition-transform group-hover:rotate-3"/>
                       
                       <WhotCard 
                           card={{ id: 'deck', shape: 'circle', number: 20 }} 
                           faceDown 
                           className="w-full h-full shadow-2xl z-10"
                       />

                       {/* Deck Count Badge */}
                       <div className="absolute top-2 right-2 w-6 h-6 bg-black/60 backdrop-blur rounded-full flex items-center justify-center border border-white/20 z-20 shadow-md">
                           <span className="text-white text-[10px] font-bold">{gameState?.deckCount || 0}</span>
                       </div>

                       {/* Loading Spinner Overlay */}
                       {loading && (
                           <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/20 rounded-xl backdrop-blur-sm">
                               <RefreshCw className="w-8 h-8 text-white animate-spin" />
                           </div>
                       )}
                    </button>
                    <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Market</span>
                </div>

                {hand.map((card) => (
                    <div key={card.id} className="flex-shrink-0 snap-center perspective-1000">
                      <WhotCard
                        card={card}
                        faceDown={cardsHidden}
                        onClick={() => !cardsHidden && handlePlayCard(card)}
                        disabled={!isMyTurn || loading || cardsHidden}
                        className={`transform transition-all duration-500 ${isMyTurn && !cardsHidden ? 'hover:scale-110 hover:-translate-y-6 hover:rotate-2 shadow-2xl cursor-pointer' : ''} ${cardsHidden ? 'opacity-90 grayscale-[0.2]' : ''}`}
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

       {/* Footer with Chat Input */}
      <div className="relative z-20 px-4 py-3 bg-black/40 backdrop-blur-md border-t border-white/5">
        {/* Only show chat when game has started */}
        {gameState?.gameStarted && (
          <div className="flex items-center gap-2 mb-2">
            {/* Chat Input */}
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onFocus={(e) => {
                setIsChatFocused(true);
                // Scroll input into view when keyboard appears
                setTimeout(() => {
                  e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
              }}
              onBlur={() => setIsChatFocused(false)}
              placeholder="Send a message..."
              className="flex-1 px-4 py-3 md:py-2 bg-black/30 border border-white/10 rounded-full text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/30"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && chatInput.trim()) {
                  sendMessage({
                    type: 'chat_message',
                    playerId,
                    playerName: playerName || 'Player',
                    message: chatInput.trim()
                  });
                  setChatInput('');
                }
              }}
            />
            
            {/* Two-State Button: Chat icon or Send icon */}
            <button
              onClick={() => {
                if (chatInput.trim()) {
                  // Send message
                  sendMessage({
                    type: 'chat_message',
                    playerId,
                    playerName: playerName || 'Player',
                    message: chatInput.trim()
                  });
                  setChatInput('');
                } else {
                  // Toggle chat on host
                  sendMessage({
                    type: 'toggle_chat',
                    playerId
                  });
                }
              }}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                chatInput.trim() 
                  ? 'bg-yellow-500 text-black hover:bg-yellow-400' 
                  : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
              }`}
            >
              {chatInput.trim() ? <Send className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
            </button>
          </div>
        )}
        
        {/* Card Count */}
        <p className="text-white/40 text-xs font-mono tracking-widest uppercase text-center">
           {hand.length} Cards held
        </p>
      </div>
    </div>
  );
}
