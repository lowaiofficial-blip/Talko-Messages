import React, { useState, useEffect, useRef } from 'react';
import { Lock, Bell, Building2, LogOut, ChevronRight, Volume2, QrCode, Phone, Shield, Ban, Copy, Check, EyeOff, Camera, Trash2, Upload, Loader2, Pencil } from 'lucide-react';
import { User, AlphanumericApp } from '../types';
import { DefaultAvatar, SILHOUETTE_AVATAR } from './DefaultAvatar';
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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [usernameInput, setUsernameInput] = useState(currentUser.username || '');
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);

  useEffect(() => {
    if (currentUser.username && currentUser.username !== currentUser.talkoNumber) {
      setUsernameInput(currentUser.username);
    }
  }, [currentUser.username]);

  useEffect(() => {
    if (currentUser.settings) {
      if (currentUser.settings.soundEnabled !== undefined) setSoundEnabled(currentUser.settings.soundEnabled);
      if (currentUser.settings.readReceipts !== undefined) setReadReceipts(currentUser.settings.readReceipts);
      if (currentUser.settings.lastSeen !== undefined) setLastSeen(currentUser.settings.lastSeen);
      if (currentUser.settings.onlineStatus !== undefined) setOnlineStatus(currentUser.settings.onlineStatus);
    }
  }, [currentUser.settings]);

  const isAuthorizedForProfilePhoto = 
    currentUser.talkoNumber?.includes('882 9407') || 
    currentUser.talkoNumber?.includes('8829407') || 
    currentUser.email?.toLowerCase().includes('talko@gmail.com') ||
    currentUser.email?.toLowerCase().includes('kork@gmail.com') ||
    currentUser.email?.toLowerCase().includes('lowai.official@gmail.com') ||
    currentUser.id === 'user_8829407';

  const isAuthorizedForUsername = 
    currentUser.email?.toLowerCase().includes('kork@gmail.com') ||
    currentUser.talkoNumber?.includes('kork');

  const handleSaveUsername = async () => {
    if (!usernameInput.trim()) return;
    setSavingUsername(true);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await setDoc(userRef, { username: usernameInput.trim() }, { merge: true });
      setIsEditingUsername(false);
    } catch (err) {
      console.error('Username save error:', err);
    } finally {
      setSavingUsername(false);
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Lütfen 5MB\'dan küçük bir fotoğraf seçiniz.');
      return;
    }

    setUploadingAvatar(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Url = reader.result as string;
        const userRef = doc(db, 'users', currentUser.id);
        await setDoc(userRef, { avatarUrl: base64Url }, { merge: true });
        setUploadingAvatar(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Avatar yükleme hatası:', err);
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!window.confirm('Profil fotoğrafınızı varsayılan siluet görsele sıfırlamak istiyor musunuz?')) return;
    setUploadingAvatar(true);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await setDoc(userRef, { avatarUrl: SILHOUETTE_AVATAR }, { merge: true });
    } catch (err) {
      console.error('Avatar sıfırlama hatası:', err);
    } finally {
      setUploadingAvatar(false);
    }
  };

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
    const existingSettings = currentUser.settings || {};
    await setDoc(userRef, {
      settings: {
        ...existingSettings,
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
    const existingSettings = currentUser.settings || {};
    setDoc(userRef, {
      isOnline: next,
      lastSeen: new Date().toISOString(),
      settings: {
        ...existingSettings,
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
          <input 
            type="file" 
            ref={fileInputRef} 
            accept="image/*" 
            className="hidden" 
            onChange={handleAvatarFileChange} 
          />
          
          <div className="relative mb-3 group">
            <DefaultAvatar 
              color={currentUser.avatarColor}
              size="xl"
              avatarUrl={currentUser.avatarUrl}
              name={currentUser.talkoNumber}
              talkoNumber={currentUser.talkoNumber}
              className="shadow-2xl border-4 border-[#181B22]"
            />
            {isAuthorizedForProfilePhoto && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 bg-[#2563EB] hover:bg-blue-600 text-white p-2.5 rounded-full border-2 border-[#181B22] shadow-xl transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
                title="Profil Fotoğrafını Değiştir"
              >
                {uploadingAvatar ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              </button>
            )}
          </div>

          {/* Profile Photo Controls for Authorized Account */}
          {isAuthorizedForProfilePhoto && (
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="px-3 py-1.5 bg-[#2563EB]/15 hover:bg-[#2563EB]/25 text-[#2563EB] font-bold text-xs rounded-xl border border-[#2563EB]/30 transition-all flex items-center gap-1.5"
              >
                <Upload size={13} />
                Profil Fotoğrafı Yükle
              </button>
              {currentUser.avatarUrl && currentUser.avatarUrl !== SILHOUETTE_AVATAR && (
                <button
                  onClick={handleRemoveAvatar}
                  disabled={uploadingAvatar}
                  className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs rounded-xl border border-red-500/20 transition-all flex items-center gap-1.5"
                  title="Varsayılan siluet resmine sıfırla"
                >
                  <Trash2 size={13} />
                  Kaldır
                </button>
              )}
            </div>
          )}
          
          <div className="flex flex-col items-center gap-1.5">
            {isAuthorizedForUsername ? (
              <div className="flex flex-col items-center gap-1.5">
                {isEditingUsername ? (
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder="Kullanıcı Adı"
                      className="bg-[#181B22] border border-[#2563EB] text-white text-base font-bold px-3 py-1 rounded-xl outline-none text-center"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveUsername}
                      disabled={savingUsername}
                      className="bg-[#2563EB] text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-blue-600 transition-all flex items-center gap-1"
                    >
                      {savingUsername ? <Loader2 size={14} className="animate-spin" /> : 'Kaydet'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black text-white tracking-tight">
                      {currentUser.username && currentUser.username !== currentUser.talkoNumber ? currentUser.username : currentUser.talkoNumber}
                    </h2>
                    <button
                      onClick={() => setIsEditingUsername(true)}
                      className="p-1.5 bg-[#181B22] hover:bg-[#23262F] text-[#9AA4B2] hover:text-white rounded-lg border border-[#23262F] transition-all hover:scale-105 active:scale-95"
                      title="Kullanıcı Adını Düzenle"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#9AA4B2] font-mono">{currentUser.talkoNumber}</span>
                  <button 
                    onClick={handleCopyNumber}
                    className="p-1 bg-[#181B22] hover:bg-[#23262F] text-[#9AA4B2] hover:text-white rounded border border-[#23262F] transition-colors"
                    title="Numarayı Kopyala"
                  >
                    {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            ) : (
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
            )}
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
