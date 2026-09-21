import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface ToastProps {
  message: string | null;
}

export const Toast: React.FC<ToastProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#161b29] border border-[#00f59b]/50 text-[#00f59b] px-4 py-2.5 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.8)] font-['JetBrains_Mono'] text-xs flex items-center gap-2 max-w-[90vw] animate-in fade-in slide-in-from-bottom-3 duration-200">
      <CheckCircle2 className="w-4 h-4 shrink-0 text-[#00f59b]" />
      <span className="truncate">{message}</span>
    </div>
  );
};
