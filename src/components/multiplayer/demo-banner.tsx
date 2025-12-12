import { Info, X } from 'lucide-react';
import { useState } from 'react';

export function DemoBanner() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-2xl mx-auto">
      <div className="bg-yellow-400 text-green-900 rounded-xl p-4 shadow-2xl border-2 border-yellow-500">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-bold mb-1">POC Demo Mode</h3>
            <p className="text-sm">
              To test: Open this page in 2+ browser windows. One as Host (TV), others as Controllers (phones).
            </p>
          </div>
          <button
            onClick={() => setVisible(false)}
            className="hover:bg-yellow-500 rounded p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
