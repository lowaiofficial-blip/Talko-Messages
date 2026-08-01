import React, { useState, useEffect } from 'react';
import { User, BusinessCampaign, checkIsSpam, checkBusinessFilter, getDisplayName, AvatarColor } from '../types';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc, 
  onSnapshot, 
  orderBy, 
  getDoc 
} from 'firebase/firestore';
import { 
  Building2, 
  Send, 
  Users, 
  History, 
  CheckCircle2, 
  AlertTriangle, 
  Ban, 
  Search, 
  CheckSquare, 
  Square, 
  ArrowLeft, 
  BarChart3, 
  Sparkles, 
  ShieldCheck,
  Mail,
  Clock,
  Eye,
  ShieldAlert,
  AlertOctagon,
  Filter,
  X,
  Lock,
  MessageSquare
} from 'lucide-react';
import { DefaultAvatar } from './DefaultAvatar';

interface BusinessPanelProps {
  currentUser: User;
  onClose: () => void;
}

export const BusinessPanel: React.FC<BusinessPanelProps> = ({ currentUser, onClose }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'history' | 'users'>('create');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'delivered' | 'filter_blocked'>('all');
  
  // Fixed Sender Title (DEVYBUILD by default if not set, or user's approved alphanumeric title)
  const senderTitle = currentUser.alphanumericName || currentUser.businessTitle || 'DEVYBUILD';

  // Form State
  const [messageContent, setMessageContent] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccessMessage, setSendSuccessMessage] = useState('');
  
  // Filter Blocked Warning Modal State
  const [blockedWarningModalData, setBlockedWarningModalData] = useState<{
    reasons: string[];
    content: string;
    recipientCount: number;
  } | null>(null);

  // Campaigns & Stats State
  const [campaigns, setCampaigns] = useState<BusinessCampaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  // Fetch all users for recipient selection
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, 'users'));
        const snap = await getDocs(q);
        const usersList = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as User))
          .filter(u => u.talkoNumber !== currentUser.talkoNumber && !u.isBanned && !u.isSystemAccount);
        setAllUsers(usersList);
      } catch (err) {
        console.error("Error fetching users for business panel:", err);
      }
    };
    fetchUsers();
  }, [currentUser.talkoNumber]);

  // Listen to business campaigns for history & stats
  useEffect(() => {
    const q = query(
      collection(db, 'business_campaigns'),
      where('businessId', '==', currentUser.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const camps = snap.docs.map(d => ({ id: d.id, ...d.data() } as BusinessCampaign));
      setCampaigns(camps);
      setLoadingCampaigns(false);
    }, (err) => {
      console.error("Error listening to campaigns:", err);
      setLoadingCampaigns(false);
    });

    return () => unsubscribe();
  }, [currentUser.id]);

  // Aggregate Stats
  const totalMessagesSent = campaigns.reduce((acc, c) => acc + (c.recipientCount || 0), 0);
  const totalDelivered = campaigns.reduce((acc, c) => acc + (c.deliveredCount || 0), 0);
  const totalRead = campaigns.reduce((acc, c) => acc + (c.readCount || 0), 0);
  const totalFilterBlocked = campaigns.reduce((acc, c) => {
    if (c.isFilterBlocked || c.status === 'filter_blocked') {
      return acc + (c.recipientCount || 1);
    }
    return acc;
  }, 0);
  const totalSpam = campaigns.reduce((acc, c) => acc + (c.spamCount || 0), 0);
  const totalBlocked = campaigns.reduce((acc, c) => acc + (c.blockedCount || 0), 0);

  // User Search Filtering
  const filteredUsers = allUsers.filter(u => {
    if (!userSearchQuery.trim()) return true;
    const q = userSearchQuery.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.talkoNumber.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  });

  const handleToggleUser = (userId: string) => {
    const newSet = new Set(selectedUserIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUserIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedUserIds.size === filteredUsers.length && filteredUsers.length > 0) {
      setSelectedUserIds(new Set());
    } else {
      const newSet = new Set(filteredUsers.map(u => u.id));
      setSelectedUserIds(newSet);
    }
  };

  // Send Bulk Message
  const handleSendBulkMessage = async () => {
    if (!messageContent.trim()) {
      alert('Lütfen gönderilecek mesaj metnini giriniz.');
      return;
    }
    if (selectedUserIds.size === 0) {
      alert('Lütfen en az bir alıcı seçiniz.');
      return;
    }

    setIsSending(true);
    setSendSuccessMessage('');

    const trimmedContent = messageContent.trim();
    const nowIso = new Date().toISOString();

    // 🛡️ 1. GÖNDERİM ÖNCESİ OTOMATİK FİLTRE TARAMASI
    const filterResult = checkBusinessFilter(trimmedContent);

    if (filterResult.isBlocked) {
      // Mesaj engellendi! Modal göster.
      setBlockedWarningModalData({
        reasons: filterResult.reasons,
        content: trimmedContent,
        recipientCount: selectedUserIds.size
      });

      // TALKO Otomatik Sistem Bildirimi oluştur
      try {
        const talkoConvId = `TALKO_${currentUser.talkoNumber}`;
        const talkoConvRef = doc(db, 'conversations', talkoConvId);
        const talkoMsgRef = doc(collection(db, 'conversations', talkoConvId, 'messages'));

        const talkoSystemUser: User = {
          id: 'talko_system',
          talkoNumber: 'TALKO',
          username: 'TALKO',
          avatarColor: 'blue',
          isOnline: true,
          lastSeen: nowIso,
          isBanned: false,
          isSystemAccount: true
        };

        const talkoMsg = {
          id: talkoMsgRef.id,
          conversationId: talkoConvId,
          senderId: 'talko_system',
          senderNumber: 'TALKO',
          senderName: 'TALKO',
          senderAvatarColor: 'blue' as AvatarColor,
          content: 'TALKO GÜVENLİK BİLDİRİMİ: Kurumsal gönderiminiz güvenlik politikaları nedeniyle engellendi. Lütfen E-posta, Telefon, Web sitesi veya Harici mesajlaşma/sosyal medya bilgileri paylaşmadan tekrar deneyin.',
          timestamp: nowIso,
          status: 'sent' as const,
          isSystem: true
        };

        await setDoc(talkoMsgRef, talkoMsg);
        await setDoc(talkoConvRef, {
          id: talkoConvId,
          participants: ['TALKO', currentUser.talkoNumber],
          participantUsers: [talkoSystemUser, currentUser],
          lastMessage: talkoMsg,
          unreadCount: { [currentUser.talkoNumber]: 1 },
          typingUsers: [],
          updatedAt: nowIso
        }, { merge: true });
      } catch (err) {
        console.error("Error creating TALKO filter notification:", err);
      }

      // Kampanya kaydını Firestore'a "filter_blocked" olarak kaydet
      try {
        const campRef = doc(collection(db, 'business_campaigns'));
        const blockedCamp: BusinessCampaign = {
          id: campRef.id,
          businessId: currentUser.id,
          businessTalkoNumber: currentUser.talkoNumber,
          senderTitle,
          content: trimmedContent,
          recipientCount: selectedUserIds.size,
          deliveredCount: 0,
          readCount: 0,
          spamCount: 0,
          blockedCount: 0,
          createdAt: nowIso,
          recipients: Array.from(selectedUserIds).map(id => {
            const u = allUsers.find(x => x.id === id);
            return u ? u.talkoNumber : id;
          }),
          isFilterBlocked: true,
          filterReasons: filterResult.reasons,
          status: 'filter_blocked'
        };

        await setDoc(campRef, blockedCamp);
      } catch (err) {
        console.error("Error logging blocked campaign record:", err);
      }

      setIsSending(false);
      return;
    }

    // 2. Normal Mesaj Gönderimi
    let delivered = 0;
    let spamCount = 0;
    let blockedCount = 0;

    const targetUsers = allUsers.filter(u => selectedUserIds.has(u.id));
    const isSpamContent = checkIsSpam(trimmedContent);

    try {
      for (const targetUser of targetUsers) {
        // Check if recipient has blocked this corporate sender
        const recipientRef = doc(db, 'users', targetUser.id);
        const recipientSnap = await getDoc(recipientRef);
        const recipientData = recipientSnap.exists() ? recipientSnap.data() as User : targetUser;

        const isBlockedByRecipient = 
          recipientData.blockedSenders?.includes(currentUser.talkoNumber) ||
          recipientData.blockedSenders?.includes(senderTitle) ||
          recipientData.blockedConvs?.includes(`${currentUser.talkoNumber}_${targetUser.talkoNumber}`);

        if (isBlockedByRecipient) {
          blockedCount++;
          continue;
        }

        // Determine conversation ID
        const sortedParts = [currentUser.talkoNumber, targetUser.talkoNumber].sort();
        const convId = `${sortedParts[0]}_${sortedParts[1]}`;
        const convRef = doc(db, 'conversations', convId);

        // System corporate metadata for sender
        const corporateSenderUser: User = {
          ...currentUser,
          isAlphanumericSender: true,
          alphanumericName: senderTitle,
          isBusinessAccount: true,
          businessTitle: senderTitle,
          username: senderTitle
        };

        const msgRef = doc(collection(db, 'conversations', convId, 'messages'));
        const newMsg = {
          id: msgRef.id,
          conversationId: convId,
          senderId: currentUser.id,
          senderNumber: currentUser.talkoNumber,
          senderName: senderTitle,
          senderAvatarColor: currentUser.avatarColor,
          content: trimmedContent,
          timestamp: nowIso,
          status: 'sent',
          isSpam: isSpamContent
        };

        await setDoc(msgRef, newMsg);

        // Fetch existing conv doc to update unread
        const existingConvSnap = await getDoc(convRef);
        let unreadCount: Record<string, number> = {};
        if (existingConvSnap.exists()) {
          unreadCount = existingConvSnap.data().unreadCount || {};
        }
        unreadCount[targetUser.talkoNumber] = (unreadCount[targetUser.talkoNumber] || 0) + 1;

        await setDoc(convRef, {
          id: convId,
          participants: [currentUser.talkoNumber, targetUser.talkoNumber],
          participantUsers: [corporateSenderUser, targetUser],
          lastMessage: newMsg,
          unreadCount,
          typingUsers: [],
          updatedAt: nowIso,
          isCorporate: true,
          isSpam: isSpamContent
        }, { merge: true });

        if (isSpamContent) {
          spamCount++;
        } else {
          delivered++;
        }
      }

      // Record Successful Campaign in Firestore
      const campRef = doc(collection(db, 'business_campaigns'));
      const newCamp: BusinessCampaign = {
        id: campRef.id,
        businessId: currentUser.id,
        businessTalkoNumber: currentUser.talkoNumber,
        senderTitle,
        content: trimmedContent,
        recipientCount: targetUsers.length,
        deliveredCount: delivered,
        readCount: 0,
        spamCount,
        blockedCount,
        createdAt: nowIso,
        recipients: targetUsers.map(u => u.talkoNumber),
        status: 'delivered'
      };

      await setDoc(campRef, newCamp);

      setSendSuccessMessage(`✅ Toplu mesaj gönderildi! (${delivered} Teslim Edildi, ${spamCount} Spam'e Düştü, ${blockedCount} Engellendi)`);
      setMessageContent('');
      setSelectedUserIds(new Set());
    } catch (err: any) {
      console.error("Bulk sending error:", err);
      alert('Mesaj gönderilirken bir hata oluştu: ' + (err.message || 'Bilinmeyen Hata'));
    } finally {
      setIsSending(false);
    }
  };

  // Filtered Campaigns for History Tab
  const displayedCampaigns = campaigns.filter(c => {
    if (historyFilter === 'delivered') return !c.isFilterBlocked && c.status !== 'filter_blocked';
    if (historyFilter === 'filter_blocked') return c.isFilterBlocked || c.status === 'filter_blocked';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1115] text-white flex flex-col overflow-hidden">
      
      {/* Top Bar Header */}
      <div className="bg-[#181B22] border-b border-[#23262F] px-6 py-4 flex items-center justify-between shrink-0 shadow-xl">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose} 
            className="p-2.5 bg-[#0F1115] hover:bg-[#23262F] border border-[#23262F] text-gray-300 hover:text-white rounded-2xl transition-all"
            title="Sohbetlere Dön"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20 flex items-center justify-center font-bold shadow-lg shadow-blue-500/10">
              <Building2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white tracking-tight">Talko Business Panel</h1>
                <span className="px-2.5 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded-full border border-blue-500/20 uppercase tracking-wider">
                  Kurumsal Sürüm
                </span>
              </div>
              <p className="text-xs text-[#9AA4B2] mt-0.5">
                Toplu Mesaj Gönderim ve Güvenli Kurumsal İletişim
              </p>
            </div>
          </div>
        </div>

        {/* Fixed Sender Title Info */}
        <div className="hidden md:flex items-center gap-3 bg-[#0F1115] px-4 py-2 rounded-2xl border border-[#23262F]">
          <ShieldCheck size={18} className="text-[#2563EB]" />
          <div>
            <div className="text-[10px] font-bold text-[#9AA4B2] uppercase tracking-wider">Gönderici Adı (Sabit)</div>
            <div className="text-sm font-black font-mono text-white tracking-widest">{senderTitle}</div>
          </div>
        </div>
      </div>

      {/* Main Responsive Grid Layout */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        
        {/* Left Sidebar Navigation (3 columns on LG) */}
        <div className="lg:col-span-3 bg-[#181B22] border-r border-[#23262F] p-4 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            
            {/* Business Profile Card */}
            <div className="p-4 rounded-3xl bg-gradient-to-br from-[#2563EB]/10 to-[#181B22] border border-[#2563EB]/20">
              <div className="text-xs font-bold text-[#2563EB] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles size={14} /> Onaylı Kurumsal Hesap
              </div>
              <div className="text-lg font-black text-white font-mono">{senderTitle}</div>
              <div className="text-xs text-[#9AA4B2] mt-1 font-mono">Talko No: {currentUser.talkoNumber}</div>
              <div className="mt-3 pt-3 border-t border-[#23262F] text-[11px] text-[#9AA4B2] leading-relaxed">
                * Gönderici adı yönetici onaylıdır ve değiştirilemez.
              </div>
            </div>

            {/* Menu Buttons */}
            <div className="space-y-1.5">
              <button
                onClick={() => setActiveTab('create')}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-xs transition-all ${activeTab === 'create' ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-500/25' : 'text-[#9AA4B2] hover:bg-[#23262F] hover:text-white'}`}
              >
                <Send size={18} />
                <span>Yeni Toplu Mesaj</span>
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-xs transition-all ${activeTab === 'history' ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-500/25' : 'text-[#9AA4B2] hover:bg-[#23262F] hover:text-white'}`}
              >
                <History size={18} />
                <span>Gönderim Geçmişi ({campaigns.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-xs transition-all ${activeTab === 'users' ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-500/25' : 'text-[#9AA4B2] hover:bg-[#23262F] hover:text-white'}`}
              >
                <Users size={18} />
                <span>Alıcı Rehberi ({allUsers.length})</span>
              </button>
            </div>

            {/* Platform Rules Sidebar Notice */}
            <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-amber-200">
                <ShieldAlert size={16} className="text-amber-400" /> Platform Güvenlik Uyarısı
              </div>
              <p className="text-[11px] leading-relaxed text-amber-200/80">
                Business Panel üzerinden kullanıcıları WhatsApp, Telegram, Discord, E-posta, Sosyal Medya veya Telefon numarasına yönlendirmek yasaktır.
              </p>
            </div>

          </div>

          {/* Quick System Status Footer */}
          <div className="pt-4 border-t border-[#23262F] text-[11px] text-[#9AA4B2]">
            <div className="flex items-center gap-2 text-green-400 font-semibold mb-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Filtre & Gönderim Koruması Aktif
            </div>
            <span>Talko Business Shield v3.0</span>
          </div>
        </div>

        {/* Center Main Workspace (6 columns on LG) */}
        <div className="lg:col-span-6 p-6 overflow-y-auto space-y-6 bg-[#0F1115]">
          
          {sendSuccessMessage && (
            <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/30 text-green-400 font-bold text-xs flex items-center gap-3 animate-fade-in shadow-lg">
              <CheckCircle2 size={20} className="shrink-0" />
              <span>{sendSuccessMessage}</span>
            </div>
          )}

          {/* TAB 1: YENİ TOPLU MESAJ */}
          {activeTab === 'create' && (
            <div className="space-y-6">
              
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Send size={20} className="text-[#2563EB]" /> Yeni Toplu Mesaj Oluştur
                  </h2>
                  <p className="text-xs text-[#9AA4B2] mt-0.5">Seçilen kullanıcılara platform içi güvenli mesaj gönderilir.</p>
                </div>
              </div>

              {/* Platform Rules Notice Box */}
              <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2 shadow-lg">
                <div className="font-bold flex items-center gap-2 text-amber-200 text-sm">
                  <ShieldAlert size={18} className="text-amber-400" /> Platform Güvenlik Kuralları & Yönlendirme Yasağı
                </div>
                <p className="leading-relaxed text-[11px] text-amber-200/90">
                  Business Panel sadece Talko içi kurumsal iletişim içindir. Kullanıcıları <strong>WhatsApp, Telegram, Discord, Instagram, E-posta, Telefon numarası veya Harici Web Sitelerine</strong> yönlendirmek yasaktır. Mesajlar gönderim öncesi otomatik güvenlik filtresiyle taranır.
                </p>
              </div>

              {/* Sender Name Fixed Field */}
              <div className="bg-[#181B22] p-4 rounded-3xl border border-[#23262F] space-y-2">
                <label className="text-xs font-bold text-[#9AA4B2] uppercase tracking-wider">Gönderici Adı</label>
                <div className="p-3 bg-[#0F1115] rounded-2xl border border-[#23262F] font-mono text-sm font-bold text-white flex items-center justify-between">
                  <span>{senderTitle}</span>
                  <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-lg border border-blue-500/20 font-sans font-bold">
                    Sabit Gönderici
                  </span>
                </div>
                <p className="text-[11px] text-[#9AA4B2]">
                  * Gönderici adı alıcıların sohbet listesinde bu isimle görünecektir.
                </p>
              </div>

              {/* Message Content Box */}
              <div className="bg-[#181B22] p-4 rounded-3xl border border-[#23262F] space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-[#9AA4B2] uppercase tracking-wider">Mesaj İçeriği</label>
                  <span className="text-xs text-[#9AA4B2]">{messageContent.length} Karakter</span>
                </div>
                <textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="Mesajınızı buraya yazınız... (Harici iletişim bilgisi yazılması engellenmektedir)"
                  rows={5}
                  className="w-full bg-[#0F1115] border border-[#23262F] focus:border-[#2563EB] rounded-2xl p-4 text-sm text-white placeholder-gray-500 outline-none transition-colors resize-none leading-relaxed"
                />
              </div>

              {/* Recipient User Picker */}
              <div className="bg-[#181B22] p-4 rounded-3xl border border-[#23262F] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="text-xs font-bold text-[#9AA4B2] uppercase tracking-wider">
                      Alıcılar ({selectedUserIds.size} / {allUsers.length} Seçildi)
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#23262F] hover:bg-gray-700 text-xs text-white font-bold rounded-xl transition-colors shrink-0"
                  >
                    {selectedUserIds.size === filteredUsers.length && filteredUsers.length > 0 ? (
                      <> <CheckSquare size={16} className="text-[#2563EB]" /> Tüm Seçimi Kaldır </>
                    ) : (
                      <> <Square size={16} /> Tümünü Seç ({filteredUsers.length}) </>
                    )}
                  </button>
                </div>

                {/* User Search Bar */}
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9AA4B2]" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Alıcı ara (İsim veya Talko No)..."
                    className="w-full bg-[#0F1115] border border-[#23262F] rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-[#2563EB]"
                  />
                </div>

                {/* Recipient Users Checklist */}
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-6 text-xs text-[#9AA4B2]">Kullanıcı bulunamadı.</div>
                  ) : (
                    filteredUsers.map(user => {
                      const isSelected = selectedUserIds.has(user.id);
                      return (
                        <div
                          key={user.id}
                          onClick={() => handleToggleUser(user.id)}
                          className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${isSelected ? 'bg-[#2563EB]/10 border-[#2563EB]/40' : 'bg-[#0F1115] border-[#23262F] hover:bg-[#23262F]'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${isSelected ? 'bg-[#2563EB] border-[#2563EB] text-white' : 'border-gray-600'}`}>
                              {isSelected && <CheckSquare size={14} />}
                            </div>
                            <DefaultAvatar 
                              color={user.avatarColor}
                              size="sm"
                              avatarUrl={user.avatarUrl}
                              name={getDisplayName(user)}
                            />
                            <div>
                              <div className="text-xs font-bold text-white">{getDisplayName(user)}</div>
                              <div className="text-[10px] font-mono text-[#9AA4B2]">{user.talkoNumber}</div>
                            </div>
                          </div>
                          {isSelected && (
                            <span className="text-[10px] font-bold text-[#2563EB] bg-[#2563EB]/10 px-2 py-0.5 rounded-full border border-[#2563EB]/20">
                              Seçildi
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSendBulkMessage}
                disabled={isSending || selectedUserIds.size === 0 || !messageContent.trim()}
                className="w-full py-4 bg-[#2563EB] hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm rounded-2xl transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2"
              >
                {isSending ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Güvenlik Kontrolü & Gönderiliyor...</span>
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    <span>Toplu Mesajı Gönder ({selectedUserIds.size} Alıcı)</span>
                  </>
                )}
              </button>

            </div>
          )}

          {/* TAB 2: GÖNDERİM GEÇMİŞİ */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <History size={20} className="text-[#2563EB]" /> Toplu Gönderim Geçmişi
                </h2>
                
                {/* Filter Tabs */}
                <div className="flex items-center gap-1.5 bg-[#181B22] p-1 rounded-2xl border border-[#23262F]">
                  <button
                    onClick={() => setHistoryFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${historyFilter === 'all' ? 'bg-[#2563EB] text-white' : 'text-[#9AA4B2] hover:text-white'}`}
                  >
                    Tümü ({campaigns.length})
                  </button>
                  <button
                    onClick={() => setHistoryFilter('delivered')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${historyFilter === 'delivered' ? 'bg-green-600 text-white' : 'text-[#9AA4B2] hover:text-white'}`}
                  >
                    Teslim Edilenler
                  </button>
                  <button
                    onClick={() => setHistoryFilter('filter_blocked')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${historyFilter === 'filter_blocked' ? 'bg-yellow-600 text-white' : 'text-[#9AA4B2] hover:text-white'}`}
                  >
                    🟡 Filtreye Takılanlar
                  </button>
                </div>
              </div>

              {loadingCampaigns ? (
                <div className="text-center py-12 text-xs text-[#9AA4B2]">Yükleniyor...</div>
              ) : displayedCampaigns.length === 0 ? (
                <div className="p-8 text-center bg-[#181B22] rounded-3xl border border-[#23262F] text-[#9AA4B2] text-xs">
                  Bu filtrede gösterilecek kayıt bulunamadı.
                </div>
              ) : (
                displayedCampaigns.map(camp => {
                  const isBlocked = camp.isFilterBlocked || camp.status === 'filter_blocked';
                  return (
                    <div 
                      key={camp.id} 
                      className={`p-5 rounded-3xl border space-y-3 transition-all ${isBlocked ? 'bg-yellow-950/20 border-yellow-500/40' : 'bg-[#181B22] border-[#23262F]'}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-[#2563EB]/10 text-[#2563EB] text-[11px] font-mono font-bold rounded-xl border border-[#2563EB]/20">
                            {camp.senderTitle}
                          </span>
                          <span className="text-xs text-[#9AA4B2] flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(camp.createdAt).toLocaleString()}
                          </span>
                        </div>

                        {/* Status Badge */}
                        {isBlocked ? (
                          <div className="text-xs font-bold text-yellow-300 bg-yellow-500/20 px-3 py-1 rounded-xl border border-yellow-500/40 flex items-center gap-1.5">
                            <AlertTriangle size={14} className="text-yellow-400" />
                            <span>🟡 Filtre Nedeniyle Engellendi</span>
                          </div>
                        ) : (
                          <div className="text-xs font-bold text-green-400 bg-green-500/10 px-3 py-1 rounded-xl border border-green-500/20 flex items-center gap-1">
                            <CheckCircle2 size={14} />
                            <span>Teslim Edildi ({camp.recipientCount} Alıcı)</span>
                          </div>
                        )}
                      </div>

                      {/* Content Box */}
                      <p className={`text-xs p-3 rounded-2xl border leading-relaxed ${isBlocked ? 'bg-black/40 text-yellow-100 border-yellow-500/30 font-mono' : 'bg-[#0F1115] text-gray-200 border-[#23262F]'}`}>
                        "{camp.content}"
                      </p>

                      {/* Filter Reasons Detail if Blocked */}
                      {isBlocked && camp.filterReasons && camp.filterReasons.length > 0 && (
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl text-xs text-yellow-300 space-y-1">
                          <div className="font-bold flex items-center gap-1.5 text-yellow-200">
                            <ShieldAlert size={14} /> Engelleme Nedeni:
                          </div>
                          <ul className="list-disc list-inside text-[11px] text-yellow-200/90 space-y-0.5 ml-1">
                            {camp.filterReasons.map((reason, idx) => (
                              <li key={idx}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Stats Breakdown */}
                      {!isBlocked && (
                        <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                          <div className="bg-green-500/10 text-green-400 p-2 rounded-xl text-center border border-green-500/20 font-bold">
                            {camp.deliveredCount} Teslim Edildi
                          </div>
                          <div className="bg-yellow-500/10 text-yellow-400 p-2 rounded-xl text-center border border-yellow-500/20 font-bold">
                            {camp.spamCount} Spam
                          </div>
                          <div className="bg-red-500/10 text-red-400 p-2 rounded-xl text-center border border-red-500/20 font-bold">
                            {camp.blockedCount} Engellendi
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: ALICI REHBERİ */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                <Users size={20} className="text-[#2563EB]" /> Kayıtlı Kullanıcı Rehberi
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allUsers.map(u => (
                  <div key={u.id} className="p-4 bg-[#181B22] rounded-3xl border border-[#23262F] flex items-center gap-3">
                    <DefaultAvatar 
                      color={u.avatarColor}
                      size="md"
                      avatarUrl={u.avatarUrl}
                      name={getDisplayName(u)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">{getDisplayName(u)}</div>
                      <div className="text-[10px] font-mono text-[#9AA4B2]">{u.talkoNumber}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right Panel Statistics Cards (3 columns on LG) */}
        <div className="lg:col-span-3 bg-[#181B22] border-l border-[#23262F] p-4 space-y-4 overflow-y-auto">
          <div className="text-xs font-bold text-[#9AA4B2] uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <BarChart3 size={16} className="text-[#2563EB]" /> Mesaj & Güvenlik İstatistikleri
          </div>

          {/* Stat Card 1: Toplam Gönderilen */}
          <div className="p-4 bg-[#0F1115] rounded-3xl border border-[#23262F] flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-[#9AA4B2] uppercase tracking-wider">Toplam Gönderilen</div>
              <div className="text-2xl font-black text-white font-mono mt-1">{totalMessagesSent}</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <Mail size={20} />
            </div>
          </div>

          {/* Stat Card 2: Teslim Edilen */}
          <div className="p-4 bg-[#0F1115] rounded-3xl border border-[#23262F] flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-[#9AA4B2] uppercase tracking-wider">Teslim Edilen</div>
              <div className="text-2xl font-black text-green-400 font-mono mt-1">{totalDelivered}</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-green-500/10 text-green-400 border border-green-500/20 flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
          </div>

          {/* Stat Card 3: Okunan */}
          <div className="p-4 bg-[#0F1115] rounded-3xl border border-[#23262F] flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-[#9AA4B2] uppercase tracking-wider">Okunan</div>
              <div className="text-2xl font-black text-blue-400 font-mono mt-1">{totalRead}</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <Eye size={20} />
            </div>
          </div>

          {/* Stat Card 4: Filtre Nedeniyle Engellendi */}
          <div className="p-4 bg-[#0F1115] rounded-3xl border border-yellow-500/30 flex items-center justify-between bg-yellow-500/5">
            <div>
              <div className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider">Filtreye Takılanlar</div>
              <div className="text-2xl font-black text-yellow-300 font-mono mt-1">{totalFilterBlocked}</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex items-center justify-center">
              <ShieldAlert size={20} />
            </div>
          </div>

          {/* Stat Card 5: Spam Olarak İşaretlendi */}
          <div className="p-4 bg-[#0F1115] rounded-3xl border border-[#23262F] flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-[#9AA4B2] uppercase tracking-wider">Spam Olarak İşaretlendi</div>
              <div className="text-2xl font-black text-orange-400 font-mono mt-1">{totalSpam}</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center justify-center">
              <AlertTriangle size={20} />
            </div>
          </div>

          {/* Stat Card 6: Engellenen Kullanıcı Sayısı */}
          <div className="p-4 bg-[#0F1115] rounded-3xl border border-[#23262F] flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-[#9AA4B2] uppercase tracking-wider">Engellenen Kullanıcı Sayısı</div>
              <div className="text-2xl font-black text-red-500 font-mono mt-1">{totalBlocked}</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center">
              <Ban size={20} />
            </div>
          </div>

          {/* System Rules Card */}
          <div className="p-4 rounded-3xl bg-[#0F1115] border border-[#23262F] text-xs text-[#9AA4B2] space-y-2 mt-4">
            <div className="font-bold text-white flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-[#2563EB]" /> Otomatik Güvenlik Politikası
            </div>
            <p className="leading-relaxed text-[11px]">
              • Kurumsal mesajlar platform içi tutulur.
              • E-posta, telefon ve dış bağlantı paylaşılamaz.
              • İhlaller durumunda hesabınıza TALKO uyarı bildirimi iletilir.
            </p>
          </div>

        </div>

      </div>

      {/* 🚫 FILTER BLOCKED WARNING MODAL */}
      {blockedWarningModalData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181B22] border border-red-500/40 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl relative animate-scale-up">
            
            <button 
              onClick={() => setBlockedWarningModalData(null)} 
              className="absolute right-4 top-4 p-2 text-[#9AA4B2] hover:text-white bg-[#0F1115] rounded-xl border border-[#23262F]"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 text-red-500">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
                <AlertOctagon size={28} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white leading-tight">
                  Bu mesaj platform güvenlik kurallarını ihlal ettiği için gönderilemedi.
                </h3>
                <span className="text-xs text-red-400 font-semibold">Talko Business Otomatik İçerik Filtresi</span>
              </div>
            </div>

            {/* Detected Reasons Box */}
            <div className="p-4 bg-[#0F1115] border border-red-500/30 rounded-2xl space-y-2">
              <div className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert size={14} /> Engelleme Nedenleri ({blockedWarningModalData.reasons.length}):
              </div>
              <ul className="space-y-1.5 text-xs text-gray-200 font-medium">
                {blockedWarningModalData.reasons.map((reason, i) => (
                  <li key={i} className="flex items-center gap-2 bg-red-500/10 p-2 rounded-xl border border-red-500/20 text-red-200">
                    <X size={14} className="text-red-400 shrink-0" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Blocked Content Preview */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-[#9AA4B2] uppercase tracking-wider">Denenen Mesaj İçeriği</span>
              <div className="p-3 bg-[#0F1115] border border-[#23262F] rounded-xl text-xs text-gray-400 font-mono italic max-h-24 overflow-y-auto">
                "{blockedWarningModalData.content}"
              </div>
            </div>

            {/* TALKO System Notification Alert */}
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xs text-blue-300 flex items-center gap-2.5">
              <MessageSquare size={20} className="text-blue-400 shrink-0" />
              <span>
                <strong>TALKO Bildirimi:</strong> Hesabınıza konuyla ilgili otomatik sistem bildirimi iletilmiştir.
              </span>
            </div>

            <button
              onClick={() => setBlockedWarningModalData(null)}
              className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-2xl transition-all shadow-lg shadow-red-600/30 uppercase tracking-wider"
            >
              Anladım ve Mesajı Düzenle
            </button>

          </div>
        </div>
      )}

    </div>
  );
};
