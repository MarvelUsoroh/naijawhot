import { useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

export interface ChatMessage {
  playerName: string;
  message: string;
  timestamp: number;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  currentPlayerName: string;
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onSendMessage: () => void;
  /** Whether to show the input box in the panel (default: true) */
  showInput?: boolean;
}

/**
 * Shared slide-out chat panel component
 * Used by both host-view and controller-view
 */
export function ChatPanel({
  isOpen,
  onClose,
  messages,
  currentPlayerName,
  chatInput,
  onChatInputChange,
  onSendMessage,
  showInput = true,
}: ChatPanelProps) {
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatScrollRef.current && isOpen) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && chatInput.trim()) {
      onSendMessage();
    }
  };

  return (
    <>
      {/* Backdrop overlay - click to close */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40"
          onClick={onClose}
        />
      )}
      
      <div 
        className={`fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-black/40 backdrop-blur-md border-l border-white/10 flex flex-col z-50 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-yellow-400" />
          <span className="text-white font-bold text-sm uppercase tracking-widest">Live Chat</span>
        </div>
        <button 
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* Messages */}
      <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.length === 0 && (
          <div className="text-white/30 text-sm text-center py-8">No messages yet...</div>
        )}
        {messages.map((msg, index) => {
          const prevMsg = messages[index - 1];
          const isFirstInGroup = !prevMsg || prevMsg.playerName !== msg.playerName || 
            (msg.timestamp - prevMsg.timestamp > 60000);
          const isOwnMessage = msg.playerName === currentPlayerName;
          
          return (
            <div 
              key={`${msg.timestamp}-${index}`} 
              className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 fade-in duration-300`}
            >
              <div className={`max-w-[85%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                {isFirstInGroup && (
                  <div className={`flex items-center gap-2 text-xs px-2 mb-1 ${isOwnMessage ? 'justify-end' : ''}`}>
                    <span className="font-medium text-yellow-400">{msg.playerName}</span>
                    <span className="text-white/40">
                      {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
                <div className={`py-2 px-3 rounded-xl text-sm ${
                  isOwnMessage 
                    ? 'bg-yellow-500/20 text-yellow-100 border border-yellow-500/30' 
                    : 'bg-white/10 text-white/90 border border-white/10'
                }`}>
                  {msg.message}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Input (optional) */}
      {showInput && (
        <div className="px-3 py-4 border-t border-white/10 bg-black/40">
          <div className="flex items-center gap-2">
            <input 
              type="text" 
              value={chatInput} 
              onChange={(e) => onChatInputChange(e.target.value)} 
              placeholder="Type a message..."
              className="flex-1 min-w-0 px-4 py-3 bg-black/30 border border-white/10 rounded-full text-white text-base placeholder:text-white/30 focus:outline-none focus:border-yellow-500/50"
              onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
              onKeyDown={handleKeyDown}
            />
            <button 
              onClick={onSendMessage}
              disabled={!chatInput.trim()}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                chatInput.trim() 
                  ? 'bg-yellow-500 text-black hover:bg-yellow-400' 
                  : 'bg-white/10 text-white/30'
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-white/30 text-[10px] text-center mt-2">Messages disappear when session ends</p>
        </div>
      )}
      
      {/* Privacy note when no input */}
      {!showInput && (
        <div className="px-4 py-2 border-t border-white/5 bg-black/20">
          <p className="text-white/30 text-[10px] text-center">
            Messages will disappear when the session ends
          </p>
        </div>
      )}
    </div>
    </>
  );
}
