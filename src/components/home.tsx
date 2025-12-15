import { useState } from 'react';
import { Tv, Smartphone, Sparkles, Crown, ArrowLeft, Eye } from 'lucide-react';
import { generateRoomCode } from '../utils/game-helpers';

interface HomeProps {
  onHostGame: (roomCode: string) => void;
  onJoinGame: (roomCode: string) => void;
  onWatchGame: (roomCode: string) => void;
}

export function Home({ onHostGame, onJoinGame, onWatchGame }: HomeProps) {
  const [joinCode, setJoinCode] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);

  const handleHostClick = () => {
    const code = generateRoomCode();
    onHostGame(code);
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.length === 4) {
      onJoinGame(joinCode);
    }
  };

  return (
    <div className="min-h-[100dvh] overflow-y-auto flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
      
      {/* Hero Section */}
      <div className="mb-12 max-w-3xl">
        <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg rotate-3 transform hover:rotate-6 transition-transform">
                <Crown className="w-10 h-10 text-black drop-shadow-md" />
            </div>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-black mb-6 drop-shadow-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-100 to-yellow-500">
          NAIJA WHOT
        </h1>
        
        <p className="text-xl md:text-3xl font-medium text-white/90 leading-relaxed drop-shadow-md">
          Play with family & friends from home and around the globe.
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid md:grid-cols-2 gap-8 max-w-4xl w-full">
        
        {/* Host Card */}
        <div className="group relative bg-black/30 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:bg-black/40 transition-all hover:scale-[1.02] shadow-2xl">
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="w-16 h-16 rounded-full bg-white/5 mx-auto mb-6 flex items-center justify-center group-hover:bg-yellow-400/20 transition-colors">
            <Tv className="w-8 h-8 text-yellow-400" />
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">Host Match</h2>
          <p className="text-white/60 mb-8 h-12">Turn your screen into the game table.</p>
          
          <button
            onClick={handleHostClick}
            className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-lg rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-yellow-400/20"
          >
            <Sparkles className="w-5 h-5 fill-black" />
            Create Room
          </button>
        </div>

        {/* Join Card */}
        <div className="group relative bg-black/30 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:bg-black/40 transition-all hover:scale-[1.02] shadow-2xl">
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-green-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          <div className="w-16 h-16 rounded-full bg-white/5 mx-auto mb-6 flex items-center justify-center group-hover:bg-green-400/20 transition-colors">
            <Smartphone className="w-8 h-8 text-green-400" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Join Game</h2>
          <p className="text-white/60 mb-8 h-12">Use your phone as a controller.</p>

          {!showJoinInput ? (
            <button
              onClick={() => setShowJoinInput(true)}
              className="w-full py-4 bg-green-500 hover:bg-green-400 text-white font-bold text-lg rounded-xl transition-all shadow-lg hover:shadow-green-500/20"
            >
              Enter Code
            </button>
          ) : (
            <div className="flex items-center gap-2 w-full">
               <button
                  type="button"
                  onClick={() => setShowJoinInput(false)}
                  className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
               >
                  <ArrowLeft className="w-6 h-6" />
               </button>
               <form onSubmit={handleJoinSubmit} className="flex-1 flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="1234"
                  maxLength={4}
                  autoFocus
                  className="w-full sm:flex-1 bg-black/40 border-2 border-green-500/50 rounded-xl px-4 py-3 text-center text-xl font-mono font-bold text-white focus:outline-none focus:border-green-500 placeholder-white/20 uppercase tracking-widest"
                />
                <button
                  type="submit"
                  disabled={joinCode.length !== 4}
                  className="w-full sm:w-auto px-6 py-3 bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-400 text-white font-bold text-lg rounded-xl transition-all shadow-lg hover:shadow-green-500/20 whitespace-nowrap"
                >
                  Join
                </button>
              </form>
              
              {/* Watch Game Button - Icon Only */}
              <button
                type="button"
                onClick={() => onWatchGame(joinCode)}
                disabled={joinCode.length !== 4}
                title="Watch Game"
                className="p-3 bg-purple-500/80 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-400 text-white rounded-xl transition-all shadow-lg hover:shadow-purple-500/20"
              >
                <Eye className="w-6 h-6" />
              </button>
            </div>

          )}
        </div>
      </div>

       <div className="mt-16 text-white/30 text-sm font-medium tracking-widest uppercase">
          Digital Tabletop Experience
       </div>
    </div>
  );
}