import { RefreshCw, AlertCircle } from 'lucide-react';

interface ConnectionTroubleshootProps {
  onRetry: () => void;
}

export function ConnectionTroubleshoot({ onRetry }: ConnectionTroubleshootProps) {
  return (
    <div className="bg-red-900/20 border-2 border-red-400 rounded-xl p-6 mt-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
        <div className="flex-1">
          <h3 className="text-lg mb-2 text-red-300">Connection Failed</h3>
          <p className="text-sm opacity-90 mb-4">
            Unable to connect to Supabase Realtime. This could be due to:
          </p>
          <ul className="text-sm space-y-1 mb-4 opacity-90 list-disc list-inside">
            <li>Supabase Realtime is not enabled for this project</li>
            <li>Network connectivity issues</li>
            <li>Browser blocking WebSocket connections</li>
            <li>Ad blockers or firewall restrictions</li>
          </ul>
          
          <div className="space-y-2">
            <button
              onClick={onRetry}
              className="w-full px-4 py-3 bg-yellow-400 text-green-900 rounded-lg hover:bg-yellow-300 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Retry Connection
            </button>
            
            <details className="text-xs opacity-75">
              <summary className="cursor-pointer hover:opacity-100">Technical Details</summary>
              <div className="mt-2 bg-black/30 rounded p-3 font-mono">
                <p>Attempting to connect to:</p>
                <p className="break-all mt-1">wss://ynqssrayffqoaqkneqhp.supabase.co/realtime/v1</p>
                <p className="mt-2">Check browser console for detailed error logs</p>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
