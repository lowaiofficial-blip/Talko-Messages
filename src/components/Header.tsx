import React, { useState } from 'react';
import { Search, Settings, ShieldAlert, LogOut } from 'lucide-react';
import { User } from '../types';
import { DefaultAvatar } from './DefaultAvatar';
import { useAuth } from '../AuthContext';

interface HeaderProps {
  currentUser: User;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenMyProfile: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  searchQuery,
  onSearchChange,
  onOpenMyProfile
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <header className="bg-[#181B22] border-b border-[#23262F] p-4 sticky top-0 z-30 flex flex-col gap-4">
      <div className="flex items-center justify-between max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-xl font-black text-white">T</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">TALKO</h1>
            <p className="text-[10px] text-[#9AA4B2] font-mono">{currentUser.talkoNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 relative">
          
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="focus:outline-none">
              <DefaultAvatar 
                color={currentUser.avatarColor}
                size="sm"
                avatarUrl={currentUser.avatarUrl}
                name={currentUser.talkoNumber}
                className="ring-2 ring-transparent hover:ring-blue-500 transition-all cursor-pointer"
              />
            </button>
            
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}></div>
                <div className="absolute right-0 top-full mt-2 w-48 bg-[#181B22] border border-[#23262F] rounded-2xl shadow-xl z-50 overflow-hidden text-sm">
                  <button 
                    onClick={() => { setShowMenu(false); onOpenMyProfile(); }}
                    className="w-full text-left px-4 py-3 hover:bg-[#23262F] text-white flex items-center gap-2"
                  >
                    <Settings size={16} /> Profilim
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-3 hover:bg-red-500/10 text-red-500 flex items-center gap-2 border-t border-[#23262F]"
                  >
                    <LogOut size={16} /> Çıkış Yap
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto w-full relative">
        <Search size={16} className="absolute left-3.5 top-3.5 text-[#9AA4B2]" />
        <input 
          type="text"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Kişilerde veya sohbetlerde ara..."
          className="w-full bg-[#0F1115] text-white py-3 pl-10 pr-4 rounded-2xl border border-[#23262F] focus:outline-none focus:border-[#2563EB] text-sm transition-colors"
        />
      </div>
    </header>
  );
};
