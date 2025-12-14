import { useState, useEffect } from 'react';
import { Home } from './components/home';
import { HostView } from './components/multiplayer/host-view';
import { ControllerView } from './components/multiplayer/controller-view';

type View = 'home' | 'host' | 'controller';

export default function App() {
  const [view, setView] = useState<View>('home');
  const [roomCode, setRoomCode] = useState<string>('');

  useEffect(() => {
    // Check for QR code join parameter OR localStorage
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('room');
    const savedRoom = localStorage.getItem('whot-room-code');
    
    if (joinCode) {
      setRoomCode(joinCode);
      setView('controller');
      localStorage.setItem('whot-room-code', joinCode);
    } else if (savedRoom) {
      // Restore from localStorage (for refresh/reconnect)
      setRoomCode(savedRoom);
      setView('controller');
      // Update URL to match
      window.history.replaceState({}, '', `?room=${savedRoom}`);
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
    // Persist for reconnection
    localStorage.setItem('whot-room-code', code);
    window.history.replaceState({}, '', `?room=${code}`);
  };

  const handleBack = () => {
    setView('home');
    setRoomCode('');
    // Clear persisted session
    localStorage.removeItem('whot-room-code');
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