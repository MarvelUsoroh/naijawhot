import { useState, useEffect, useCallback, useRef } from 'react';
import { useGameConnection } from '../../utils/useGameConnection';
import { useAnnouncer } from '../../utils/useAnnouncer';
import confetti from 'canvas-confetti';
import { WhotCard } from '../card';
import { QrCode, Copy, Trophy, Crown, AlertCircle, X, MessageCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { WinnerOverlay } from './winner-overlay';

interface HostViewProps {
  onExit: () => void;
  initialRoomCode?: string;  // For spectators joining an existing room
  isSpectator?: boolean;     // Hide controls when spectating
}

export function HostView({ onExit, initialRoomCode, isSpectator = false }: HostViewProps) {
  // Use provided room code (for spectator) or generate new one (for host)
  const [localRoomCode] = useState(() => initialRoomCode || Math.floor(1000 + Math.random() * 9000).toString());
  
  // Local state for Lobby (before game starts)
  const [localPlayers, setLocalPlayers] = useState<{id: string, name: string}[]>([]);

  // Handle incoming messages (Join requests)
  const handleMessage = useCallback((msg: any) => {
      if (msg.type === 'join') {
          setLocalPlayers(prev => {
              if (prev.find(p => p.id === msg.playerId)) return prev;
              return [...prev, { id: msg.playerId, name: msg.playerName }];
          });
      }
      // Chat messages
      if (msg.type === 'toggle_chat') {
          setShowChat(prev => !prev); // Toggle instead of just opening
      }
      if (msg.type === 'activate_chat') {
          setShowChat(true);
      }
      if (msg.type === 'chat_message') {
          setShowChat(true);
          setChatMessages(prev => [
              ...prev,
              { playerName: msg.playerName, message: msg.message, timestamp: Date.now() }
          ].slice(-20)); // Keep last 20 messages
      }
  }, []);

  const { 
    gameState, 
    isConnected, 
    startGame: startGameOnServer, 
    sendMessage
  } = useGameConnection(localRoomCode, handleMessage);

  const [message, setMessage] = useState('Waiting for players...');
  const [showQR, setShowQR] = useState(false);
  
  // Chat State
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{playerName: string; message: string; timestamp: number}[]>([]);
  
  // Game state derived - Merge local lobby players with server game players
  const players = gameState?.players || localPlayers;
  const topCard = gameState?.currentCard;
  const winner = gameState?.winner;

  // Voice Announcer (Host always plays sounds)
  const { play, playShapeCall } = useAnnouncer(true);
  const lastAnnouncedCard = useRef<string | null>(null);
  const lastAnnouncedWinner = useRef<string | null>(null);
  const pendingContinue = useRef<boolean>(false); // Track if we need to announce "Continue" after next play

  // Announce power cards and game events
  useEffect(() => {
    if (!topCard) return;
    
    const cardKey = `${topCard.shape}-${topCard.number}`;
    
    // Prevent duplicate announcements for the same card
    if (lastAnnouncedCard.current === cardKey) return;
    
    // Check if we need to announce "Continue" from previous Hold On / General Market
    // But ONLY if there's no winner (don't say "Continue" after "Check Up!")
    if (pendingContinue.current && !winner) {
      // Only announce "Continue" if the follow-up card is NOT a power card
      const isPowerCard = [1, 2, 5, 8, 14, 20].includes(topCard.number);
      if (!isPowerCard) {
        setTimeout(() => play('continue'), 1500);
      }
    }
    pendingContinue.current = false; // Always clear, whether we played or not
    
    lastAnnouncedCard.current = cardKey;

    // Trigger sound based on card number
    switch (topCard.number) {
      case 2:
        play('pick_two');
        break;
      case 5:
        play('pick_three');
        break;
      case 14:
        play('general_market');
        pendingContinue.current = true; // Set flag to announce "Continue" on next play
        break;
      case 1:
        play('hold_on');
        pendingContinue.current = true; // Set flag to announce "Continue" on next play
        break;
      case 8:
        play('suspension');
        break;
      case 20:
        // For Whot card, announce the selected shape
        if (gameState?.selectedShape) {
          playShapeCall(gameState.selectedShape);
        }
        break;
    }
  }, [topCard, gameState?.selectedShape, play, playShapeCall]);

  // Announce winner with confetti and applause (Host and Spectator)
  useEffect(() => {
    if (winner && winner !== lastAnnouncedWinner.current) {
      lastAnnouncedWinner.current = winner;
      
      // Play check_up announcement
      play('check_up');
      
      // After check_up (~1.5s), play applause and fire confetti
      setTimeout(() => {
        // Play applause (separate audio instance)
        const applauseAudio = new Audio('/sounds/applause.mp3');
        applauseAudio.play().catch(() => {});
        
        // Fire confetti celebration!
        const fireConfetti = () => {
          // Burst 1 (Left)
          confetti({
            particleCount: 80,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 0.8 },
            colors: ['#FFD700', '#FFA500', '#FF6347', '#00FF00', '#1E90FF']
          });
          // Burst 2 (Right)
          confetti({
            particleCount: 80,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 0.8 },
            colors: ['#FFD700', '#FFA500', '#FF6347', '#00FF00', '#1E90FF']
          });
        };

        // Fire 5 distinct bursts over 2 seconds (much lighter on CPU than requestAnimationFrame)
        fireConfetti();
        const interval = setInterval(fireConfetti, 400);
        setTimeout(() => clearInterval(interval), 2000);
      }, 1500);
    }
  }, [winner, play]);

  // Announce last card warnings (delayed so power card announcement plays first)
  useEffect(() => {
    const action = gameState?.lastAction?.toLowerCase() || '';
    if (action.includes('last card')) {
      // Delay to let power card announcement play first
      setTimeout(() => play('last_card'), 1500);
    } else if (action.includes('warning') && action.includes('two cards')) {
      setTimeout(() => play('warning'), 1500);
    }
  }, [gameState?.lastAction, play]);

  // Effects for text messages
  useEffect(() => {
     if (gameState?.lastAction) {
       setMessage(gameState.lastAction);
     }
  }, [gameState?.lastAction]);

  useEffect(() => {
      if (winner) {
          setMessage(`WINNER! ${players.find(p => p.id === winner)?.name} has won the game!`);
      }
  }, [winner]);

  const handleStartGame = async () => {
    if (players.length < 2) return;
    try {
      setMessage('Dealer is shuffling...');
      await startGameOnServer(localRoomCode, players);
    } catch (err: any) {
      console.error("Start failed", err);
      setMessage(`Failed to start: ${err.message}`);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(localRoomCode);
    setMessage('Room code copied!');
    setTimeout(() => setMessage(''), 2000);
  };
  
  // Helper to Position Players Radially
  const getPlayerPosition = (index: number, total: number) => {
      // Logic: 0 is Bottom, increasing clockwise?
      const angle = (index * (360 / total)) + 90; 
      const radian = (angle * Math.PI) / 180;
      const radius = 35; // % of viewport
      const x = 50 + radius * Math.cos(radian);
      const y = 50 + radius * Math.sin(radian);
      return { left: `${x}%`, top: `${y}%` };
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col font-sans"
         style={{ 
             background: 'var(--whot-table-gradient)',
         }}>
      {/* Wood Texture Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-overlay"
           style={{ backgroundImage: 'var(--whot-wood-texture)' }} />

      {/* Header / HUD */}
      <div className="relative z-10 flex items-center justify-between px-8 py-4 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-6">
            <div className="flex flex-col">
                <span className="text-yellow-400 text-[10px] md:text-xs uppercase tracking-widest font-bold opacity-80">
                  {isSpectator ? 'Spectating' : 'Room Code'}
                </span>
                <div className="flex items-center gap-3">
                    <span className="text-3xl md:text-5xl font-black text-white tracking-wider font-mono drop-shadow-md">{localRoomCode}</span>
                    {!isSpectator && (
                      <>
                        <button onClick={copyCode} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all">
                            <Copy className="w-5 h-5"/>
                        </button>
                        <button onClick={() => setShowQR(!showQR)} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all">
                            <QrCode className="w-5 h-5"/>
                        </button>
                      </>
                    )}
                </div>
            </div>
        </div>

        {/* Unified Message Banner - Shows power card effects only when active */}
        <div className="absolute left-1/2 -translate-x-1/2 top-24 pointer-events-none z-50">
             {gameState?.effectActive && !winner ? (
                 <div className="bg-red-600/90 px-8 py-3 rounded-full border border-red-400/50 shadow-[0_0_20px_rgba(220,38,38,0.5)] animate-bounce flex flex-col items-center">
                     <p className="text-white font-black uppercase tracking-widest text-lg drop-shadow-md">
                        {gameState.effectActive === 'general_market' ? "GO TO MARKET!" : 
                         gameState.effectActive === 'pick_two' ? "PICK TWO!" :
                         gameState.effectActive === 'pick_three' ? "PICK THREE!" :
                         gameState.effectActive === 'suspension' ? "SUSPENSION!" : ""}
                     </p>
                     <p className="text-white/80 text-xs font-medium mt-1">{gameState?.lastAction}</p>
                 </div>
             ) : gameState?.currentCard?.number === 20 && gameState?.selectedShape && !winner ? (
                 <div className="bg-red-600/90 px-8 py-3 rounded-full border border-red-400/50 shadow-[0_0_20px_rgba(220,38,38,0.5)] animate-bounce flex flex-col items-center">
                     <p className="text-white font-black uppercase tracking-widest text-lg drop-shadow-md">
                        I NEED {gameState.selectedShape.toUpperCase()}!
                     </p>
                     <p className="text-white/80 text-xs font-medium mt-1">{gameState?.lastAction}</p>
                 </div>
             ) : (
                <div className="bg-black/60 backdrop-blur-md px-8 py-3 rounded-full border border-white/10 shadow-xl">
                    <p className="text-white/90 font-medium tracking-wide">
                        {gameState?.lastAction || "Waiting for game to start..."}
                    </p>
                </div>
             )}
        </div>

        <div className="flex items-center gap-4">
           {/* Connection Status */}
           <div className={`flex items-center gap-2 px-4 py-2 rounded-full bg-black/30 backdrop-blur ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
               <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
               <span className="text-sm font-bold uppercase">{isConnected ? 'Online' : 'Offline'}</span>
           </div>
           
           <button onClick={onExit} className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg font-bold text-sm transition-all border border-red-500/50">
               {isSpectator ? 'Exit' : 'End Game'}
           </button>
        </div>
      </div>

       {/* QR Code Modal */}
       {showQR && (
           <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowQR(false)}>
               <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                   <QRCodeSVG 
                       value={`${window.location.origin}/?room=${localRoomCode}`}
                       size={256}
                       level="H"
                       includeMargin
                   />
                   <p className="mt-4 text-xl font-black text-gray-800 tracking-wide">SCAN TO JOIN</p>
                   <p className="text-gray-500 font-mono tracking-widest text-lg">{localRoomCode}</p>
                   <button onClick={() => setShowQR(false)} className="mt-4 text-sm text-gray-400 underline">Close</button>
               </div>
           </div>
       )}

      {/* Main Game Table Area */}
      <div className="flex-1 relative container mx-auto perspective-[1000px]">
          
          {/* Winner Overlay */}
          {winner && (
              <WinnerOverlay 
                  winnerName={players.find(p => p.id === winner)?.name}
                  isMe={false}
                  players={gameState!.players} // Safe assertion: winner implies gameState exists
                  isHost={true}
                  onHostRestart={() => startGameOnServer(localRoomCode, gameState!.players)}
              />
          )}

          {/* Lobby View (Pre-game) */}
           {!gameState?.gameStarted && !winner && (
               <div className="absolute inset-0 flex flex-col items-center justify-center z-20 overflow-y-auto p-4">
                   <div className="bg-black/30 backdrop-blur-md p-6 md:p-12 rounded-3xl border border-white/10 shadow-2xl text-center max-w-2xl w-full my-auto">
                       <Crown className="w-12 h-12 md:w-16 md:h-16 text-yellow-400 mx-auto mb-4 md:mb-6" />
                       <h2 className="text-3xl md:text-4xl font-black text-white mb-2">Ready to Play?</h2>
                       <p className="text-white/60 text-lg mb-6 md:mb-8">Waiting for players to join room {localRoomCode}</p>

                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                          {players.map(p => (
                              <div key={p.id} className="bg-white/10 px-6 py-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-black font-bold">
                                      {p.name.charAt(0)}
                                  </div>
                                  <span className="text-white font-bold text-lg">{p.name}</span>
                              </div>
                          ))}
                          {[...Array(Math.max(0, 2 - players.length))].map((_, i) => (
                              <div key={`empty-${i}`} className="border-2 border-dashed border-white/20 px-6 py-4 rounded-xl flex items-center justify-center text-white/30 font-medium">
                                  Waiting...
                              </div>
                          ))}
                      </div>

                      {!isSpectator ? (
                        <button
                            onClick={handleStartGame}
                            disabled={players.length < 2 || !isConnected}
                            className="w-full py-4 bg-yellow-400 text-black font-black text-xl rounded-xl hover:bg-yellow-300 disabled:opacity-50 disabled:grayscale transition-all shadow-lg hover:shadow-yellow-400/20"
                        >
                            START MATCH
                        </button>
                      ) : (
                        <div className="w-full py-4 bg-purple-500/30 text-purple-200 font-bold text-lg rounded-xl text-center border border-purple-500/50">
                            👁️ Waiting for host to start...
                        </div>
                      )}
                   </div>
               </div>
           )}

          {/* Active Game Layout */}
          {gameState?.gameStarted && !winner && (
            <>
              {/* Players - Orbiting */}
              {players.map((player, idx) => {
                  const pos = getPlayerPosition(idx, players.length);
                  const isCurrent = idx === gameState.currentPlayerIndex;
                  const cardCount = gameState.playerHands?.[player.id]?.length || 0;

                  return (
                      <div 
                        key={player.id}
                        className={`absolute flex flex-col items-center transition-all duration-500 ${isCurrent ? 'scale-110 z-30' : 'scale-90 opacity-80 z-20'}`}
                        style={{ 
                            left: pos.left, 
                            top: pos.top, 
                            transform: 'translate(-50%, -50%)' 
                        }}
                      >
                           {/* Avatar Bubble */}
                           <div className={`
                               relative w-20 h-20 rounded-full border-4 flex items-center justify-center shadow-2xl mb-2 bg-gray-900 transition-colors duration-300
                               ${isCurrent ? 'border-yellow-400 ring-4 ring-yellow-400/30' : 'border-white/20'}
                           `}>
                               {isCurrent && (
                                   <div className="absolute -top-8 animate-bounce">
                                       <Crown className="w-8 h-8 text-yellow-400 drop-shadow-md fill-current"/>
                                   </div>
                               )}
                               <span className="text-3xl font-black text-white">{player.name.charAt(0).toUpperCase()}</span>
                               
                               {/* Card Count Badge */}
                               <div className="absolute -right-2 -bottom-2 w-8 h-8 bg-red-600 rounded-full border-2 border-white flex items-center justify-center shadow-lg z-10">
                                   <span className="text-white font-bold text-sm">
                                       {cardCount}
                                   </span>
                               </div>
                           </div>
                           
                           {/* Name Label */}
                           <div className="bg-black/60 backdrop-blur px-4 py-1 rounded-full border border-white/10 shadow-lg">
                               <span className={`text-sm font-bold uppercase tracking-wider ${isCurrent ? 'text-yellow-400' : 'text-white'}`}>
                                   {player.name}
                               </span>
                           </div>

                           {/* Hand visual (Just backs of cards fanned out small) */}
                           <div className="absolute -z-10 -bottom-8 flex -space-x-4 opacity-80">
                               {/* We assume we know count. Just show max 3-5 visual cards */}
                               {[...Array(Math.min(5, cardCount))].map((_, i) => (
                                   <div key={i} className="w-10 h-14 bg-red-900 rounded border border-white/20 shadow-md transform origin-bottom" style={{ transform: `rotate(${(i-2)*15}deg)` }}/>
                               ))}
                           </div>
                      </div>
                  );
              })}

              {/* Center Table: Playing Piles */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-12 z-10">
                  
                  {/* Draw Pile (Market) */}
                  <div className="relative group perspective-500">
                      {/* Stack effect */}
                      <div className="absolute top-2 left-2 w-24 h-36 bg-red-950 rounded-xl border border-white/10 rotate-3 shadow-lg"/>
                      <div className="absolute top-1 left-1 w-24 h-36 bg-red-900 rounded-xl border border-white/10 rotate-1 shadow-lg"/>
                      
                      <WhotCard 
                          card={{ id: 'deck', shape: 'circle', number: 20 }} // Dummy
                          faceDown
                          className="relative shadow-2xl z-10"
                      />
                      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/40 rounded-full border border-white/10 backdrop-blur">
                          <span className="text-white/70 text-xs font-bold uppercase tracking-widest">Market</span>
                      </div>
                  </div>

                  {/* Discard Pile (Top Card) */}
                  <div className="relative z-20">
                      {gameState?.effectActive && (
                          <div className="absolute -top-20 left-1/2 -translate-x-1/2 whitespace-nowrap z-50 animate-in slide-in-from-bottom-4 fade-in">
                              <div className="px-6 py-2 bg-yellow-400 text-black font-black text-xl rounded-full shadow-[0_0_20px_rgba(250,204,21,0.5)] border-4 border-white uppercase flex items-center gap-2 transform -rotate-2">
                                  <AlertCircle className="w-6 h-6 fill-current"/>
                                  {gameState.effectActive.replace('_', ' ')}
                              </div>
                          </div>
                      )}

                      {topCard ? (
                          <div className="animate-in fade-in zoom-in duration-300">
                             <WhotCard card={topCard} className="shadow-[0_20px_50px_rgba(0,0,0,0.5)] scale-125" />
                          </div>
                      ) : (
                          <div className="w-24 h-36 border-4 border-dashed border-white/10 rounded-xl flex items-center justify-center bg-black/20">
                              <span className="text-white/20 font-bold">START</span>
                          </div>
                      )}

                      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/40 rounded-full border border-white/10 backdrop-blur">
                          <span className="text-white/70 text-xs font-bold uppercase tracking-widest">Played</span>
                      </div>
                  </div>
              </div>
            </>
          )}

      </div>
      
      {/* Chat Panel (slides in from right) */}
      <div className={`fixed right-0 top-0 bottom-0 w-80 bg-black/40 backdrop-blur-md border-l border-white/10 flex flex-col z-40 transition-transform duration-300 ${showChat ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Chat Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/20">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-yellow-400" />
            <span className="text-white font-bold text-sm uppercase tracking-widest">Live Chat</span>
          </div>
          <button 
            onClick={() => setShowChat(false)}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Chat Messages (bottom-to-top flow) */}
        <div className="flex-1 overflow-y-auto flex flex-col-reverse p-4 gap-2">
          {chatMessages.slice().reverse().map((msg, index) => (
            <div 
              key={`${msg.timestamp}-${index}`}
              className="animate-in slide-in-from-bottom-2 fade-in duration-300"
            >
              <span className="text-yellow-400 font-bold text-sm">{msg.playerName}</span>
              <span className="text-white/80 text-sm ml-2">{msg.message}</span>
            </div>
          ))}
          {chatMessages.length === 0 && (
            <div className="text-white/30 text-sm text-center">
              No messages yet...
            </div>
          )}
        </div>
        
        {/* Privacy Footnote */}
        <div className="px-4 py-2 border-t border-white/5 bg-black/20">
          <p className="text-white/30 text-[10px] text-center flex items-center justify-center gap-1">
            <span>Messages will disappear when the session ends</span>
          </p>
        </div>
      </div>
    </div>
  );
}
