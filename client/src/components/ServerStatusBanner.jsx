import { useState, useEffect } from 'react';
import { serverStatus } from '../api/serverStatus.js';
import { CloudRain, CheckCircle, RefreshCw, AlertCircle, Wifi } from 'lucide-react';

export default function ServerStatusBanner() {
  const [status, setStatus] = useState(serverStatus.getState());

  useEffect(() => {
    const unsubscribe = serverStatus.subscribe((newState) => {
      setStatus({ ...newState });
    });
    return unsubscribe;
  }, []);

  if (!status.isColdStarting && !status.justConnected && !status.message?.includes('longer than usual')) {
    return null;
  }

  return (
    <aside 
      aria-label="Server Connection Status"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] transition-all duration-300 ease-out animate-in fade-in slide-in-from-top-4"
    >
      {status.isColdStarting && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900/95 border border-amber-500/30 text-amber-300 shadow-2xl backdrop-blur-md">
          <div className="relative flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-amber-400 opacity-60" />
            <RefreshCw size={18} className="animate-spin text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold tracking-wide text-white">
              Connecting to Studify cloud service...
            </p>
            <p className="text-[11px] text-amber-400/90 truncate mt-0.5">
              {status.message || 'Est. 15-30s on cold start'}
            </p>
          </div>
          {status.attempt > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {status.attempt}/3
            </span>
          )}
        </div>
      )}

      {status.justConnected && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-emerald-500/40 text-emerald-300 shadow-2xl backdrop-blur-md">
          <CheckCircle size={16} className="text-emerald-400 shrink-0" />
          <p className="text-xs font-medium text-emerald-200">
            Connected to Studify Cloud! Service ready.
          </p>
        </div>
      )}

      {status.message?.includes('longer than usual') && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-slate-900/95 border border-red-500/30 text-red-300 shadow-2xl backdrop-blur-md">
          <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <p className="font-semibold text-white">Cloud Connection Delay</p>
            <p className="text-slate-300 text-[11px] mt-0.5">
              {status.message}
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}

