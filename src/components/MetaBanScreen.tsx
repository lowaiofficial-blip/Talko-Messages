import React from 'react';
import { ShieldAlert, Lock, AlertTriangle } from 'lucide-react';

interface MetaBanScreenProps {
  reason?: string;
  fingerprint?: string;
}

export const MetaBanScreen: React.FC<MetaBanScreenProps> = ({ reason, fingerprint }) => {
  return (
    <div className="fixed inset-0 z-[999] bg-[#07090E] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0F172A] border border-red-500/30 rounded-3xl p-8 shadow-2xl text-center flex flex-col items-center relative overflow-hidden">
        {/* Top Glow Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-rose-500 to-red-600"></div>

        {/* Meta Security Header */}
        <div className="inline-flex items-center gap-2 px-3 me-2 py-1 bg-red-950/40 border border-red-500/30 rounded-full text-xs font-semibold text-red-400 mb-6">
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M16.98 6.42c-1.3 0-2.43.76-3.08 1.87-.65-1.11-1.78-1.87-3.08-1.87-2.12 0-3.82 1.7-3.82 3.82 0 3.2 5.08 7.34 6.9 8.74.12.09.28.14.43.14s.31-.05.43-.14c1.82-1.4 6.9-5.54 6.9-8.74 0-2.12-1.7-3.82-3.82-3.82z"/>
          </svg>
          <span>META SECURITY & INTEGRITY ENFORCEMENT</span>
        </div>

        {/* Icon */}
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-5 relative">
          <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping"></div>
          <ShieldAlert size={44} className="text-red-500 relative z-10" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Hesabınız Kalıcı Olarak Engellendi</h1>
        
        <p className="text-red-200/90 text-sm mb-6 leading-relaxed">
          {reason || 'Talko AI Moderasyon yapay zekası tarafından tespit edilen ağır kural ihlali (+18 / Taciz / Troll) nedeniyle erişiminiz kalıcı olarak sonlandırılmıştır.'}
        </p>

        <div className="w-full bg-[#1E293B]/60 rounded-2xl p-4 border border-[#334155] text-left space-y-3 mb-6">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Karar Protokolü:</span>
            <span className="font-mono text-red-400 font-bold">[KALICI_BAN]</span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Cihaz & Tarayıcı Kimliği:</span>
            <span className="font-mono text-gray-300 truncate max-w-[180px]">{fingerprint || 'FP_BLOCKED_DEVICE'}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-amber-400 pt-1 border-t border-[#334155]">
            <AlertTriangle size={14} className="shrink-0" />
            <span>Aynı tarayıcı/cihazdan yeni hesap açılması veya giriş yapılması tamamen engellenmiştir.</span>
          </div>
        </div>

        <div className="text-xs text-gray-500 leading-relaxed">
          Meta Güvenlik İhlal Kodu: <span className="font-mono text-gray-400">ERR_META_AI_PERMANENT_BAN_070</span>
        </div>
      </div>
    </div>
  );
};
