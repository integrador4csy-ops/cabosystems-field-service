// cabosystems-web/src/components/chat/ChatNotificationToast.tsx
// Componente de notificación flotante in-app estilo TailAdmin cuando estás en otra pestaña
import React from 'react';
import { MessageSquare, X, ArrowRight } from 'lucide-react';

export interface ChatToastItem {
  id: string;
  groupId: string;
  groupName: string;
  senderName: string;
  preview: string;
  createdAt: Date;
}

interface ChatNotificationToastProps {
  toasts: ChatToastItem[];
  onDismiss: (id: string) => void;
  onOpenChat: (groupId: string) => void;
}

export const ChatNotificationToastContainer: React.FC<ChatNotificationToastProps> = ({
  toasts,
  onDismiss,
  onOpenChat,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 left-4 md:left-[92px] z-99999 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none select-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3.5 p-3.5 bg-white/98 backdrop-blur-md rounded-2xl border border-orange-200 shadow-xl shadow-slate-900/10 transition-all duration-300 animate-in slide-in-from-top-3 fade-in hover:shadow-2xl"
        >
          {/* Icon Badge */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-[#f78c26] border border-orange-200/80 shadow-2xs mt-0.5">
            <MessageSquare size={19} className="stroke-[2.2]" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-xs font-bold text-slate-900 truncate">
                {toast.groupName}
              </span>
              <span className="text-[10px] text-slate-400 shrink-0">ahora</span>
            </div>

            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
              <span className="font-semibold text-slate-800">{toast.senderName}:</span>{' '}
              {toast.preview}
            </p>

            {/* Quick Action Button */}
            <div className="mt-2.5 flex items-center gap-2">
              <button
                onClick={() => onOpenChat(toast.groupId)}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#f78c26] hover:bg-orange-600 active:scale-95 text-white text-[11px] font-bold rounded-lg transition-all shadow-xs cursor-pointer"
              >
                <span>Ver Chat</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Cerrar notificación"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
};
