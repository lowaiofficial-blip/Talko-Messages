import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db, auth } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, setDoc, getDocs } from 'firebase/firestore';
import { Conversation, Message, User, AvatarColor, getDisplayName, isUserOnline, checkIsSpam } from '../types';
import { Header } from './Header';
import { ChatList } from './ChatList';
import { ChatView } from './ChatView';
import { SettingsView } from './SettingsView';
import { BottomNav } from './BottomNav';
import { AdminPanel } from './AdminPanel';
import { BusinessPanel } from './BusinessPanel';
import { ProfileCardModal } from './ProfileCardModal';
import { QRCodeModal } from './QRCodeModal';
import { AlphanumericModal } from './AlphanumericModal';
import { soundManager } from '../lib/audio';
import { MessageSquare, QrCode, ShieldCheck, User as UserIcon, Settings, Building2, Lock } from 'lucide-react';
import { DefaultAvatar } from './DefaultAvatar';

export const MainApp: React.FC = () => {
  const { talkoUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'chats' | 'settings'>('chats');
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isAdminView, setIsAdminView] = useState(false);
  const [isBusinessView, setIsBusinessView] = useState(false);
  
  const [inspectUser, setInspectUser] = useState<User | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAlphaModal, setShowAlphaModal] = useState(false);
  
  // QR Code Modal State
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrTargetUser, setQrTargetUser] = useState<User | null>(null);

  const handleOpenQR = (u: User) => {
    setQrTargetUser(u);
    setShowQRModal(true);
  };

  // Ref to track last notified message timestamp per conversation
  const lastNotifiedRef = React.useRef<Record<string, string>>({});

  // System migration and TALKO welcome chat for existing users
  useEffect(() => {
    const migrateAndCheckTalko = async () => {
      if (!auth.currentUser || !talkoUser) return;
      
      let needsUpdate = false;
      let updates: any = {};
      
      // Check avatar color (default once if missing)
      const validColors: AvatarColor[] = ['blue', 'yellow', 'purple', 'green', 'orange', 'pink'];
      if (!talkoUser.avatarColor || !validColors.includes(talkoUser.avatarColor)) {
        updates.avatarColor = validColors[Math.floor(Math.random() * validColors.length)];
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await setDoc(doc(db, 'users', talkoUser.id), updates, { merge: true });
        
        // Also update existing conversations to ensure the avatar is synced
        const allConvQ = query(collection(db, 'conversations'), where('participants', 'array-contains', talkoUser.talkoNumber));
        const allConvSnap = await getDocs(allConvQ);
        const updatePromises = allConvSnap.docs.map(async (convDoc) => {
          const data = convDoc.data();
          const updatedUsers = (data.participantUsers || []).map((u: any) => 
            u.id === talkoUser.id ? { ...u, ...updates } : u
          );
          return setDoc(doc(db, 'conversations', convDoc.id), { participantUsers: updatedUsers }, { merge: true });
        });
        await Promise.all(updatePromises);
      }

      // Check if Talko system conversation exists once with getDocs
      const convQ = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', talkoUser.talkoNumber)
      );
      
      const convSnap = await getDocs(convQ);
      let hasTalkoConv = false;
      convSnap.forEach(d => {
        const parts = d.data().participants as string[];
        if (parts && parts.includes('TALKO')) hasTalkoConv = true;
      });
      
      if (!hasTalkoConv) {
        // Create Talko system welcome conversation with deterministic ID
        const sortedParticipants = ['TALKO', talkoUser.talkoNumber].sort();
        const convId = `${sortedParticipants[0]}_${sortedParticipants[1]}`;
        const convRef = doc(db, 'conversations', convId);
        
        const welcomeContent = `👋 Hoş geldiniz!\n\nTalko Messages hesabınız başarıyla oluşturuldu.\n\n📱 Talko Numaranız:\n\n${talkoUser.talkoNumber}\n\nArtık Talko numaranız ile güvenli şekilde mesajlaşabilirsiniz.\n\nİyi sohbetler dileriz. 💙`;
        const ts = new Date().toISOString();
        
        await setDoc(convRef, {
          participants: ['TALKO', talkoUser.talkoNumber],
          participantUsers: [
            {
              id: 'system_talko',
              talkoNumber: 'TALKO',
              username: 'TALKO',
              avatarColor: 'blue',
              isOnline: false,
              lastSeen: ts,
              isBanned: false,
              isSystemAccount: true
            },
            {
              id: talkoUser.id,
              talkoNumber: talkoUser.talkoNumber,
              username: talkoUser.username,
              avatarColor: updates.avatarColor || talkoUser.avatarColor,
              isOnline: true,
              lastSeen: ts,
              isBanned: false
            }
          ],
          unreadCount: { [talkoUser.talkoNumber]: 1, 'TALKO': 0 },
          typingUsers: [],
          lastMessage: {
            content: welcomeContent,
            senderNumber: 'TALKO',
            timestamp: ts,
            status: 'sent',
            isSystem: true
          },
          updatedAt: ts
        });

        const msgRef = doc(collection(db, 'conversations', convId, 'messages'));
        
        await setDoc(msgRef, {
          id: msgRef.id,
          conversationId: convId,
          senderId: 'system_talko',
          senderNumber: 'TALKO',
          senderName: 'TALKO',
          senderAvatarColor: 'blue',
          content: welcomeContent,
          timestamp: ts,
          status: 'sent',
          isSystem: true
        });
      }
    };
    
    migrateAndCheckTalko();
  }, [talkoUser?.id]);

  // Load TALKO system account safely
  useEffect(() => {
    const initTalkoSystem = async () => {
      if (!auth.currentUser) return;
      try {
        const talkoRef = doc(db, 'users', 'system_talko');
        const talkoSnap = await getDoc(talkoRef);
        if (!talkoSnap.exists()) {
          await setDoc(talkoRef, {
            id: 'system_talko',
            talkoNumber: 'TALKO',
            username: 'TALKO',
            avatarColor: 'blue',
            isOnline: false,
            lastSeen: new Date().toISOString(),
            isBanned: false,
            isSystemAccount: true
          });
        }
      } catch (e) {
        console.error("Error initializing talko system account:", e);
      }
    };
    initTalkoSystem();
  }, [talkoUser?.id]);

  // Real-time presence & user data listener for live synchronization across all devices
  const [liveUsersMap, setLiveUsersMap] = useState<Record<string, User>>({});

  useEffect(() => {
    if (!talkoUser) return;
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userMap: Record<string, User> = {};
      snapshot.forEach(docSnap => {
        const uData = { id: docSnap.id, ...docSnap.data() } as User;
        userMap[uData.talkoNumber] = uData;
      });
      setLiveUsersMap(userMap);
    }, (err) => {
      console.error('Users presence snapshot error:', err);
    });
    return unsubscribe;
  }, [talkoUser?.id]);

  // Presence management
  useEffect(() => {
    if (!talkoUser) return;
    
    const userRef = doc(db, 'users', talkoUser.id);
    const shouldBeOnline = talkoUser.settings?.onlineStatus !== false;

    const setPresenceState = (online: boolean) => {
      if (!auth.currentUser) return;
      setDoc(userRef, { 
        isOnline: online, 
        lastSeen: new Date().toISOString() 
      }, { merge: true }).catch(() => {});
    };
    
    setPresenceState(shouldBeOnline);
    
    const heartbeatInterval = setInterval(() => {
      if (document.visibilityState === 'visible' && shouldBeOnline) {
        setPresenceState(true);
      }
    }, 45000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setPresenceState(false);
      } else {
        setPresenceState(shouldBeOnline);
      }
    };

    const handleOnline = () => setPresenceState(shouldBeOnline);
    const handleOffline = () => setPresenceState(false);
    
    const handleUnload = () => {
      setPresenceState(false);
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    
    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      setPresenceState(false);
    };
  }, [talkoUser?.id, talkoUser?.settings?.onlineStatus]);

  // Persist active conversation selection to localStorage
  useEffect(() => {
    if (activeConversation && talkoUser?.talkoNumber) {
      localStorage.setItem(`talko_active_conv_${talkoUser.talkoNumber}`, activeConversation.id);
    }
  }, [activeConversation?.id, talkoUser?.talkoNumber]);

  // Request notification permission on load
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Subscribe to conversations
  useEffect(() => {
    if (!talkoUser) return;
    
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', talkoUser.talkoNumber)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rawConvs: Conversation[] = [];
      snapshot.forEach(docSnap => {
        rawConvs.push({ id: docSnap.id, ...docSnap.data() } as Conversation);
      });
      
      const convsMap = new Map<string, Conversation>();
      rawConvs.forEach(conv => {
        const isTwoPerson = conv.participants && conv.participants.length === 2;
        const canonicalKey = isTwoPerson ? conv.participants.slice().sort().join('_') : conv.id;
        const existing = convsMap.get(canonicalKey);
        
        if (!existing) {
          convsMap.set(canonicalKey, conv);
        } else {
          const timeExisting = existing.lastMessage?.timestamp || existing.updatedAt || '';
          const timeCurrent = conv.lastMessage?.timestamp || conv.updatedAt || '';
          if (new Date(timeCurrent).getTime() >= new Date(timeExisting).getTime()) {
            convsMap.set(canonicalKey, conv);
          }
        }
      });

      const convs = Array.from(convsMap.values());

      convs.sort((a, b) => {
        const timeA = a.lastMessage?.timestamp || a.updatedAt || 0;
        const timeB = b.lastMessage?.timestamp || b.updatedAt || 0;
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      });

      convs.forEach(conv => {
        const lastMsg = conv.lastMessage;
        if (!lastMsg || lastMsg.senderNumber === talkoUser.talkoNumber) return;
        
        const prevTs = lastNotifiedRef.current[conv.id];
        const currentTs = lastMsg.timestamp;
        
        const otherUser = conv.participantUsers.find(u => u.talkoNumber !== talkoUser.talkoNumber) || conv.participantUsers[0];
        const isProtected = otherUser.isSystemAccount || otherUser.talkoNumber === 'TALKO';
        const isBlocked = !isProtected && (
          (talkoUser.blockedSenders || []).includes(otherUser.talkoNumber) ||
          (talkoUser.blockedSenders || []).includes(otherUser.alphanumericName || '') ||
          (talkoUser.blockedSenders || []).includes(otherUser.username) ||
          (talkoUser.blockedConvs || []).includes(conv.id)
        );
        const isNotSpamManually = (talkoUser.notSpamConvs || []).includes(conv.id);
        const isSpam = !isProtected && !isBlocked && !isNotSpamManually && (
          (talkoUser.spamConvs || []).includes(conv.id) ||
          conv.isSpam ||
          lastMsg.isSpam ||
          checkIsSpam(lastMsg.content)
        );

        // 🔔 Strictly NO sound, NO desktop notifications for SPAM or BLOCKED conversations
        if (isSpam || isBlocked) {
          lastNotifiedRef.current[conv.id] = currentTs;
          return;
        }

        if (prevTs && currentTs > prevTs) {
          if (activeConversation?.id !== conv.id || document.visibilityState === 'hidden') {
            if (activeConversation?.id !== conv.id && soundManager.isSoundEnabled()) {
              soundManager.playReceiveSound();
            }

            if ('Notification' in window && Notification.permission === 'granted') {
              const notification = new Notification('Talko Messages', {
                body: lastMsg.isSystem ? 'Sistem Mesajı' : `${lastMsg.senderName || 'Talko'}: ${lastMsg.content.replace(/\n/g, ' ')}`,
                icon: '/favicon.ico'
              });
              
              notification.onclick = () => {
                window.focus();
                setActiveConversation(conv);
                setActiveTab('chats');
                notification.close();
              };
            }
          }
        }
        lastNotifiedRef.current[conv.id] = currentTs;
      });
      
      setConversations(convs);
      
      setActiveConversation(prev => {
        const savedConvId = localStorage.getItem(`talko_active_conv_${talkoUser.talkoNumber}`);
        const targetId = prev?.id || savedConvId;
        
        if (!targetId) return prev;

        let updated = convs.find(c => c.id === targetId);
        if (!updated && prev) {
          const prevKey = prev.participants.slice().sort().join('_');
          updated = convs.find(c => c.participants.slice().sort().join('_') === prevKey);
        }
        
        if (updated) {
          if (JSON.stringify(updated) !== JSON.stringify(prev)) {
            return updated;
          }
          return prev;
        }
        return prev;
      });
    }, (error) => {
      console.error("Conversations listener error:", error);
    });

    return unsubscribe;
  }, [talkoUser?.talkoNumber, activeConversation?.id]);

  // Enrich conversations
  const enrichedConversations = conversations.map(c => ({
    ...c,
    participantUsers: c.participantUsers.map(u => {
      const live = liveUsersMap[u.talkoNumber] ? { ...u, ...liveUsersMap[u.talkoNumber] } : u;
      return {
        ...live,
        isOnline: isUserOnline(live)
      };
    })
  }));

  const enrichedActiveConversation = activeConversation ? {
    ...activeConversation,
    participantUsers: activeConversation.participantUsers.map(u => {
      const live = liveUsersMap[u.talkoNumber] ? { ...u, ...liveUsersMap[u.talkoNumber] } : u;
      return {
        ...live,
        isOnline: isUserOnline(live)
      };
    })
  } : null;

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount[talkoUser?.talkoNumber || ''] || 0), 0);

  // Subscribe to messages
  useEffect(() => {
    if (!activeConversation || !talkoUser) return;
    
    setMessages([]);

    if ((activeConversation.unreadCount[talkoUser.talkoNumber] || 0) > 0) {
      const convRef = doc(db, 'conversations', activeConversation.id);
      setDoc(convRef, { 
        [`unreadCount.${talkoUser.talkoNumber}`]: 0 
      }, { merge: true });
    }
    
    const q = query(
      collection(db, 'conversations', activeConversation.id, 'messages'),
      orderBy('timestamp', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMsgs: Message[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));

      allMsgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const msg = change.doc.data() as Message;
          if (msg.senderNumber !== talkoUser.talkoNumber && soundManager.isSoundEnabled()) {
             soundManager.playReceiveSound();
          }
        }
      });

      setMessages(allMsgs);
    }, (error) => {
      console.error("Messages listener error:", error);
    });
    
    return unsubscribe;
  }, [activeConversation?.id, talkoUser?.talkoNumber]);

  // Document Title & App Badge update
  useEffect(() => {
    if (!talkoUser) return;
    if (totalUnread > 0) {
      document.title = `🔴 ${totalUnread} Yeni Mesaj - Talko`;
      if ('setAppBadge' in navigator) {
        navigator.setAppBadge(totalUnread).catch(() => {});
      }
    } else {
      document.title = 'Talko Messages';
      if ('clearAppBadge' in navigator) {
        navigator.clearAppBadge().catch(() => {});
      }
    }
  }, [totalUnread, talkoUser]);

  // Dedicated URL-based Admin panel & Business panel routing (/admin and /business)
  useEffect(() => {
    const checkRoutes = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path === '/admin' || path.startsWith('/admin') || hash === '#/admin' || hash === '#admin' || hash.includes('secret-admin-talko')) {
        setIsAdminView(true);
        setIsBusinessView(false);
      } else if (path === '/business' || path.startsWith('/business') || hash === '#/business' || hash === '#business') {
        setIsBusinessView(true);
        setIsAdminView(false);
      } else {
        setIsAdminView(false);
        setIsBusinessView(false);
      }
    };
    
    checkRoutes();
    window.addEventListener('popstate', checkRoutes);
    window.addEventListener('hashchange', checkRoutes);
    return () => {
      window.removeEventListener('popstate', checkRoutes);
      window.removeEventListener('hashchange', checkRoutes);
    };
  }, []);

  if (!talkoUser) return null;

  // Render Admin View
  if (isAdminView) {
    return (
      <AdminPanel 
        onBackToApp={() => {
          if (window.location.hash) window.location.hash = '';
          if (window.location.pathname.startsWith('/admin')) window.history.pushState({}, '', '/');
          setIsAdminView(false);
        }}
        onOpenProfile={(u) => {
          setInspectUser(u);
          setShowProfileModal(true);
        }}
      />
    );
  }

  // Render Business View
  if (isBusinessView) {
    const isApprovedBusiness = 
      talkoUser.isBusinessAccount || 
      talkoUser.isAlphanumericSender || 
      talkoUser.isAdmin || 
      talkoUser.email?.toLowerCase() === 'devy.build.backup@gmail.com' ||
      talkoUser.email?.toLowerCase() === 'lowai.official@gmail.com';

    if (!isApprovedBusiness) {
      return (
        <div className="fixed inset-0 bg-[#0F1115] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-3xl border border-red-500/20 flex items-center justify-center mb-6 shadow-2xl">
            <Lock size={36} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Yetkisiz Erişim</h1>
          <p className="text-sm text-[#9AA4B2] max-w-md mt-2 leading-relaxed">
            Talko Business paneline yalnızca onaylı kurumsal hesaplar erişebilir. Lütfen kurumsal hesabınızla giriş yapınız.
          </p>
          <button
            onClick={() => {
              if (window.location.hash) window.location.hash = '';
              if (window.location.pathname.startsWith('/business')) window.history.pushState({}, '', '/');
              setIsBusinessView(false);
            }}
            className="mt-6 px-6 py-3.5 bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs rounded-2xl transition-all shadow-lg shadow-blue-500/20"
          >
            Sohbetlere Dön
          </button>
        </div>
      );
    }

    return (
      <BusinessPanel 
        currentUser={talkoUser}
        onClose={() => {
          if (window.location.hash) window.location.hash = '';
          if (window.location.pathname.startsWith('/business')) window.history.pushState({}, '', '/');
          setIsBusinessView(false);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#0F1115] text-white font-sans overflow-hidden">
      
      {/* MOBILE LAYOUT (< md) */}
      <div className="flex flex-col h-full md:hidden">
        {!activeConversation && (
          <Header 
            currentUser={talkoUser}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onOpenMyProfile={() => {
              setInspectUser(talkoUser);
              setShowProfileModal(true);
            }}
          />
        )}

        <main className="flex-1 overflow-hidden relative w-full flex bg-[#181B22] shadow-2xl border-t border-[#23262F]">
          {activeConversation ? (
            <ChatView 
              conversation={enrichedActiveConversation || activeConversation}
              messages={messages}
              currentUser={talkoUser}
              onBack={() => {
                setActiveConversation(null);
                setMessages([]);
              }}
              onOpenProfile={(u) => {
                setInspectUser(u);
                setShowProfileModal(true);
              }}
            />
          ) : (
            <div className="w-full h-full overflow-y-auto no-scrollbar pb-16">
              {activeTab === 'chats' && (
                <ChatList 
                  conversations={enrichedConversations}
                  currentUser={talkoUser}
                  searchQuery={searchQuery}
                  onSelectConversation={setActiveConversation}
                />
              )}
              
              {activeTab === 'settings' && (
                <SettingsView 
                  currentUser={talkoUser}
                  onOpenAlphanumeric={() => setShowAlphaModal(true)}
                  onOpenQR={() => handleOpenQR(talkoUser)}
                />
              )}
            </div>
          )}
        </main>

        {!activeConversation && (
          <BottomNav 
            activeTab={activeTab}
            onTabChange={setActiveTab}
            unreadCount={totalUnread}
          />
        )}
      </div>

      {/* TABLET & DESKTOP MULTI-PANE LAYOUT (>= md) */}
      <div className="hidden md:flex w-full h-full mx-auto overflow-hidden bg-[#0F1115]">
        
        {/* Desktop Left Rail Navigation */}
        <nav className="w-20 lg:w-24 bg-[#181B22] border-r border-[#23262F] shrink-0 flex flex-col items-center py-8 gap-8">
          <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 cursor-pointer">
            <span className="text-2xl font-black text-white">T</span>
          </div>
          
          <div className="flex flex-col gap-4 mt-4 w-full">
            <button
              onClick={() => setActiveTab('chats')}
              className={`w-full flex justify-center py-4 relative group`}
            >
              <div className={`p-3 rounded-2xl transition-all relative ${activeTab === 'chats' ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-500/30' : 'text-[#9AA4B2] hover:bg-[#23262F] hover:text-white'}`}>
                <MessageSquare size={24} />
                {totalUnread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg shadow-red-500/50 animate-pulse">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </div>
            </button>
            
            {(talkoUser.isBusinessAccount || talkoUser.isAlphanumericSender || talkoUser.isAdmin || talkoUser.email?.toLowerCase() === 'devy.build.backup@gmail.com' || talkoUser.email?.toLowerCase() === 'lowai.official@gmail.com') && (
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/business');
                  setIsBusinessView(true);
                }}
                title="Talko Business Panel"
                className={`w-full flex justify-center py-4 relative group`}
              >
                <div className={`p-3 rounded-2xl transition-all text-[#2563EB] bg-[#2563EB]/10 hover:bg-[#2563EB]/20 border border-[#2563EB]/30`}>
                  <Building2 size={24} />
                </div>
              </button>
            )}

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex justify-center py-4 relative group`}
            >
              <div className={`p-3 rounded-2xl transition-all ${activeTab === 'settings' ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-500/30' : 'text-[#9AA4B2] hover:bg-[#23262F] hover:text-white'}`}>
                <Settings size={24} />
              </div>
            </button>
          </div>
        </nav>

        {/* Sidebar Pane */}
        <aside className="w-80 lg:w-[400px] flex flex-col h-full bg-[#181B22] border-r border-[#23262F] shrink-0 shadow-xl">
          <Header 
            currentUser={talkoUser}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onOpenMyProfile={() => {
              setInspectUser(talkoUser);
              setShowProfileModal(true);
            }}
          />

          <div className="flex-1 overflow-y-auto no-scrollbar">
            {activeTab === 'chats' && (
              <ChatList 
                conversations={enrichedConversations}
                currentUser={talkoUser}
                searchQuery={searchQuery}
                onSelectConversation={setActiveConversation}
              />
            )}
            
            {activeTab === 'settings' && (
              <SettingsView 
                currentUser={talkoUser}
                onOpenAlphanumeric={() => setShowAlphaModal(true)}
                onOpenQR={() => handleOpenQR(talkoUser)}
              />
            )}
          </div>
        </aside>

        {/* Center Active Chat Area */}
        <section className="flex-1 h-full bg-[#0F1115] relative overflow-hidden flex flex-col">
          {activeConversation ? (
            <ChatView 
              conversation={enrichedActiveConversation || activeConversation}
              messages={messages}
              currentUser={talkoUser}
              onBack={() => {
                setActiveConversation(null);
                setMessages([]);
              }}
              onOpenProfile={(u) => {
                setInspectUser(u);
                setShowProfileModal(true);
              }}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0F1115] border-l border-[#23262F]">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-[#2563EB] to-[#1D4ED8] flex items-center justify-center shadow-2xl shadow-blue-500/20 mb-6 border border-blue-400/20">
                <span className="text-5xl font-black text-white tracking-tighter">T</span>
              </div>
              
              <h2 className="text-2xl font-bold text-white tracking-tight">Talko Messages Web</h2>
              <p className="text-sm text-[#9AA4B2] max-w-sm mt-2 leading-relaxed">
                Sohbet başlatmak için soldaki listeden bir konuşma seçin veya arama çubuğundan kişi arayın.
              </p>

              <div className="mt-8 flex items-center gap-4">
                <button 
                  onClick={() => handleOpenQR(talkoUser)}
                  className="px-5 py-3 bg-[#181B22] hover:bg-[#23262F] text-white text-xs font-bold rounded-2xl border border-[#23262F] flex items-center gap-2 transition-all shadow-md"
                >
                  <QrCode size={16} className="text-[#2563EB]" />
                  QR Kodumu Göster
                </button>
                <button 
                  onClick={() => {
                    setInspectUser(talkoUser);
                    setShowProfileModal(true);
                  }}
                  className="px-5 py-3 bg-[#2563EB] hover:bg-blue-600 text-white text-xs font-bold rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                >
                  <DefaultAvatar color={talkoUser.avatarColor} size="sm" name={talkoUser.talkoNumber} />
                  Profilim
                </button>
              </div>

              <div className="mt-12 flex items-center gap-2 text-xs text-[#9AA4B2] font-mono bg-[#181B22] px-4 py-2 rounded-full border border-[#23262F]">
                <ShieldCheck size={14} className="text-green-400" />
                Uçtan Uca Şifreli Güvenli İletişim
              </div>
            </div>
          )}
        </section>

        {/* Right Info Pane (PC xl Desktop View) */}
        {activeConversation && (
          <aside className="hidden xl:flex w-80 lg:w-88 h-full bg-[#181B22] border-l border-[#23262F] flex-col p-6 overflow-y-auto shrink-0">
            {(() => {
              const other = activeConversation.participantUsers.find(u => u.talkoNumber !== talkoUser.talkoNumber) || activeConversation.participantUsers[0];
              const isSystem = other.isSystemAccount || other.talkoNumber === 'TALKO';
              const displayName = getDisplayName(other);

              return (
                <div className="flex flex-col items-center text-center">
                  <div className="mt-4 mb-3">
                    <DefaultAvatar 
                      color={other.avatarColor}
                      size="xl"
                      avatarUrl={other.avatarUrl}
                      name={displayName}
                      className="border-4 border-[#181B22] shadow-xl"
                      isAlphanumeric={other.isAlphanumericSender || other.isBusinessAccount}
                    />
                  </div>

                  <h3 className={`text-lg font-bold text-white tracking-tight ${!other.isAlphanumericSender && !other.isBusinessAccount && !isSystem ? 'font-mono' : ''}`}>{displayName}</h3>
                  <div className="mt-1">
                    {isSystem ? (
                      <span className="text-xs font-bold text-[#2563EB] bg-[#2563EB]/10 px-3 py-1 rounded-full border border-[#2563EB]/20">
                        Resmi Sistem Hesabı
                      </span>
                    ) : (
                      <div className="text-xs text-[#9AA4B2] flex items-center gap-1.5 justify-center">
                        <span className={`w-2 h-2 rounded-full ${isUserOnline(other) ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                        <span>{isUserOnline(other) ? 'Çevrimiçi' : 'Çevrimdışı'}</span>
                      </div>
                    )}
                  </div>

                  <div className="w-full mt-6 p-4 bg-[#0F1115] rounded-2xl border border-[#23262F] flex flex-col items-center gap-1">
                    <span className="text-[11px] font-bold text-[#9AA4B2] uppercase tracking-wider">Talko Numarası</span>
                    <span className="text-sm font-mono text-[#2563EB] font-bold">{other.talkoNumber}</span>
                  </div>

                  <div className="w-full mt-4 flex gap-2">
                    <button
                      onClick={() => handleOpenQR(other)}
                      className="flex-1 py-3 bg-[#0F1115] hover:bg-[#23262F] text-white text-xs font-bold rounded-2xl border border-[#23262F] flex items-center justify-center gap-2 transition-colors"
                    >
                      <QrCode size={16} className="text-[#2563EB]" />
                      QR Kod
                    </button>
                    <button
                      onClick={() => {
                        setInspectUser(other);
                        setShowProfileModal(true);
                      }}
                      className="flex-1 py-3 bg-[#2563EB] hover:bg-blue-600 text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
                    >
                      <UserIcon size={16} />
                      Profil
                    </button>
                  </div>

                  <div className="w-full mt-8 p-4 bg-[#0F1115] rounded-2xl border border-[#23262F] text-left">
                    <div className="flex items-center gap-2 text-xs font-bold text-white mb-2">
                      <ShieldCheck size={16} className="text-green-400" />
                      Güvenlik & Gizlilik
                    </div>
                    <p className="text-xs text-[#9AA4B2] leading-relaxed">
                      Bu sohbet Talko şifreleme altyapısı ile korunmaktadır. Gönderilen mesajlar sadece katılımcılar tarafından okunabilir.
                    </p>
                  </div>
                </div>
              );
            })()}
          </aside>
        )}
      </div>

      {/* Modals */}
      <ProfileCardModal 
        user={inspectUser}
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        currentUser={talkoUser}
        onStartChat={(conv) => {
          setShowProfileModal(false);
          setActiveConversation(conv);
          setActiveTab('chats');
        }}
        onOpenQR={(u) => handleOpenQR(u)}
      />

      <QRCodeModal
        user={qrTargetUser}
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
      />

      <AlphanumericModal 
        isOpen={showAlphaModal}
        onClose={() => setShowAlphaModal(false)}
        currentUser={talkoUser}
      />
    </div>
  );
};


