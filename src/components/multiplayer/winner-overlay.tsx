import { Trophy, Check, Loader2 } from 'lucide-react';
import { Player } from '../../types/game';

interface WinnerOverlayProps {
  winnerName?: string;
  isMe: boolean; // True if this client won
  players: Player[]; // For showing readiness status
  onPlayAgain?: () => void; // Unset for Host
  isHost: boolean;
  onHostRestart?: () => void;
  myPlayerId?: string;
}

export function WinnerOverlay({ winnerName, isMe, players, onPlayAgain, isHost, onHostRestart, myPlayerId }: WinnerOverlayProps) {
  
  // Readiness check
  const allReady = players.length > 0 && players.every(p => p.isReady);
  const myPlayer = players.find(p => p.id === myPlayerId);
  const amIReady = myPlayer?.isReady;

  return (
    <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center p-4 overflow-y-auto font-sans bg-black/20 backdrop-blur-sm">
      <div className="bg-black/30 backdrop-blur-md p-6 md:p-10 rounded-3xl border border-white/10 shadow-2xl text-center max-w-2xl w-full my-auto animate-in zoom-in duration-300">
        
        <div className="mb-6 md:mb-8">
            {isHost ? (
                <Trophy className="w-16 h-16 md:w-24 md:h-24 text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.5)] mx-auto mb-4 animate-bounce" />
            ) : isMe ? (
                <Trophy className="w-16 h-16 md:w-20 md:h-20 text-yellow-400 mx-auto animate-bounce drop-shadow-lg" />
            ) : (
                <div className="text-5xl md:text-7xl animate-pulse mx-auto">🏁</div>
            )}
            
            <h2 className="text-3xl md:text-5xl font-black text-white mb-2 uppercase tracking-widest drop-shadow-xl">
                CHECK UP!
            </h2>
            <p className={`text-lg md:text-2xl font-bold ${isMe ? 'text-yellow-400' : 'text-white/60'}`}>
                {isMe ? 'You won the game!' : `${winnerName} won!`}
            </p>
        </div>

        {/* Players Readiness List */}
        <div className="mb-8 p-4 bg-black/20 rounded-2xl border border-white/5">
            <h3 className="text-white/40 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] mb-4">Waiting Room</h3>
            <div className="grid grid-cols-2 gap-3">
                {players.map(p => (
                    <div key={p.id} className={`
                        flex items-center justify-between px-3 py-2 md:px-4 md:py-3 rounded-xl border transition-all
                        ${p.id === winnerName 
                            ? 'bg-yellow-400/10 border-yellow-400/30' 
                            : 'bg-white/5 border-white/5'}
                    `}>
                        <span className={`text-sm md:text-base font-bold truncate ${p.id === winnerName ? 'text-yellow-400' : 'text-white'}`}>
                            {p.name}
                        </span>
                        {p.isReady ? (
                            <span className="flex items-center gap-1 text-green-400 text-[10px] md:text-xs font-black uppercase bg-green-900/20 px-2 py-1 rounded">
                                <Check className="w-3 h-3" /> Ready
                            </span>
                        ) : (
                            <span className="text-white/20 text-[10px] md:text-xs font-medium">Waiting...</span>
                        )}
                    </div>
                ))}
            </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 justify-center">
            {isHost ? (
                <button 
                  onClick={onHostRestart}
                  disabled={!allReady}
                  className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-black text-xl font-black rounded-xl shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
                >
                    {!allReady && <Loader2 className="w-5 h-5 animate-spin" />}
                    {allReady ? 'START MATCH' : 'WAITING...'}
                </button>
            ) : (
                <button 
                    onClick={onPlayAgain}
                    disabled={amIReady}
                    className={`w-full py-4 border-2 font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 text-lg
                        ${amIReady 
                            ? 'bg-green-500/10 border-green-500/50 text-green-400' 
                            : 'bg-white/10 hover:bg-white/20 border-white/10 text-white hover:scale-[1.02]'
                        }`}
                >
                    {amIReady ? (
                        <>
                          <Check className="w-5 h-5" /> Ready!
                        </>
                    ) : (
                        'PLAY AGAIN'
                    )}
                </button>
            )}
        </div>
      </div>
    </div>
  );
}
