// src/ui/primitives/OreToast.tsx
import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

import { useToastStore, type ToastItem, type ToastTone } from '../../store/useToastStore';
import '../../style/tokens/designToken';

/* ─── tone → visual map ─── */
const toneConfig: Record<ToastTone, { icon: React.ReactNode; accent: string; bg: string }> = {
  success: {
    icon: <CheckCircle2 size="1.75rem" />,
    accent: 'text-[#6CC349]',
    bg: 'bg-[#23301F]/95',
  },
  error: {
    icon: <XCircle size="1.75rem" />,
    accent: 'text-[#F46D6D]',
    bg: 'bg-[#3A1414]/95',
  },
  warning: {
    icon: <AlertTriangle size="1.75rem" />,
    accent: 'text-[#FFE866]',
    bg: 'bg-[#3A300F]/95',
  },
  info: {
    icon: <Info size="1.75rem" />,
    accent: 'text-[#2E6BE5]',
    bg: 'bg-[#1F2E4A]/95',
  },
};

/* ─── Single Toast Item ─── */
const ToastEntry: React.FC<{ item: ToastItem }> = ({ item }) => {
  const removeToast = useToastStore((s) => s.removeToast);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const cfg = toneConfig[item.tone];

  useEffect(() => {
    // mount → slide in
    requestAnimationFrame(() => setVisible(true));

    timerRef.current = window.setTimeout(() => {
      setExiting(true);
    }, item.durationMs);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [item.durationMs]);

  useEffect(() => {
    if (!exiting) return;
    const t = window.setTimeout(() => removeToast(item.id), 340);
    return () => window.clearTimeout(t);
  }, [exiting, item.id, removeToast]);

  const dismiss = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    setExiting(true);
  };

  return (
    <div
      role={item.tone === 'error' ? 'alert' : 'status'}
      className={`
        pointer-events-auto flex items-start gap-[1rem] rounded-[2px] border-[3px] border-[#1E1E1F] px-[1.25rem] py-[1rem]
        font-minecraft text-[1.625rem] leading-[2.125rem] text-white shadow-[inset_2px_2px_rgba(255,255,255,0.15),inset_-2px_-2px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.5)]
        transition-all duration-300 ease-out
        ${cfg.bg}
        ${visible && !exiting ? 'translate-y-0 opacity-100' : 'translate-y-[1.5rem] opacity-0'}
      `}
      style={{ minWidth: '28rem', maxWidth: '44rem' }}
    >
      <span className={`mt-[0.1875rem] flex-shrink-0 ${cfg.accent}`}>{cfg.icon}</span>
      <span className="flex-1 leading-snug break-words">
        {item.message.split('\n').map((line, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <br />}
            {line}
          </React.Fragment>
        ))}
      </span>
      <button
        onClick={dismiss}
        aria-label="关闭通知"
        className="mt-[0.1875rem] flex-shrink-0 cursor-pointer text-white/50 transition-colors hover:text-white focus:outline-none focus-visible:ring-[0.125rem] focus-visible:ring-white focus-visible:ring-offset-[0.125rem] focus-visible:ring-offset-black rounded-[0.125rem]"
      >
        <X size="1.5rem" />
      </button>
    </div>
  );
};

/* ─── Toast Container (mount once near root) ─── */
export const OreToastContainer: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div 
      role="log" 
      aria-live="polite" 
      aria-label="通知区域" 
      className="pointer-events-none fixed inset-x-0 bottom-[1rem] z-[9999] flex flex-col items-center gap-[0.5rem]"
    >
      {toasts.map((t) => (
        <ToastEntry key={t.id} item={t} />
      ))}
    </div>
  );
};
