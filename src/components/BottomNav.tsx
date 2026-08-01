import React from 'react';
import { MessageSquare, Settings } from 'lucide-react';

interface BottomNavProps {
  activeTab: 'chats' | 'settings';
  onTabChange: (tab: 'chats' | 'settings') => void;
  unreadCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, unreadCount = 0 }) => {
  return (
    <nav className="bg-[#181B22] border-t border-gray-800 pb-safe md:hidden fixed bottom-0 w-full z-40">
      <div className="flex items-center justify-around p-2">
        <button
          onClick={() => onTabChange('chats')}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-1 rounded-2xl transition-colors relative ${
            activeTab === 'chats' ? 'text-[#2563EB]' : 'text-[#9AA4B2] hover:bg-[#23262F]'
          }`}
        >
          <div className="relative">
            <MessageSquare size={24} className={activeTab === 'chats' ? 'fill-blue-600/20' : ''} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg shadow-red-500/50 animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-semibold">Sohbetler</span>
        </button>

        <button
          onClick={() => onTabChange('settings')}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-1 rounded-2xl transition-colors ${
            activeTab === 'settings' ? 'text-[#2563EB]' : 'text-[#9AA4B2] hover:bg-[#23262F]'
          }`}
        >
          <Settings size={24} className={activeTab === 'settings' ? 'fill-blue-600/20' : ''} />
          <span className="text-[10px] font-semibold">Ayarlar</span>
        </button>
      </div>
    </nav>
  );
};
