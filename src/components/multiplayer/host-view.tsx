import { useState, useCallback, useEffect, useRef } from 'react';
import { GameMessage, GameRules, DEFAULT_RULES } from '../../types/game';
import { useGameConnection } from '../../utils/useGameConnection';
import { useGameAnnouncer } from '../../hooks/useGameAnnouncer';
import { ChatPanel, ChatMessage } from '../chat';
import { WhotCard } from '../card';
import { QrCode, Copy, Crown, AlertCircle, X, Settings, Info } from 'lucide-react';
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

  // Chat State
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Rules Configuration State
  const [rules, setRules] = useState<GameRules>({ ...DEFAULT_RULES });
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showRulesInfo, setShowRulesInfo] = useState(false);

  // Handle incoming messages (Join requests)
  const handleMessage = useCallback((msg: GameMessage) => {
      if (msg.type === 'join' && msg.playerName) {
          setLocalPlayers(prev => {
              if (prev.find(p => p.id === msg.playerId)) return prev;
              return [...prev, { id: msg.playerId, name: msg.playerName! }];
          });
      }
      // Chat messages
      if (msg.type === 'toggle_chat') {
          setShowChat(prev => !prev); // Toggle instead of just opening
      }
      if (msg.type === 'activate_chat') {
          setShowChat(true);
      }
      if (msg.type === 'chat_message' && msg.playerName && msg.message) {
          setShowChat(true);
          setChatMessages(prev => [
              ...prev,
              { playerName: msg.playerName!, message: msg.message!, timestamp: msg.timestamp || Date.now() }
          ].slice(-20));
      }
      // Rules updates from other players
      if (msg.type === 'rules_update' && msg.rules) {
          setRules(prev => ({ ...prev, ...msg.rules }));
      }
  }, []);

  const { 
    gameState, 
    isConnected, 
    startGame: startGameOnServer
  } = useGameConnection(localRoomCode, handleMessage);

  // Use shared announcer hook (host always plays sounds)
  useGameAnnouncer({ gameState, isMuted: false });

  const [message, setMessage] = useState('Waiting for players...');
  const [showQR, setShowQR] = useState(false);
  
  // Game state derived - Merge local lobby players with server game players
  const players = gameState?.players || localPlayers;
  const topCard = gameState?.currentCard;
  const winner = gameState?.winner;

  // Track if this is a rematch (game has been played before in this session)
  const hasPlayedBefore = useRef(false);

  // Auto-start when all players are ready (for rematches only)
  useEffect(() => {
    // Mark that a game has been played when we see a winner
    if (winner) {
      hasPlayedBefore.current = true;
    }

    // Only auto-start for rematches (not first game)
    if (!hasPlayedBefore.current) return;
    
    // Need at least 2 players and a winner (game ended)
    if (!winner || !gameState?.players || gameState.players.length < 2) return;
    
    // Check if ALL players are ready
    const allReady = gameState.players.every(p => p.isReady);
    if (!allReady) return;

    // Auto-start the next game!
    console.log('All players ready - auto-starting rematch...');
    startGameOnServer(localRoomCode, gameState.players, rules);
  }, [winner, gameState?.players, localRoomCode, rules, startGameOnServer]);

  const statusMessage = winner
    ? `WINNER! ${players.find(p => p.id === winner)?.name} has won the game!`
    : (gameState?.lastAction || message || 'Waiting for game to start...');

  const handleStartGame = async () => {
    if (players.length < 2) return;
    try {
      setMessage('Dealer is shuffling...');
      await startGameOnServer(localRoomCode, players, rules);
    } catch (err: unknown) {
      console.error("Start failed", err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessage(`Failed to start: ${msg}`);
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
                  {statusMessage}
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
                        <>
                          {/* Rules Configuration Button */}
                          <button
                              onClick={() => setShowRulesModal(true)}
                              className="w-full py-3 mb-3 bg-white/10 hover:bg-white/20 text-white font-bold text-lg rounded-xl transition-all border border-white/20 flex items-center justify-center gap-2"
                          >
                              <Settings className="w-5 h-5" />
                              Set Rules
                          </button>
                          
                          <button
                              onClick={handleStartGame}
                              disabled={players.length < 2 || !isConnected}
                              className="w-full py-4 bg-yellow-400 text-black font-black text-xl rounded-xl hover:bg-yellow-300 disabled:opacity-50 disabled:grayscale transition-all shadow-lg hover:shadow-yellow-400/20"
                          >
                              START MATCH
                          </button>
                        </>
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
                               
                               {/* Session Wins Badge */}
                               <div className="absolute -right-2 -bottom-2 w-8 h-8 bg-red-600 rounded-full border-2 border-white flex items-center justify-center shadow-lg z-10">
                                   <span className="text-white font-bold text-sm">
                                       {gameState.sessionWins?.[player.id] || 0}
                                   </span>
                               </div>
                           </div>
                           
                           {/* Name Label */}
                           <div className="bg-black/60 backdrop-blur px-4 py-1 rounded-full border border-white/10 shadow-lg">
                               <span className={`text-sm font-bold uppercase tracking-wider ${isCurrent ? 'text-yellow-400' : 'text-white'}`}>
                                   {player.name}
                               </span>
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
      
      {/* Shared Chat Panel Component (Host view - no input) */}
      <ChatPanel
        isOpen={showChat && !winner}
        onClose={() => setShowChat(false)}
        messages={chatMessages}
        currentPlayerName="Host"
        chatInput=""
        onChatInputChange={() => {}}
        onSendMessage={() => {}}
        showInput={false}
      />

      {/* Rules Configuration Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowRulesModal(false)}>
          <div className="bg-gray-900 p-6 md:p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-white flex items-center gap-2">
                <Settings className="w-6 h-6 text-yellow-400" />
                Game Rules
              </h3>
              <button onClick={() => setShowRulesModal(false)} className="text-white/50 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Pick Two */}
              <label className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-all">
                <div>
                  <span className="text-white font-bold">Pick Two (Card 2)</span>
                  <p className="text-white/50 text-sm">Next player draws 2 cards</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={rules.pickTwo} 
                  onChange={(e) => setRules(prev => ({ ...prev, pickTwo: e.target.checked }))}
                  className="w-5 h-5 accent-yellow-400"
                />
              </label>
              
              {/* Pick Three */}
              <label className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-all">
                <div>
                  <span className="text-white font-bold">Pick Three (Card 5)</span>
                  <p className="text-white/50 text-sm">Next player draws 3 cards</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={rules.pickThree} 
                  onChange={(e) => setRules(prev => ({ ...prev, pickThree: e.target.checked }))}
                  className="w-5 h-5 accent-yellow-400"
                />
              </label>
              
              {/* Defend Pick */}
              <label className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-all">
                <div>
                  <span className="text-white font-bold">Defend Pick 2/3</span>
                  <p className="text-white/50 text-sm">Counter with another Pick card (stacking)</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={rules.defendPick} 
                  onChange={(e) => setRules(prev => ({ ...prev, defendPick: e.target.checked }))}
                  className="w-5 h-5 accent-yellow-400"
                />
              </label>
              
              {/* Win with Hold On */}
              <label className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-all">
                <div>
                  <span className="text-white font-bold">Win with Hold On</span>
                  <p className="text-white/50 text-sm">Can win by playing card 1 as last card</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={rules.winWithHoldOn} 
                  onChange={(e) => setRules(prev => ({ ...prev, winWithHoldOn: e.target.checked }))}
                  className="w-5 h-5 accent-yellow-400"
                />
              </label>
            </div>
            
            <div className="mt-6 flex gap-3">
              <button 
                onClick={() => setRules({ ...DEFAULT_RULES })}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all"
              >
                Reset Defaults
              </button>
              <button 
                onClick={() => setShowRulesModal(false)}
                className="flex-1 py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-xl transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Info Button (during gameplay) */}
      {gameState?.gameStarted && !winner && (
        <button
          onClick={() => setShowRulesInfo(true)}
          className="fixed bottom-4 right-4 z-30 w-12 h-12 bg-black/60 hover:bg-black/80 backdrop-blur rounded-full flex items-center justify-center text-yellow-400 border border-white/10 shadow-lg transition-all"
          title="View Rules"
        >
          <Info className="w-6 h-6" />
        </button>
      )}

      {/* Rules Info Panel (during gameplay) */}
      {showRulesInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowRulesInfo(false)}>
          <div className="bg-gray-900 p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 border border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Info className="w-5 h-5 text-yellow-400" />
                Active Rules
              </h3>
              <button onClick={() => setShowRulesInfo(false)} className="text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-2">
              <div className={`flex items-center justify-between p-3 rounded-lg ${gameState?.rules?.pickTwo ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
                <span className="text-white font-medium">Pick Two (Card 2)</span>
                <span className={`text-sm font-bold ${gameState?.rules?.pickTwo ? 'text-green-400' : 'text-red-400'}`}>
                  {gameState?.rules?.pickTwo ? 'ON' : 'OFF'}
                </span>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg ${gameState?.rules?.pickThree ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
                <span className="text-white font-medium">Pick Three (Card 5)</span>
                <span className={`text-sm font-bold ${gameState?.rules?.pickThree ? 'text-green-400' : 'text-red-400'}`}>
                  {gameState?.rules?.pickThree ? 'ON' : 'OFF'}
                </span>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg ${gameState?.rules?.defendPick ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
                <span className="text-white font-medium">Defend/Stack</span>
                <span className={`text-sm font-bold ${gameState?.rules?.defendPick ? 'text-green-400' : 'text-red-400'}`}>
                  {gameState?.rules?.defendPick ? 'ON' : 'OFF'}
                </span>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg ${gameState?.rules?.winWithHoldOn ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
                <span className="text-white font-medium">Win with Hold On</span>
                <span className={`text-sm font-bold ${gameState?.rules?.winWithHoldOn ? 'text-green-400' : 'text-red-400'}`}>
                  {gameState?.rules?.winWithHoldOn ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
            
            {gameState?.rulesLocked && (
              <p className="mt-4 text-white/40 text-xs text-center">
                🔒 Rules are locked for this game
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
