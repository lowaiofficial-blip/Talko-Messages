import React, { useState, useEffect } from 'react';
import { ShieldAlert, Users, Building2, MessageSquare, Megaphone, Trash2, Search, CheckCircle2, XCircle, Eye, ArrowLeft, Lock, Key } from 'lucide-react';
import { User, AlphanumericApp, SystemStats, isUserOnline } from '../types';
import { db, auth } from '../lib/firebase';
import { collection, query, getDocs, updateDoc, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '../AuthContext';
import { DefaultAvatar } from './DefaultAvatar';

interface AdminPanelProps {
  onBackToApp: () => void;
  onOpenProfile: (user: User) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBackToApp, onOpenProfile }) => {
  const { talkoUser } = useAuth();
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return !!(talkoUser?.isAdmin || talkoUser?.email === 'lowai.official@gmail.com');
  });

  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [activeTab, setActiveTab] = useState<'users' | 'alphanumerics' | 'broadcast'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [alphanumerics, setAlphanumerics] = useState<AlphanumericApp[]>([]);
  const [stats, setStats] = useState<SystemStats>({ totalUsers: 0, activeUsers: 0, totalMessages: 0, bannedUsers: 0, pendingAlphanumerics: 0 });
  
  const [userQuery, setUserQuery] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  
  // Ban Modal
  const [banTarget, setBanTarget] = useState<User | null>(null);
  const [banReason, setBanReason] = useState('');

  useEffect(() => {
    if (talkoUser?.isAdmin || talkoUser?.email === 'lowai.official@gmail.com') {
      setIsAdminAuthenticated(true);
    }
  }, [talkoUser]);

  const loadData = async () => {
    if (!isAdminAuthenticated) return;
    try {
      const uSnap = await getDocs(collection(db, 'users'));
      const allUsers = uSnap.docs.map(d => ({ ...d.data() } as User));
      setUsers(allUsers);
      
      const aSnap = await getDocs(collection(db, 'alphanumeric_apps'));
      const allApps = aSnap.docs.map(d => ({ id: d.id, ...d.data() } as AlphanumericApp));
      setAlphanumerics(allApps);
      
      setStats({
        totalUsers: allUsers.length,
        activeUsers: allUsers.filter(u => isUserOnline(u)).length,
        totalMessages: 0,
        bannedUsers: allUsers.filter(u => u.isBanned).length,
        pendingAlphanumerics: allApps.filter(a => a.status === 'pending').length
      });
    } catch (e) {
      console.error('Admin loadData error:', e);
    }
  };

  useEffect(() => { 
    if (isAdminAuthenticated) {
      loadData(); 
    }
  }, [activeTab, isAdminAuthenticated]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsAuthenticating(true);

    const emailInput = adminEmail.trim().toLowerCase();
    const passInput = adminPassword.trim();

    try {
      // 1. Check Master Passcodes / Default Admin Credentials
      if (
        (emailInput === 'admin@talko.com' && (passInput === 'admin' || passInput === 'admin123' || passInput === 'talko123' || passInput === '123456')) ||
        passInput === 'admin123' || 
        passInput === 'talko123' || 
        emailInput === 'lowai.official@gmail.com'
      ) {
        setIsAdminAuthenticated(true);
        return;
      }

      // 2. Try Firebase Auth or Firestore lookup
      let userObj = talkoUser;
      if (emailInput && passInput) {
        try {
          const userCred = await signInWithEmailAndPassword(auth, emailInput, passInput);
          const uSnap = await getDocs(query(collection(db, 'users')));
          const found = uSnap.docs.find(d => d.id === userCred.user.uid || d.data().email?.toLowerCase() === emailInput);
          if (found) {
            userObj = { id: found.id, ...found.data() } as User;
          }
        } catch (authErr) {
          // Fallback to Firestore direct lookup
          const uSnap = await getDocs(query(collection(db, 'users')));
          const found = uSnap.docs.find(d => d.data().email?.toLowerCase() === emailInput);
          if (found) {
            userObj = { id: found.id, ...found.data() } as User;
          }
        }
      }

      const isOwner = userObj?.email?.toLowerCase() === 'lowai.official@gmail.com' || emailInput === 'lowai.official@gmail.com';
      const isAdminFlag = userObj?.isAdmin === true;

      if (isOwner || isAdminFlag) {
        setIsAdminAuthenticated(true);
      } else {
        setLoginError('Yetkisiz Erişim! Sadece yönetici (Admin) hesapları giriş yapabilir.');
      }
    } catch (err: any) {
      console.error('Admin Login error:', err);
      setLoginError('Admin Giriş Başarısız: E-posta veya şifre hatalı.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Render Admin Login Screen if not authenticated as admin
  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0F1115] text-white flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-[#181B22] border border-[#23262F] rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 flex items-center justify-center mb-4">
              <ShieldAlert size={36} />
            </div>
            <h1 className="text-xl font-black tracking-tight text-white">TALKO ADMIN PANELİ</h1>
            <p className="text-xs text-[#9AA4B2] mt-1">Yalnızca yetkili yönetici hesapları erişebilir.</p>
          </div>

          {loginError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs text-center font-medium">
              {loginError}
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-[#9AA4B2] uppercase tracking-wider mb-2">Admin E-Posta</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-3.5 text-gray-500" />
                <input 
                  type="email"
                  required
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  placeholder="admin@talko.com"
                  className="w-full bg-[#0F1115] text-white text-xs py-3 pl-10 pr-4 rounded-2xl border border-[#23262F] focus:outline-none focus:border-yellow-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#9AA4B2] uppercase tracking-wider mb-2">Admin Parola</label>
              <div className="relative">
                <Key size={16} className="absolute left-3.5 top-3.5 text-gray-500" />
                <input 
                  type="password"
                  required
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#0F1115] text-white text-xs py-3 pl-10 pr-4 rounded-2xl border border-[#23262F] focus:outline-none focus:border-yellow-500"
                />
              </div>
            </div>

            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl text-[11px] text-yellow-300">
              <span className="font-bold">Hızlı Admin Giriş Bilgileri:</span>
              <div className="mt-1 font-mono text-[10px] text-yellow-200">
                E-posta: <code className="bg-black/40 px-1 py-0.5 rounded text-white">admin@talko.com</code>
                <br />
                Şifre: <code className="bg-black/40 px-1 py-0.5 rounded text-white">admin123</code>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAdminEmail('admin@talko.com');
                  setAdminPassword('admin123');
                  setIsAdminAuthenticated(true);
                }}
                className="mt-2 w-full py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 font-bold text-[10px] rounded-xl transition-colors border border-yellow-500/30"
              >
                Bilgileri Doldur ve Doğrudan Giriş Yap
              </button>
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-3.5 bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold text-xs rounded-2xl transition-all shadow-lg shadow-yellow-500/20 disabled:opacity-50"
            >
              {isAuthenticating ? 'Doğrulanıyor...' : 'Yönetici Girişi Yap'}
            </button>
          </form>

          <button 
            onClick={onBackToApp}
            className="w-full py-3 bg-[#0F1115] hover:bg-[#23262F] text-[#9AA4B2] hover:text-white text-xs font-bold rounded-2xl border border-[#23262F] transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} />
            Ana Uygulamaya Dön
          </button>
        </div>
      </div>
    );
  }

  const handleToggleBusiness = async (u: User) => {
    const newStatus = !u.isBusinessAccount;
    const title = newStatus ? (prompt('Kurumsal Gönderici Unvanı / Adı:', u.username) || u.username) : '';
    await updateDoc(doc(db, 'users', u.id), { 
      isBusinessAccount: newStatus,
      isAlphanumericSender: newStatus,
      businessTitle: title,
      alphanumericName: title
    });
    loadData();
  };

  const handleBanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banTarget) return;
    await updateDoc(doc(db, 'users', banTarget.id), { isBanned: true, banReason });
    setBanTarget(null);
    setBanReason('');
    loadData();
  };

  const handleUnban = async (id: string) => {
    await updateDoc(doc(db, 'users', id), { isBanned: false, banReason: '' });
    loadData();
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Hesabı silmek istediğinize emin misiniz?')) return;
    await deleteDoc(doc(db, 'users', id));
    loadData();
  };

  const handleApproveAlpha = async (app: AlphanumericApp) => {
    await updateDoc(doc(db, 'alphanumeric_apps', app.id), { status: 'approved' });
    await updateDoc(doc(db, 'users', app.userId), { 
      isAlphanumericSender: true,
      alphanumericName: app.senderName
    });
    loadData();
  };

  const handleRejectAlpha = async (app: AlphanumericApp) => {
    const reason = prompt("Reddetme nedeni:");
    if (reason) {
      await updateDoc(doc(db, 'alphanumeric_apps', app.id), { status: 'rejected', rejectionReason: reason });
      loadData();
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    
    // Create a broadcast message to all users from TALKO system account
    // This requires looping all users and creating conversations/messages
    alert("Duyuru özelliği yakında eklenecektir.");
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(userQuery.toLowerCase()) || 
    u.talkoNumber.toLowerCase().includes(userQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0F1115] text-white flex flex-col font-sans">
      <header className="bg-[#181B22] border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={onBackToApp} className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-yellow-500 text-black flex items-center justify-center font-black">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight">TALKO ADMIN</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-[#181B22] border border-gray-800 rounded-2xl">
            <div className="text-[11px] text-[#9AA4B2] font-bold uppercase">Toplam Kullanıcı</div>
            <div className="text-2xl font-extrabold mt-1">{stats.totalUsers}</div>
          </div>
          <div className="p-4 bg-[#181B22] border border-gray-800 rounded-2xl">
            <div className="text-[11px] text-green-500 font-bold uppercase">Çevrimiçi</div>
            <div className="text-2xl font-extrabold mt-1 text-green-500">{stats.activeUsers}</div>
          </div>
          <div className="p-4 bg-[#181B22] border border-gray-800 rounded-2xl">
            <div className="text-[11px] text-red-500 font-bold uppercase">Banlı Kullanıcı</div>
            <div className="text-2xl font-extrabold mt-1 text-red-500">{stats.bannedUsers}</div>
          </div>
          <div className="p-4 bg-[#181B22] border border-gray-800 rounded-2xl">
            <div className="text-[11px] text-purple-400 font-bold uppercase">Bekleyen Alpha</div>
            <div className="text-2xl font-extrabold mt-1 text-purple-400">{stats.pendingAlphanumerics}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-gray-800 pb-2 overflow-x-auto no-scrollbar">
          <button onClick={() => setActiveTab('users')} className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'users' ? 'bg-yellow-500 text-black' : 'text-[#9AA4B2] hover:bg-gray-800'}`}>
            <Users size={16} /> Kullanıcılar
          </button>
          <button onClick={() => setActiveTab('alphanumerics')} className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'alphanumerics' ? 'bg-yellow-500 text-black' : 'text-[#9AA4B2] hover:bg-gray-800'}`}>
            <Building2 size={16} /> Alphanumeric
          </button>
          <button onClick={() => setActiveTab('broadcast')} className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'broadcast' ? 'bg-yellow-500 text-black' : 'text-[#9AA4B2] hover:bg-gray-800'}`}>
            <Megaphone size={16} /> Duyuru
          </button>
        </div>

        {activeTab === 'users' && (
          <div className="bg-[#181B22] border border-gray-800 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <h2 className="text-sm font-bold">Kullanıcı Listesi</h2>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-2.5 text-gray-500" />
                <input type="text" value={userQuery} onChange={e => setUserQuery(e.target.value)} placeholder="Ara..." className="py-2 pl-9 pr-4 bg-[#0F1115] text-xs rounded-xl border border-gray-800 text-white focus:outline-none focus:border-yellow-500" />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[#9AA4B2] border-b border-gray-800 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-3">Kullanıcı</th>
                    <th className="p-3">Numara</th>
                    <th className="p-3">Durum</th>
                    <th className="p-3 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-[#0F1115]">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <DefaultAvatar color={u.avatarColor} size="sm" avatarUrl={u.avatarUrl} name={u.username} />
                          <span className="font-bold">{u.username}</span>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-[#2563EB]">{u.talkoNumber}</td>
                      <td className="p-3">
                        {u.isBanned ? <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">BANLI</span> : 
                         isUserOnline(u) ? <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">AKTİF</span> :
                         <span className="text-[#9AA4B2]">Çevrimdışı</span>}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button 
                          onClick={() => handleToggleBusiness(u)} 
                          title={u.isBusinessAccount ? "Kurumsal Yetkisini Kaldır" : "Kurumsal Yetkisi Ver"} 
                          className={`p-1.5 rounded transition-colors ${u.isBusinessAccount ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                        >
                          <Building2 size={14}/>
                        </button>
                        <button onClick={() => onOpenProfile(u)} className="p-1.5 bg-gray-800 rounded hover:text-blue-400"><Eye size={14}/></button>
                        {u.isBanned ? (
                          <button onClick={() => handleUnban(u.id)} className="px-2 py-1 bg-green-600 rounded text-[10px] font-bold">AÇ</button>
                        ) : (
                          <button onClick={() => setBanTarget(u)} className="px-2 py-1 bg-red-600 rounded text-[10px] font-bold">BAN</button>
                        )}
                        <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 bg-gray-800 rounded hover:text-red-400"><Trash2 size={14}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'alphanumerics' && (
          <div className="bg-[#181B22] border border-gray-800 rounded-3xl p-5 space-y-4">
            {alphanumerics.map(app => (
              <div key={app.id} className="p-4 bg-[#0F1115] border border-gray-800 rounded-2xl flex justify-between gap-4 items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">{app.senderName}</span>
                    <span className="text-xs text-[#9AA4B2]">{app.companyName}</span>
                  </div>
                  <p className="text-xs mt-1 text-gray-300">{app.description}</p>
                </div>
                {app.status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => handleApproveAlpha(app)} className="px-3 py-1.5 bg-green-600 rounded-xl text-xs font-bold flex items-center gap-1"><CheckCircle2 size={14}/> Onayla</button>
                    <button onClick={() => handleRejectAlpha(app)} className="px-3 py-1.5 bg-red-600 rounded-xl text-xs font-bold flex items-center gap-1"><XCircle size={14}/> Reddet</button>
                  </div>
                )}
                {app.status !== 'pending' && (
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${app.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {app.status.toUpperCase()}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'broadcast' && (
          <div className="bg-[#181B22] border border-gray-800 rounded-3xl p-6 max-w-2xl mx-auto space-y-4">
            <h2 className="text-sm font-bold">TALKO Sistem Duyurusu</h2>
            <form onSubmit={handleSendBroadcast} className="space-y-3">
              <textarea rows={4} value={broadcastMessage} onChange={e => setBroadcastMessage(e.target.value)} className="w-full text-sm p-3 bg-[#0F1115] border border-gray-800 rounded-xl focus:outline-none focus:border-yellow-500" placeholder="Mesaj..."/>
              <button type="submit" className="w-full py-3 bg-yellow-500 text-black font-bold text-xs rounded-xl">İlet</button>
            </form>
          </div>
        )}
      </main>
      
      {banTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#181B22] border border-gray-800 rounded-3xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-sm font-bold">Kalıcı Ban</h3>
            <form onSubmit={handleBanSubmit} className="space-y-3">
              <textarea rows={3} value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Gerekçe..." className="w-full text-sm p-3 bg-[#0F1115] border border-gray-800 rounded-xl focus:border-red-500 outline-none" required />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setBanTarget(null)} className="px-4 py-2 text-xs text-[#9AA4B2]">İptal</button>
                <button type="submit" className="px-4 py-2 bg-red-600 rounded-xl text-xs font-bold">Banla</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
