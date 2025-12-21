// Controller View Component - Refactored with shared hooks and components
import { useState, useEffect, useCallback, useRef } from 'react';
import { canDefendAgainstPick, canPlayCard } from '../../utils/whot-rules';
import { useGameConnection } from '../../utils/useGameConnection';
import { useAutoPlay } from '../../hooks/useAutoPlay';
import { useGameAnnouncer } from '../../hooks/useGameAnnouncer';
import { ChatPanel, ChatMessage } from '../chat';
import { Card, CardShape, GameMessage } from '../../types/game';
import { WhotCard } from '../card';
import { ArrowLeft, RefreshCw, Send, AlertTriangle, Circle, Square, Triangle, Star, X, MessageCircle, Volume2, VolumeX, Info } from 'lucide-react';
import { WinnerOverlay } from './winner-overlay';
import { STATUS_COLORS } from '../../utils/theme-constants';

interface ControllerViewProps { roomCode: string; onBack: () => void; }

export function ControllerView({ roomCode, onBack }: ControllerViewProps) {
  const [playerId] = useState(() => {
    const saved = localStorage.getItem('whot-player-id');
    if (saved) return saved;
    const newId = `player-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    localStorage.setItem('whot-player-id', newId);
    return newId;
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [showRulesInfo, setShowRulesInfo] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const processedMessagesRef = useRef<Set<string>>(new Set());

  const handleMessage = useCallback((msg: GameMessage) => {
    if (msg.type !== 'chat_message') {
      const msgKey = `${msg.type}-${msg.playerId}-${msg.timestamp}`;
      if (processedMessagesRef.current.has(msgKey)) return;
      processedMessagesRef.current.add(msgKey);
      if (processedMessagesRef.current.size > 100) {
        processedMessagesRef.current = new Set(Array.from(processedMessagesRef.current).slice(-50));
      }
    }
    const cards = msg.cards;
    if (msg.type === 'deal' && msg.playerId === playerId && cards) { setHand(cards); setMessage('Game Started! Good Luck!'); }
    if (msg.type === 'draw' && msg.playerId === playerId && cards) { 
      // Deduplicate to prevent stale state issues after auto-play
      setHand(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const newCards = cards.filter(c => !existingIds.has(c.id));
        return [...prev, ...newCards];
      }); 
    }
    if (msg.type === 'card_played' && msg.playerId === playerId && msg.card) { setHand(prev => prev.filter(c => c.id !== msg.card!.id)); }
    if (msg.type === 'chat_message' && msg.playerName && msg.message) {
      // Skip own messages (already added optimistically)
      if (msg.playerId === playerId) return;
      setChatMessages(prev => [...prev, { playerName: msg.playerName!, message: msg.message!, timestamp: msg.timestamp || Date.now() }].slice(-20));
      // Increment unread count if chat is closed
      setUnreadCount(prev => prev + 1);
    }
  }, [playerId]);

  const { gameState, isConnected, error, joinGame, playCard: playCardOnServer, drawCard: drawCardOnServer, getHand, setReady, fetchGameState, sendMessage, triggerAutoPlay } = useGameConnection(roomCode, handleMessage);

  const [playerName, setPlayerName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [hand, setHand] = useState<Card[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [message, setMessage] = useState('Enter your name to join...');
  const [loading, setLoading] = useState(false);
  const [showShapePicker, setShowShapePicker] = useState(false);
  const [pendingCard, setPendingCard] = useState<Card | null>(null);
  const hasAttemptedStateFetch = useRef(false);

  const currentPlayerId = gameState?.players?.[gameState?.currentPlayerIndex]?.id;
  const isMyTurn = currentPlayerId === playerId;
  const winner = gameState?.winner;
  const iWon = winner === playerId;

  // Validate turn is still ours before auto-play (prevents stale state issues)
  const validateTurn = useCallback(() => {
    const currentPlayer = gameState?.players?.[gameState?.currentPlayerIndex]?.id;
    return currentPlayer === playerId;
  }, [gameState?.players, gameState?.currentPlayerIndex, playerId]);

  const { showCountdown, isCritical, secondsLeft } = useAutoPlay({
    isMyTurn, gameStarted: !!gameState?.gameStarted, hasWinner: !!winner,
    turnStartTime: gameState?.turnStartTime, roomCode, playerId, onAutoPlay: triggerAutoPlay,
    validateTurn
  });

  useGameAnnouncer({ gameState, isMuted });

  const fetchHand = useCallback(async () => { try { setHand(await getHand(roomCode, playerId)); } catch (e) { console.error("Failed to fetch hand", e); } }, [getHand, roomCode, playerId]);

  useEffect(() => {
    if (!isConnected) { hasAttemptedStateFetch.current = false; return; }
    if (!roomCode || hasAttemptedStateFetch.current) return;
    if (gameState) { hasAttemptedStateFetch.current = true; return; }
    hasAttemptedStateFetch.current = true;
    fetchGameState(roomCode);
  }, [isConnected, roomCode, gameState, fetchGameState]);

  useEffect(() => { if (gameState?.gameStarted && isJoined && hand.length === 0) fetchHand(); }, [gameState?.gameStarted, isJoined, hand.length, fetchHand]);

  useEffect(() => {
    if (gameState?.gameStarted && !isJoined && playerId) {
      const myPlayer = gameState.players.find(p => p.id === playerId);
      if (myPlayer) { setPlayerName(myPlayer.name); setIsJoined(true); setMessage('Welcome back!'); }
    }
  }, [gameState, isJoined, playerId]);

  useEffect(() => {
    if (gameState?.lastAction) {
      let msg = gameState.lastAction;
      if (playerName && msg.includes(playerName)) {
        msg = msg.replace(new RegExp(`Warning, ${playerName} has two cards left!`, 'i'), '').replace(new RegExp(`\\. ${playerName} is on last card!`, 'i'), '').trim();
        if (msg.endsWith('.')) msg = msg.slice(0, -1);
      }
      setMessage(msg);
    }
  }, [gameState?.lastAction, playerName]);

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    setLoading(true);
    try { await joinGame(roomCode, playerName, playerId); setIsJoined(true); setMessage('Joined! Waiting for host to start...'); }
    catch (err: unknown) { setMessage(`Failed to join: ${err instanceof Error ? err.message : 'Unknown error'}`); }
    finally { setLoading(false); }
  };

  const handlePlayCard = async (card: Card, shape: CardShape | null = null) => {
    if (!isMyTurn) { setMessage('Not your turn.'); return; }
    if (gameState?.effectActive === 'general_market') { setMessage("General Market! You must PICK a card."); navigator.vibrate?.(200); return; }
    if (gameState?.currentCard) {
      const isValid = (gameState.effectActive === 'pick_two' || gameState.effectActive === 'pick_three') ? canDefendAgainstPick(card, gameState) : canPlayCard(card, gameState.currentCard, gameState.selectedShape);
      if (!isValid) { setMessage("Invalid Move! Check shape/number."); navigator.vibrate?.(200); return; }
    }
    if (card.number === 20 && !shape) { setPendingCard(card); setShowShapePicker(true); return; }
    setLoading(true);
    try { await playCardOnServer(roomCode, playerId, card, shape); setHand(prev => prev.filter(c => c.id !== card.id)); setPendingCard(null); setShowShapePicker(false); setMessage("Card played!"); }
    catch (err: unknown) { setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`); }
    finally { setLoading(false); }
  };

  const handleDraw = async () => {
    setLoading(true);
    try { await drawCardOnServer(roomCode, playerId); setMessage("Drawing cards..."); }
    catch (err: unknown) { setMessage(`Error drawing: ${err instanceof Error ? err.message : 'Unknown error'}`); }
    finally { setLoading(false); }
  };

  const handleToggleChat = () => { 
    const newShowChat = !showChat;
    setShowChat(newShowChat); 
    if (newShowChat) setUnreadCount(0); // Clear unread when opening
    sendMessage({ type: 'toggle_chat', playerId }); 
  };
  const handleSendChatMessage = () => { 
    if (!chatInput.trim()) return; 
    const newMsg: ChatMessage = { playerName: playerName || 'Player', message: chatInput.trim(), timestamp: Date.now() };
    setChatMessages(prev => [...prev, newMsg].slice(-20)); // Optimistic UI - show message immediately
    sendMessage({ type: 'chat_message', playerId, playerName: playerName || 'Player', message: chatInput.trim() }); 
    setChatInput(''); 
  };
  const getConnectionStatusColor = () => error ? 'text-red-400' : isConnected ? 'text-green-400' : 'text-yellow-400 animate-pulse';

  // Join Screen
  if (!isJoined) {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center p-6 text-white bg-cover bg-center font-sans overflow-hidden" style={{ background: 'var(--whot-table-gradient)' }}>
        <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-overlay" style={{ backgroundImage: 'var(--whot-wood-texture)' }} />
        <button onClick={onBack} className="absolute top-4 left-4 z-50 px-4 py-2 bg-black/40 hover:bg-black/60 backdrop-blur rounded-lg transition-all flex items-center gap-2 border border-white/10 text-sm font-bold shadow-lg"><ArrowLeft className="w-4 h-4" /> Back</button>
        <div className="relative z-10 max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl mb-6 font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 drop-shadow-sm">JOIN GAME</h1>
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-8 mb-6 shadow-2xl">
              <p className="text-xs uppercase tracking-widest opacity-60 mb-2 font-bold">Room Code</p>
              <p className="text-6xl tracking-widest font-mono font-bold text-white drop-shadow-lg">{roomCode}</p>
            </div>
            <div className={`inline-flex items-center justify-center gap-2 px-4 py-2 bg-black/30 rounded-full border border-white/5 ${getConnectionStatusColor()}`}>
              <RefreshCw className={`w-4 h-4 ${!isConnected && !error ? 'animate-spin' : ''}`} />
              <span className="text-xs font-bold uppercase">{error ? 'Error' : isConnected ? 'Connected' : 'Connecting...'}</span>
            </div>
          </div>
          <form onSubmit={handleJoinGame} className="space-y-4">
            <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="ENTER YOUR NAME" 
              onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
              className="w-full px-6 py-4 bg-white/10 border-2 border-white/20 rounded-xl focus:outline-none focus:border-yellow-400 text-white placeholder-white/30 transition-all text-center font-bold text-lg uppercase tracking-wider backdrop-blur-sm" autoFocus maxLength={12} />
            <button type="submit" disabled={!playerName.trim() || !isConnected || loading} className="w-full px-6 py-4 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black rounded-xl text-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3 shadow-xl font-black uppercase tracking-wide">
              {loading ? <RefreshCw className="animate-spin"/> : <Send className="w-5 h-5" />} Join Table
            </button>
          </form>
          {error && <div className="mt-4 bg-red-900/40 border border-red-500/50 rounded-xl p-4 text-sm flex items-start gap-3 backdrop-blur-sm"><AlertTriangle className="w-5 h-5 text-red-400 shrink-0"/><p className="text-red-200 font-medium">{error}</p></div>}
        </div>
      </div>
    );
  }


  // Active Game UI
  return (
    <div className="fixed inset-0 flex flex-col font-sans" style={{ background: 'var(--whot-table-gradient)' }}>
      <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-overlay" style={{ backgroundImage: 'var(--whot-wood-texture)' }} />
      {winner && <WinnerOverlay winnerName={gameState.players.find(p => p.id === winner)?.name} isMe={iWon} players={gameState.players} isHost={false} myPlayerId={playerId} onPlayAgain={() => setReady(roomCode, playerId)} />}

      {!winner && (
        <div className="relative z-20 flex items-center justify-between p-4 bg-black/40 backdrop-blur-md border-b border-white/5">
          <button onClick={onBack} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white border border-white/10"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex flex-col items-center">
            <div className="text-white text-base font-bold uppercase tracking-widest">{playerName}</div>
            {isMyTurn && <div className="text-sm font-black bg-yellow-400 text-black px-4 py-1 rounded-full animate-pulse shadow-lg mt-1 tracking-wider border-2 border-yellow-200">YOUR TURN</div>}
          </div>
          <div className="flex gap-2">
            {gameState?.gameStarted && <button onClick={() => setShowRulesInfo(true)} className="p-2 rounded-full transition-all border border-white/10 bg-white/10 text-white/60 hover:bg-white/20 hover:text-white" title="View Rules"><Info className="w-5 h-5" /></button>}
            <button onClick={handleToggleChat} className={`relative p-2 rounded-full transition-all border border-white/10 ${showChat ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'}`} title="Toggle Chat">
              <MessageCircle className="w-5 h-5" />
              {!showChat && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse border-2 border-black/50">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button onClick={() => setIsMuted(!isMuted)} className={`p-2 rounded-full transition-all border border-white/10 ${!isMuted ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-white/10 text-white/50'}`} title={isMuted ? 'Enable Sound' : 'Mute Sound'}>{isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}</button>
          </div>
        </div>
      )}

      {!winner && (
        <div className={`relative z-10 px-4 py-3 text-center backdrop-blur-sm border-b border-white/5 transition-colors duration-300 ${message.toLowerCase().includes('warning') || message.toLowerCase().includes('last card') ? 'bg-red-900/50 border-red-500/30' : ''}`}>
          <p className={`text-sm font-medium ${message.toLowerCase().includes('warning') || message.toLowerCase().includes('last card') ? 'text-red-200 animate-pulse font-bold uppercase tracking-wide' : 'text-white/80'}`}>{message}</p>
          {isMyTurn && showCountdown && secondsLeft !== null && (
            <div className={`mt-2 flex items-center justify-center gap-2 ${isCritical ? 'animate-pulse' : ''}`}>
              <div className={`text-lg font-black ${isCritical ? 'text-red-400' : 'text-yellow-400'}`}>⏱️ {secondsLeft}s</div>
              <span className="text-white/50 text-xs">until auto-play</span>
            </div>
          )}
        </div>
      )}

      {!winner && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 overflow-hidden">
          <div className="relative z-20">
            {gameState?.currentCard && <div className="transform scale-125 shadow-2xl border-4 border-white/10 rounded-xl"><WhotCard card={gameState.currentCard} /></div>}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white/50 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap mt-2">Table</div>
          </div>

          {showShapePicker && pendingCard && (
            <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
              <h3 className="text-white text-xl md:text-3xl mb-6 md:mb-10 font-black uppercase tracking-wider">Choose a Shape</h3>
              <div className="grid grid-cols-2 gap-3 md:gap-6 w-full max-w-sm md:max-w-xl">
                {(['circle', 'triangle', 'cross', 'square', 'star'] as CardShape[]).map(shape => {
                  const cls = "w-8 h-8 md:w-12 md:h-12";
                  const icon = shape === 'circle' ? <Circle className={cls} strokeWidth={3} /> : shape === 'triangle' ? <Triangle className={cls} strokeWidth={3} /> : shape === 'cross' ? <X className={cls} strokeWidth={3} /> : shape === 'square' ? <Square className={cls} strokeWidth={3} /> : <Star className={cls} strokeWidth={3} />;
                  const colors: Record<CardShape, string> = { circle: "text-red-500 border-red-500/50 hover:bg-red-500", triangle: "text-green-500 border-green-500/50 hover:bg-green-500", cross: "text-purple-500 border-purple-500/50 hover:bg-purple-500", square: "text-blue-500 border-blue-500/50 hover:bg-blue-500", star: "text-yellow-500 border-yellow-500/50 hover:bg-yellow-500" };
                  return (
                    <button key={shape} onClick={() => handlePlayCard(pendingCard, shape)} className={`bg-white/5 border-2 ${colors[shape]} hover:text-white px-4 py-4 md:px-8 md:py-8 rounded-2xl capitalize font-bold hover:scale-105 transition-all text-base md:text-xl flex flex-col items-center justify-center gap-2 md:gap-3 group backdrop-blur-sm shadow-xl`}>
                      <div className="group-hover:scale-110 transition-transform duration-200">{icon}</div>
                      <span className="text-sm tracking-wider opacity-80 group-hover:opacity-100">{shape}</span>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setShowShapePicker(false)} className="mt-12 text-white/50 text-sm font-bold uppercase tracking-widest hover:text-white">Cancel Choice</button>
            </div>
          )}

          {(() => {
            if (showShapePicker && pendingCard) return null;
            if (!gameState?.currentCard) return null;
            const num = gameState.currentCard.number;
            let bannerMessage = "";
            if (num === 20) bannerMessage = `I NEED ${gameState.selectedShape?.toUpperCase() || "A SHAPE"}!`;
            else if (num === 14 && gameState.marketDue?.includes(playerId)) bannerMessage = "GO TO MARKET!";
            else if (num === 2 && isMyTurn && gameState.effectActive === 'pick_two') bannerMessage = "PICK TWO!";
            else if (num === 5 && isMyTurn && gameState.effectActive === 'pick_three') bannerMessage = "PICK THREE!";
            else if (num === 1 && isMyTurn) bannerMessage = "HOLD ON! Play Again";
            if (!bannerMessage) return null;
            return <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-600/90 px-6 py-2 rounded-full border border-red-400/50 backdrop-blur-sm z-50 whitespace-nowrap shadow-xl animate-pulse"><p className="text-white font-black uppercase tracking-wider text-sm">{bannerMessage}</p></div>;
          })()}

          {hand.length > 0 ? (
            <div className="w-full h-full flex items-center overflow-x-auto snap-x px-8 pb-4 scrollbar-hide">
              <div className="flex gap-4 items-center mx-auto min-w-min">
                <div className="relative flex-shrink-0 flex flex-col items-center gap-2">
                  <button onClick={handleDraw} disabled={!isMyTurn || loading} className={`relative w-28 h-40 rounded-xl flex flex-col items-center justify-center transition-all group ${isMyTurn ? 'cursor-pointer hover:scale-105 active:scale-95' : 'opacity-50 cursor-not-allowed'}`}>
                    <div className="absolute top-1 left-1 w-full h-full bg-red-950 rounded-xl border border-white/10 rotate-3 shadow-lg -z-20 transition-transform group-hover:rotate-6"/>
                    <div className="absolute top-0.5 left-0.5 w-full h-full bg-red-900 rounded-xl border border-white/10 rotate-1 shadow-lg -z-10 transition-transform group-hover:rotate-3"/>
                    <WhotCard card={{ id: 'deck', shape: 'circle', number: 20 }} faceDown className="w-full h-full shadow-2xl z-10"/>
                    <div className="absolute top-2 right-2 w-6 h-6 bg-black/60 backdrop-blur rounded-full flex items-center justify-center border border-white/20 z-20 shadow-md"><span className="text-white text-[10px] font-bold">{gameState?.deckCount || 0}</span></div>
                    {loading && <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/20 rounded-xl backdrop-blur-sm"><RefreshCw className="w-8 h-8 text-white animate-spin" /></div>}
                  </button>
                  <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Market</span>
                </div>
                {hand.map((card) => (
                  <div key={card.id} className="flex-shrink-0 snap-center perspective-1000">
                    <WhotCard card={card} onClick={() => handlePlayCard(card)} disabled={!isMyTurn || loading} className={`transform transition-all duration-500 ${isMyTurn ? 'hover:scale-110 hover:-translate-y-6 hover:rotate-2 shadow-2xl cursor-pointer' : ''}`}/>
                  </div>
                ))}
              </div>
            </div>
          ) : gameState?.gameStarted ? (
            <div className="flex flex-col items-center gap-6">
              <p className="text-white/50 font-mono">No cards in hand</p>
              {isMyTurn && (
                <div className="relative flex flex-col items-center gap-2">
                  <button onClick={handleDraw} disabled={loading} className="relative w-28 h-40 rounded-xl flex flex-col items-center justify-center transition-all group cursor-pointer hover:scale-105 active:scale-95">
                    <div className="absolute top-1 left-1 w-full h-full bg-red-950 rounded-xl border border-white/10 rotate-3 shadow-lg -z-20 transition-transform group-hover:rotate-6"/>
                    <div className="absolute top-0.5 left-0.5 w-full h-full bg-red-900 rounded-xl border border-white/10 rotate-1 shadow-lg -z-10 transition-transform group-hover:rotate-3"/>
                    <WhotCard card={{ id: 'deck', shape: 'circle', number: 20 }} faceDown className="w-full h-full shadow-2xl z-10"/>
                    <div className="absolute top-2 right-2 w-6 h-6 bg-black/60 backdrop-blur rounded-full flex items-center justify-center border border-white/20 z-20 shadow-md"><span className="text-white text-[10px] font-bold">{gameState?.deckCount || 0}</span></div>
                    {loading && <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/20 rounded-xl backdrop-blur-sm"><RefreshCw className="w-8 h-8 text-white animate-spin" /></div>}
                  </button>
                  <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Draw from Market</span>
                </div>
              )}
              {!isMyTurn && <button onClick={fetchHand} className="px-6 py-2 bg-white/10 rounded-full text-white font-bold text-sm border border-white/20 hover:bg-white/20">Refresh Hand</button>}
            </div>
          ) : (
            <div className="text-center max-w-xs mx-auto">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 animate-pulse"><RefreshCw className="w-6 h-6 text-yellow-400 animate-spin"/></div>
              <p className="text-white font-bold text-xl mb-2">Waiting for Host</p>
              <p className="text-white/50 text-sm">The game will start soon...</p>
            </div>
          )}
        </div>
      )}

      {!winner && (
        <div className="relative z-20 px-4 py-3 bg-black/40 backdrop-blur-md border-t border-white/5">
          <p className="text-white/40 text-xs font-mono tracking-widest uppercase text-center">{hand.length} Cards held</p>
        </div>
      )}

      <ChatPanel isOpen={showChat && !winner} onClose={() => setShowChat(false)} messages={chatMessages} currentPlayerName={playerName} chatInput={chatInput} onChatInputChange={setChatInput} onSendMessage={handleSendChatMessage} />

      {showRulesInfo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowRulesInfo(false)}>
          <div className="bg-gray-900 p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 border border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black text-white flex items-center gap-2"><Info className="w-5 h-5 text-yellow-400" />Active Rules</h3>
              <button onClick={() => setShowRulesInfo(false)} className="text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Pick Two (Card 2)', value: gameState?.rules?.pickTwo },
                { label: 'Pick Three (Card 5)', value: gameState?.rules?.pickThree },
                { label: 'Defend/Stack', value: gameState?.rules?.defendPick },
                { label: 'Win with Hold On', value: gameState?.rules?.winWithHoldOn },
              ].map(rule => (
                <div key={rule.label} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: rule.value ? `${STATUS_COLORS.success}33` : `${STATUS_COLORS.error}33`, borderWidth: '1px', borderStyle: 'solid', borderColor: rule.value ? `${STATUS_COLORS.success}4D` : `${STATUS_COLORS.error}4D` }}>
                  <span className="text-white font-medium">{rule.label}</span>
                  <span className="text-sm font-bold" style={{ color: rule.value ? STATUS_COLORS.success : STATUS_COLORS.error }}>{rule.value ? 'ON' : 'OFF'}</span>
                </div>
              ))}
            </div>
            {gameState?.rulesLocked && <p className="mt-4 text-white/40 text-xs text-center">🔒 Rules are locked for this game</p>}
            <button onClick={() => setShowRulesInfo(false)} className="w-full mt-4 py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-xl transition-all">Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}
