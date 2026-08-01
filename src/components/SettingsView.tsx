import React, { useState, useEffect } from 'react';
import { Lock, Bell, Building2, LogOut, ChevronRight, Volume2, QrCode, Phone, Shield, Ban, Copy, Check, EyeOff } from 'lucide-react';
import { User, AlphanumericApp } from '../types';
import { DefaultAvatar } from './DefaultAvatar';
import { soundManager } from '../lib/audio';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsViewProps {
  currentUser: User;
  onOpenAlphanumeric: () => void;
  onOpenQR?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ currentUser, onOpenAlphanumeric, onOpenQR }) => {
  const { logout } = useAuth();
  const [soundEnabled, setSoundEnabled] = useState(currentUser.settings?.soundEnabled ?? true);
  const [readReceipts, setReadReceipts] = useState(currentUser.settings?.readReceipts ?? true);
  const [lastSeen, setLastSeen] = useState(currentUser.settings?.lastSeen ?? true);
  const [onlineStatus, setOnlineStatus] = useState(currentUser.settings?.onlineStatus ?? true);

  const [myApps, setMyApps] = useState<AlphanumericApp[]>([]);
  const [copied, setCopied] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);

  useEffect(() => {
    const fetchApps = async () => {
      const q = query(collection(db, 'alphanumeric_apps'), where('userId', '==', currentUser.id));
      const snap = await getDocs(q);
      const apps = snap.docs.map(d => ({ id: d.id, ...d.data() } as AlphanumericApp));
      setMyApps(apps);
    };
    fetchApps();
  }, [currentUser.id]);

  const updateSetting = async (key: string, value: boolean) => {
    const userRef = doc(db, 'users', currentUser.id);
    await setDoc(userRef, {
      settings: {
        [key]: value
      }
    }, { merge: true });
  };

  const handleSoundToggle = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundManager.setSoundEnabled(next);
    updateSetting('soundEnabled', next);
  };

  const handleReadReceiptsToggle = () => {
    const next = !readReceipts;
    setReadReceipts(next);
    updateSetting('readReceipts', next);
  };

  const handleLastSeenToggle = () => {
    const next = !lastSeen;
    setLastSeen(next);
    updateSetting('lastSeen', next);
  };

  const handleOnlineStatusToggle = () => {
    const next = !onlineStatus;
    setOnlineStatus(next);
    const userRef = doc(db, 'users', currentUser.id);
    setDoc(userRef, {
      isOnline: next,
      lastSeen: new Date().toISOString(),
      settings: {
        onlineStatus: next
      }
    }, { merge: true });
  };

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(currentUser.talkoNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout error', err);
    }
  };

  const SettingRow = ({ icon: Icon, title, subtitle, onClick, rightElement, danger = false }: any) => (
    <div 
      onClick={onClick}
      className={`flex items-center justify-between p-4 bg-[#181B22] border-b border-[#23262F] last:border-0 ${onClick ? 'cursor-pointer hover:bg-[#23262F] transition-colors' : ''}`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${danger ? 'bg-red-500/10 text-red-500' : 'bg-[#0F1115] text-[#2563EB] border border-[#23262F]'}`}>
          <Icon size={18} />
        </div>
        <div>
          <div className={`font-semibold text-sm ${danger ? 'text-red-500' : 'text-white'}`}>{title}</div>
          {subtitle && <div className="text-xs text-[#9AA4B2] mt-0.5">{subtitle}</div>}
        </div>
      </div>
      {rightElement ? rightElement : (onClick && <ChevronRight size={18} className="text-[#9AA4B2]" />)}
    </div>
  );

  const ToggleSwitch = ({ checked, onChange }: any) => (
    <button 
      onClick={onChange}
      className={`w-12 h-6 rounded-full transition-colors relative ${checked ? 'bg-[#2563EB]' : 'bg-[#23262F] border border-gray-700'}`}
    >
      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  );

  return (
    <div className="bg-[#0F1115] min-h-full pb-24">
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        
        {/* Profile Header */}
        <div className="flex flex-col items-center pt-6 pb-2">
          <div className="relative mb-4">
            <DefaultAvatar 
              color={currentUser.avatarColor}
              size="xl"
              avatarUrl={currentUser.avatarUrl}
              name={currentUser.talkoNumber}
              className="shadow-2xl border-4 border-[#181B22]"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black font-mono text-white tracking-tight">{currentUser.talkoNumber}</h2>
            <button 
              onClick={handleCopyNumber}
              className="p-1.5 bg-[#181B22] hover:bg-[#23262F] text-[#9AA4B2] hover:text-white rounded-lg border border-[#23262F] transition-colors"
              title="Numarayı Kopyala"
            >
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
          </div>

          <div className="text-xs text-[#9AA4B2] mt-1.5 flex items-center gap-1.5 bg-[#181B22] px-3.5 py-1 rounded-full border border-[#23262F]">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span>Kimlik: Talko Numara Hesabı</span>
          </div>
        </div>

        {/* Talko Numaram & QR Kodum */}
        <div>
          <h3 className="text-xs font-bold text-[#9AA4B2] uppercase tracking-wider mb-2 ml-4">Talko Hesabım</h3>
          <div className="bg-[#181B22] rounded-3xl overflow-hidden border border-[#23262F]">
            <SettingRow 
              icon={Phone} 
              title="Talko Numaram" 
              subtitle={currentUser.talkoNumber} 
              onClick={handleCopyNumber}
              rightElement={
                <span className="text-xs font-mono text-[#2563EB] bg-[#2563EB]/10 px-2.5 py-1 rounded-lg font-bold border border-[#2563EB]/20">
                  {copied ? 'Kopyalandı' : 'Kopyala'}
                </span>
              } 
            />
            <SettingRow icon={QrCode} title="QR Kodum" subtitle="Numaranızı hızlıca paylaşın" onClick={onOpenQR} />
          </div>
        </div>

        {/* Ses Ayarları */}
        <div>
          <h3 className="text-xs font-bold text-[#9AA4B2] uppercase tracking-wider mb-2 ml-4">Ses Ayarları</h3>
          <div className="bg-[#181B22] rounded-3xl overflow-hidden border border-[#23262F]">
            <SettingRow 
              icon={Volume2} 
              title="Uygulama Ses Efektleri" 
              subtitle="Mesaj alma ve gönderme sesleri"
              rightElement={<ToggleSwitch checked={soundEnabled} onChange={handleSoundToggle} />} 
            />
          </div>
        </div>

        {/* Gizlilik & Engellenenler */}
        <div>
          <h3 className="text-xs font-bold text-[#9AA4B2] uppercase tracking-wider mb-2 ml-4">Gizlilik</h3>
          <div className="bg-[#181B22] rounded-3xl overflow-hidden border border-[#23262F]">
            <SettingRow icon={Lock} title="Son Görülme" subtitle={lastSeen ? "Herkes görebilir" : "Kimse göremez"} rightElement={<ToggleSwitch checked={lastSeen} onChange={handleLastSeenToggle} />} />
            <SettingRow icon={EyeOff} title="Okundu Bilgisi" subtitle={readReceipts ? "Mavi tık aktif" : "Mavi tık kapalı"} rightElement={<ToggleSwitch checked={readReceipts} onChange={handleReadReceiptsToggle} />} />
            <SettingRow icon={Shield} title="Çevrimiçi Durumu" subtitle={onlineStatus ? "Aktif durumunuz açık" : "Çevrimiçi görünmez"} rightElement={<ToggleSwitch checked={onlineStatus} onChange={handleOnlineStatusToggle} />} />
            <SettingRow 
              icon={Ban} 
              title="Engellenen Numaralar" 
              subtitle={`${currentUser.blockedSenders?.length || 0} engellenen numara`} 
              onClick={() => setShowBlockedModal(true)} 
            />
          </div>
        </div>

        {/* Kurumsal Alphanumeric & Business Panel */}
        <div>
          <h3 className="text-xs font-bold text-[#9AA4B2] uppercase tracking-wider mb-2 ml-4">Kurumsal Hizmetler</h3>
          <div className="bg-[#181B22] rounded-3xl overflow-hidden border border-[#23262F]">
            {(currentUser.isBusinessAccount || currentUser.isAlphanumericSender || currentUser.isAdmin || currentUser.email?.toLowerCase() === 'devy.build.backup@gmail.com' || currentUser.email?.toLowerCase() === 'lowai.official@gmail.com') && (
              <SettingRow 
                icon={Building2} 
                title="Talko Business Panel" 
                subtitle="Toplu mesaj gönderimi ve kampanya yönetimi" 
                onClick={() => {
                  window.history.pushState({}, '', '/business');
                  window.dispatchEvent(new Event('popstate'));
                }} 
              />
            )}
            <SettingRow 
              icon={Building2} 
              title="Alphanumeric Başvurusu" 
              subtitle={myApps.length > 0 ? `Başvuru Durumu: ${myApps[0].status === 'approved' ? 'Onaylandı' : 'İnceleniyor'}` : 'Şirketiniz adına SMS Başlığı alın'} 
              onClick={onOpenAlphanumeric} 
            />
          </div>
        </div>

        {/* Çıkış Yap */}
        <div>
          <h3 className="text-xs font-bold text-red-500/70 uppercase tracking-wider mb-2 ml-4">Oturum</h3>
          <div className="bg-[#181B22] rounded-3xl overflow-hidden border border-red-500/20">
            <SettingRow icon={LogOut} title="Çıkış Yap" danger onClick={handleLogout} />
          </div>
        </div>

      </div>

      {/* Blocked Numbers Modal */}
      <AnimatePresence>
        {showBlockedModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-[#181B22] border border-[#23262F] rounded-3xl w-full max-w-sm p-6 text-center shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <Ban size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Engellenen Numaralar</h3>
              
              {(!currentUser.blockedSenders || currentUser.blockedSenders.length === 0) ? (
                <p className="text-xs text-[#9AA4B2] mb-6 leading-relaxed">
                  Henüz engellenmiş bir numara bulunmamaktadır. Bir kullanıcıyı engellemek için mesaj içi seçeneklerden "Engelle" butonunu kullanabilirsiniz.
                </p>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 my-4 text-left no-scrollbar">
                  {currentUser.blockedSenders.map(senderNum => (
                    <div key={senderNum} className="flex items-center justify-between p-3 bg-[#0F1115] border border-[#23262F] rounded-2xl">
                      <span className="font-mono text-xs font-bold text-red-400">{senderNum}</span>
                      <button
                        onClick={async () => {
                          const updated = (currentUser.blockedSenders || []).filter(s => s !== senderNum);
                          const userRef = doc(db, 'users', currentUser.id);
                          await setDoc(userRef, { blockedSenders: updated }, { merge: true });
                        }}
                        className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold rounded-lg border border-red-500/20 transition-colors"
                      >
                        Engeli Kaldır
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button 
                onClick={() => setShowBlockedModal(false)}
                className="w-full py-3 bg-[#23262F] hover:bg-gray-800 text-white font-bold text-xs rounded-2xl transition-colors mt-2"
              >
                Kapat
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
