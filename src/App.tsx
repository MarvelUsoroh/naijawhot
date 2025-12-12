import { useState, useEffect } from 'react';
import { Home } from './components/home';
import { HostView } from './components/multiplayer/host-view';
import { ControllerView } from './components/multiplayer/controller-view';

type View = 'home' | 'host' | 'controller';

export default function App() {
  const [view, setView] = useState<View>('home');
  const [roomCode, setRoomCode] = useState<string>('');

  useEffect(() => {
    // Check for QR code join parameter
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('room'); // Changed 'join' to 'room' to match logic in HostView QR
    if (joinCode) {
      setRoomCode(joinCode);
      setView('controller');
      // Clean up URL ? Maybe keep it for refresh?
      // window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleHostGame = () => {
    // Host generates their own code
    setView('host');
  };

  const handleJoinGame = (code: string) => {
    setRoomCode(code);
    setView('controller');
  };

  const handleBack = () => {
    setView('home');
    setRoomCode('');
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
          <Home onHostGame={handleHostGame} onJoinGame={handleJoinGame} />
        )}
        {view === 'host' && (
          <HostView onExit={handleBack} />
        )}
        {view === 'controller' && (
          <ControllerView roomCode={roomCode} onBack={handleBack} />
        )}
      </div>
    </div>
  );
}