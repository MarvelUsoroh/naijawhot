import { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Home } from './components/home';
import { HostView } from './components/multiplayer/host-view';
import { ControllerView } from './components/multiplayer/controller-view';

type View = 'home' | 'host' | 'controller' | 'spectator';

export default function App() {
  const [view, setView] = useState<View>('home');
  const [roomCode, setRoomCode] = useState<string>('');

  useEffect(() => {
    // Check for URL parameters only (no localStorage auto-reconnect)
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('room');
    const spectateCode = params.get('spectate');
    
    if (spectateCode) {
      setRoomCode(spectateCode);
      setView('spectator');
    } else if (joinCode) {
      setRoomCode(joinCode);
      setView('controller');
    }
  }, []);

  const handleHostGame = () => {
    // Host generates their own code
    localStorage.removeItem('whot-room-code'); // Clear any old session
    setView('host');
  };

  const handleJoinGame = (code: string) => {
    setRoomCode(code);
    setView('controller');
    window.history.replaceState({}, '', `?room=${code}`);
  };

  const handleWatchGame = (code: string) => {
    setRoomCode(code);
    setView('spectator');
    window.history.replaceState({}, '', `?spectate=${code}`);
  };

  const handleBack = () => {
    setView('home');
    setRoomCode('');
    window.history.replaceState({}, '', window.location.pathname);
  };

  return (
    <div 
      className="min-h-screen relative font-sans overflow-hidden text-[var(--whot-text-primary)]" 
      style={{ 
        background: 'var(--whot-table-gradient)',
      }}
    >
      {/* Global Wood Texture */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40 mix-blend-overlay z-0"
        style={{ backgroundImage: 'var(--whot-wood-texture)' }} 
      />
      
      {/* Content */}
      <div className="relative z-10 min-h-screen">
        {view === 'home' && (
          <Home onHostGame={handleHostGame} onJoinGame={handleJoinGame} onWatchGame={handleWatchGame} />
        )}
        {view === 'host' && (
          <HostView onExit={handleBack} />
        )}
        {view === 'controller' && (
          <ControllerView roomCode={roomCode} onBack={handleBack} />
        )}
        {view === 'spectator' && (
          <HostView onExit={handleBack} initialRoomCode={roomCode} isSpectator={true} />
        )}
      </div>
      <Analytics />
    </div>
  );
}