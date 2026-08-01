import React from 'react';
import { useAuth } from './AuthContext';
import { Login } from './components/Login';
import { MainApp } from './components/MainApp';
import { AlertCircle } from 'lucide-react';

export default function App() {
  const { currentUser, talkoUser, loading, logout } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1115] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentUser || !talkoUser) {
    return <Login />;
  }

  if (talkoUser.isBanned) {
    return (
      <div className="min-h-screen bg-[#0F1115] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center mb-4">
          <AlertCircle size={36} />
        </div>
        <h1 className="text-xl font-bold text-red-500">Hesabınız Engellendi</h1>
        <p className="text-sm text-[#9AA4B2] max-w-sm mt-2">
          {talkoUser.banReason || 'Yöneticiler tarafından kural ihlali nedeniyle hesabınıza erişim engellenmiştir.'}
        </p>
        <div className="mt-6 font-mono text-xs text-[#9AA4B2] bg-[#181B22] px-4 py-2 rounded-xl">
          Numara: {talkoUser.talkoNumber}
        </div>
        <button
          onClick={() => logout()}
          className="mt-6 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs rounded-xl transition-colors"
        >
          Çıkış Yap
        </button>
      </div>
    );
  }

  return <MainApp />;
}

