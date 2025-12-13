import { useState, useEffect, useCallback } from 'react';
import { useGameConnection } from '../../utils/useGameConnection';
import { WhotCard } from '../card';
import { QrCode, Copy, Trophy, Crown, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface HostViewProps {
  onExit: () => void;
}

export function HostView({ onExit }: HostViewProps) {
  // Generate room code once on mount
  const [localRoomCode] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());
  
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
  }, []);

  const { 
    gameState, 
    isConnected, 
    startGame: startGameOnServer, 
    sendMessage
  } = useGameConnection(localRoomCode, handleMessage);

  const [message, setMessage] = useState('Waiting for players...');
  const [showQR, setShowQR] = useState(false);
  
  // Game state derived - Merge local lobby players with server game players
  const players = gameState?.players || localPlayers;
  const topCard = gameState?.currentCard;
  const winner = gameState?.winner;

  // Effects for sounds/messages
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
                <span className="text-yellow-400 text-[10px] md:text-xs uppercase tracking-widest font-bold opacity-80">Room Code</span>
                <div className="flex items-center gap-3">
                    <span className="text-3xl md:text-5xl font-black text-white tracking-wider font-mono drop-shadow-md">{localRoomCode}</span>
                    <button onClick={copyCode} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all">
                        <Copy className="w-5 h-5"/>
                    </button>
                    <button onClick={() => setShowQR(!showQR)} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all">
                        <QrCode className="w-5 h-5"/>
                    </button>
                </div>
            </div>
        </div>

        {/* Unified Message Banner - HOST SEES ALL */}
        <div className="absolute left-1/2 -translate-x-1/2 top-24 pointer-events-none z-50">
             {gameState?.currentCard && [1, 2, 5, 8, 14, 20].includes(gameState.currentCard.number) ? (
                 <div className="bg-red-600/90 px-8 py-3 rounded-full border border-red-400/50 shadow-[0_0_20px_rgba(220,38,38,0.5)] animate-bounce flex flex-col items-center">
                     <p className="text-white font-black uppercase tracking-widest text-lg drop-shadow-md">
                        {gameState.currentCard.number === 14 ? "GO TO MARKET!" : 
                         gameState.currentCard.number === 2 ? "PICK TWO!" :
                         gameState.currentCard.number === 5 ? "PICK THREE!" :
                         gameState.currentCard.number === 1 ? "HOLD ON!" :
                         gameState.currentCard.number === 8 ? "SUSPENSION!" : 
                         gameState.currentCard.number === 20 ? `I NEED ${gameState.selectedShape?.toUpperCase() || "A SHAPE"}!` : ""}
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
               End Game
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
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center animate-in zoom-in bg-black/50 backdrop-blur-sm">
                  <Trophy className="w-32 h-32 text-yellow-400 drop-shadow-lg mb-4 animate-bounce" />
                  <h1 className="text-6xl font-black text-white drop-shadow-xl text-center">
                      {players.find(p => p.id === winner)?.name} Wins!
                  </h1>
                  <button 
                    onClick={() => startGameOnServer(localRoomCode, players)} 
                    className="mt-8 px-8 py-4 bg-yellow-400 hover:bg-yellow-300 text-black text-xl font-black rounded-xl shadow-xl transition-all hover:scale-105"
                  >
                      PLAY AGAIN
                  </button>
              </div>
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

                      <button
                          onClick={handleStartGame}
                          disabled={players.length < 2 || !isConnected}
                          className="w-full py-4 bg-yellow-400 text-black font-black text-xl rounded-xl hover:bg-yellow-300 disabled:opacity-50 disabled:grayscale transition-all shadow-lg hover:shadow-yellow-400/20"
                      >
                          START MATCH
                      </button>
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
    </div>
  );
}
