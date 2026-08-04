import React, { useState, useEffect } from 'react';
import { Conversation, User, getDisplayName, isUserOnline, checkIsSpam, isBusinessAccountUser } from '../types';
import { DefaultAvatar } from './DefaultAvatar';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { Search, MessageSquare, Building2, AlertTriangle, Ban, Users, UserPlus } from 'lucide-react';

interface ChatListProps {
  conversations: Conversation[];
  currentUser: User;
  searchQuery: string;
  onSelectConversation: (conv: Conversation) => void;
}

const formatSearchNumber = (query: string) => {
  let cleaned = query.replace(/\D/g, '');
  if (cleaned.startsWith('90') && cleaned.length > 2) cleaned = cleaned.slice(2);
  if (cleaned.length === 10) {
    return `+90 ${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return query; 
};

export const ChatList: React.FC<ChatListProps> = ({ 
  conversations, 
  currentUser, 
  searchQuery,
  onSelectConversation
}) => {
  const [activeFolder, setActiveFolder] = useState<'personal' | 'corporate' | 'spam' | 'blocked'>('personal');
  const [allRegisteredUsers, setAllRegisteredUsers] = useState<User[]>([]);
  const [showDirectory, setShowDirectory] = useState(false);

  const isBusinessUser = isBusinessAccountUser(currentUser);

  // Subscribe to all registered users in Firestore
  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList: User[] = [];
      snapshot.forEach(docSnap => {
        const u = { id: docSnap.id, ...docSnap.data() } as User;
        if (
          u.talkoNumber !== currentUser.talkoNumber &&
          !u.isSystemAccount &&
          u.talkoNumber !== 'TALKO' &&
          !u.isBanned
        ) {
          usersList.push(u);
        }
      });
      // Sort users by Talko number
      usersList.sort((a, b) => a.talkoNumber.localeCompare(b.talkoNumber));
      setAllRegisteredUsers(usersList);
    }, (err) => {
      console.error("Users listener error:", err);
    });
    return () => unsubscribe();
  }, [currentUser.talkoNumber]);

  const handleStartGlobalChat = async (user: User) => {
    if (isBusinessUser) return;
    const sortedParticipants = [currentUser.talkoNumber, user.talkoNumber].sort();
    const convId = `${sortedParticipants[0]}_${sortedParticipants[1]}`;

    const existing = conversations.find(c => c.id === convId || (c.participants.includes(user.talkoNumber) && c.participants.includes(currentUser.talkoNumber)));
    if (existing) {
      onSelectConversation(existing);
      return;
    }
    
    const convRef = doc(db, 'conversations', convId);
    const existingSnap = await getDoc(convRef);
    
    let newConv: Conversation;
    
    if (existingSnap.exists()) {
      newConv = { id: existingSnap.id, ...existingSnap.data() } as Conversation;
    } else {
      const altConvId = `${user.talkoNumber}_${currentUser.talkoNumber}`;
      const altSnap = await getDoc(doc(db, 'conversations', altConvId));
      if (altSnap.exists()) {
        newConv = { id: altSnap.id, ...altSnap.data() } as Conversation;
      } else {
        newConv = {
          id: convId,
          participants: [currentUser.talkoNumber, user.talkoNumber],
          participantUsers: [currentUser, user],
          unreadCount: { [currentUser.talkoNumber]: 0, [user.talkoNumber]: 0 },
          typingUsers: [],
          updatedAt: new Date().toISOString()
        };
        await setDoc(convRef, newConv);
      }
    }
    
    onSelectConversation(newConv);
  };

  // Categorization Functions
  const isProtectedAccount = (u: User) => 
    u.isSystemAccount || 
    u.talkoNumber === 'TALKO';

  const isBlocked = (c: Conversation) => {
    const otherUser = c.participantUsers.find(u => u.talkoNumber !== currentUser.talkoNumber) || c.participantUsers[0];
    if (isProtectedAccount(otherUser)) return false;
    const blockedSenders = currentUser.blockedSenders || [];
    const blockedConvs = currentUser.blockedConvs || [];
    return (
      blockedSenders.includes(otherUser.talkoNumber) ||
      blockedSenders.includes(otherUser.alphanumericName || '') ||
      blockedSenders.includes(otherUser.username) ||
      blockedConvs.includes(c.id)
    );
  };

  const isSpam = (c: Conversation) => {
    const otherUser = c.participantUsers.find(u => u.talkoNumber !== currentUser.talkoNumber) || c.participantUsers[0];
    if (isProtectedAccount(otherUser)) return false;
    if (isBlocked(c)) return false;
    if (currentUser.notSpamConvs?.includes(c.id)) return false;
    if (currentUser.spamConvs?.includes(c.id)) return true;
    
    const isSender = c.lastMessage?.senderNumber === currentUser.talkoNumber || c.lastMessage?.senderId === currentUser.id;
    if (isSender) return false;

    if (c.isSpam) return true;
    return checkIsSpam(c.lastMessage?.content);
  };

  const isCorporate = (c: Conversation) => {
    if (isBlocked(c) || isSpam(c)) return false;
    const otherUser = c.participantUsers.find(u => u.talkoNumber !== currentUser.talkoNumber) || c.participantUsers[0];
    return otherUser.isAlphanumericSender || otherUser.isBusinessAccount || c.isCorporate || false;
  };

  const isPersonal = (c: Conversation) => {
    return !isBlocked(c) && !isSpam(c) && !isCorporate(c);
  };

  // Filter conversations for each folder
  const personalList = conversations.filter(isPersonal);
  const corporateList = conversations.filter(isCorporate);
  const spamList = conversations.filter(isSpam);
  const blockedList = conversations.filter(isBlocked);

  // Calculate unread badge counts
  const personalUnread = personalList.reduce((acc, c) => acc + (c.unreadCount[currentUser.talkoNumber] || 0), 0);
  const corporateUnread = corporateList.reduce((acc, c) => acc + (c.unreadCount[currentUser.talkoNumber] || 0), 0);
  const spamUnread = spamList.reduce((acc, c) => acc + (c.unreadCount[currentUser.talkoNumber] || 0), 0);
  const blockedUnread = blockedList.reduce((acc, c) => acc + (c.unreadCount[currentUser.talkoNumber] || 0), 0);

  // Current folder list
  let folderList = personalList;
  if (activeFolder === 'corporate') folderList = corporateList;
  if (activeFolder === 'spam') folderList = spamList;
  if (activeFolder === 'blocked') folderList = blockedList;

  // Apply search filter if query entered
  const filtered = folderList.filter(c => {
    if (!searchQuery.trim()) return true;
    const qStr = searchQuery.toLowerCase();
    const formattedStr = formatSearchNumber(searchQuery);
    const otherUser = c.participantUsers.find(u => u.talkoNumber !== currentUser.talkoNumber);
    if (!otherUser) return false;
    const name = getDisplayName(otherUser).toLowerCase();
    if (name.includes(qStr) || otherUser.talkoNumber.includes(qStr) || otherUser.talkoNumber === formattedStr) return true;
    return false;
  });

  // Filter registered users for search/directory
  const searchClean = searchQuery.replace(/\D/g, '');
  const searchFormatted = formatSearchNumber(searchQuery);

  const matchedRegisteredUsers = allRegisteredUsers.filter(u => {
    if (!searchQuery.trim()) return true;
    const qStr = searchQuery.toLowerCase();
    const nameMatch = (u.username || '').toLowerCase().includes(qStr);
    const numMatch = u.talkoNumber.toLowerCase().includes(qStr);
    const numCleanMatch = searchClean ? u.talkoNumber.replace(/\D/g, '').includes(searchClean) : false;
    const exactMatch = u.talkoNumber === searchFormatted;
    return nameMatch || numMatch || numCleanMatch || exactMatch;
  });

  return (
    <div className="flex flex-col p-2 space-y-2">

      {/* 🏢 Business Mode Banner */}
      {isBusinessUser && (
        <div className="mx-1 my-1 p-3.5 bg-gradient-to-r from-blue-950/60 to-indigo-950/60 border border-blue-500/30 rounded-2xl flex flex-col items-center text-center gap-2 shadow-lg">
          <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
            <Building2 size={16} />
            <span>Kurumsal Gönderici Modu</span>
          </div>
          <p className="text-[11px] text-[#9AA4B2] leading-relaxed">
            Business hesapları yalnızca kurumsal gönderici olarak çalışır. Bireysel sohbet başlatamaz veya mesaj atamaz.
          </p>
          <button
            onClick={() => {
              window.history.pushState({}, '', '/business');
              window.dispatchEvent(new Event('popstate'));
            }}
            className="mt-0.5 px-4 py-2 bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5"
          >
            <Building2 size={14} />
            <span>Business Panel'ine Git</span>
          </button>
        </div>
      )}
      
      {/* 📁 Folder Selector Tabs */}
      <div className="flex items-center gap-1.5 px-1 py-1 overflow-x-auto no-scrollbar border-b border-[#23262F] pb-2.5 shrink-0">
        <button
          onClick={() => setActiveFolder('personal')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all shrink-0 ${activeFolder === 'personal' ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-500/20' : 'bg-[#181B22] text-[#9AA4B2] hover:bg-[#23262F] hover:text-white border border-[#23262F]'}`}
        >
          <MessageSquare size={13} />
          <span>Kişisel</span>
          {personalUnread > 0 && (
            <span className="ml-0.5 px-1.5 py-0.2 bg-red-500 text-white font-black text-[10px] rounded-full animate-pulse">
              {personalUnread}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveFolder('corporate')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all shrink-0 ${activeFolder === 'corporate' ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-500/20' : 'bg-[#181B22] text-[#9AA4B2] hover:bg-[#23262F] hover:text-white border border-[#23262F]'}`}
        >
          <Building2 size={13} />
          <span>Kurumsal</span>
          {corporateUnread > 0 && (
            <span className="ml-0.5 px-1.5 py-0.2 bg-red-500 text-white font-black text-[10px] rounded-full animate-pulse">
              {corporateUnread}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveFolder('spam')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all shrink-0 ${activeFolder === 'spam' ? 'bg-yellow-500 text-black font-black shadow-lg shadow-yellow-500/20' : 'bg-[#181B22] text-[#9AA4B2] hover:bg-[#23262F] hover:text-white border border-[#23262F]'}`}
        >
          <AlertTriangle size={13} />
          <span>Spam</span>
          {spamUnread > 0 && (
            <span className="ml-0.5 px-1.5 py-0.2 bg-red-500 text-white font-black text-[10px] rounded-full animate-pulse">
              {spamUnread}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveFolder('blocked')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all shrink-0 ${activeFolder === 'blocked' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-[#181B22] text-[#9AA4B2] hover:bg-[#23262F] hover:text-white border border-[#23262F]'}`}
        >
          <Ban size={13} />
          <span>Engellenenler</span>
          {blockedUnread > 0 && (
            <span className="ml-0.5 px-1.5 py-0.2 bg-white text-red-500 font-black text-[10px] rounded-full">
              {blockedUnread}
            </span>
          )}
        </button>

        {/* 👥 All Registered Numbers Quick Toggle Button */}
        <button
          onClick={() => setShowDirectory(!showDirectory)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all shrink-0 ${showDirectory ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-500/20' : 'bg-[#181B22] text-[#9AA4B2] hover:bg-[#23262F] hover:text-white border border-[#23262F]'}`}
          title="Tüm Kayıtlı Numaraları Sırala"
        >
          <Users size={13} />
          <span>Tüm Numaralar</span>
          <span className="ml-0.5 px-1.5 py-0.2 bg-blue-500/30 text-blue-300 font-mono text-[10px] rounded-full">
            {allRegisteredUsers.length}
          </span>
        </button>
      </div>

      {/* 🔍 Registered Numbers & Search Directory */}
      {(searchQuery.trim() || showDirectory) && (
        <div className="px-3 py-3 mb-2 bg-[#181B22]/90 rounded-2xl border border-[#23262F] shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-[#2563EB]" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Sıralı Kayıtlı Numaralar ({matchedRegisteredUsers.length})
              </h4>
            </div>
            {!searchQuery.trim() && (
              <button 
                onClick={() => setShowDirectory(false)}
                className="text-[11px] text-[#9AA4B2] hover:text-white px-2 py-0.5 rounded-lg bg-[#23262F] font-semibold"
              >
                Kapat
              </button>
            )}
          </div>

          {matchedRegisteredUsers.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#9AA4B2] font-medium">
              Aramayla eşleşen kayıtlı numara veya kişi bulunamadı.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar pr-1">
              {matchedRegisteredUsers.map(u => {
                const online = isUserOnline(u);
                return (
                  <div 
                    key={u.id || u.talkoNumber}
                    onClick={() => handleStartGlobalChat(u)}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-[#0F1115] border border-[#23262F] hover:border-[#2563EB]/50 hover:bg-[#2563EB]/10 transition-all cursor-pointer group"
                  >
                    <div className="relative">
                      <DefaultAvatar 
                        color={u.avatarColor}
                        size="md"
                        avatarUrl={u.avatarUrl}
                        name={getDisplayName(u)}
                        talkoNumber={u.talkoNumber}
                        isAlphanumeric={u.isAlphanumericSender || u.isBusinessAccount}
                      />
                      {online && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#0F1115] rounded-full"></span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-xs text-white truncate">
                          {getDisplayName(u)}
                        </h3>
                        {online && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 font-semibold rounded-full">
                            çevrimiçi
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-[#2563EB] mt-0.5 font-bold">
                        {u.talkoNumber}
                      </p>
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartGlobalChat(u);
                      }}
                      className="px-3 py-1.5 bg-[#2563EB] hover:bg-blue-600 text-white text-[10px] font-bold rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-1 shrink-0 transition-all"
                    >
                      <UserPlus size={12} />
                      <span>Sohbet Et</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="p-8 text-center text-[#9AA4B2] text-xs font-medium space-y-1">
          {activeFolder === 'personal' && <div>Henüz kişisel sohbet bulunmuyor.</div>}
          {activeFolder === 'corporate' && <div>Henüz kurumsal mesajınız bulunmuyor.</div>}
          {activeFolder === 'spam' && <div>Spam klasörünüz boş.</div>}
          {activeFolder === 'blocked' && <div>Engellenmiş bir gönderici bulunmuyor.</div>}
        </div>
      ) : (
        filtered.map(conv => {
          const otherUser = conv.participantUsers.find(
            u => u.talkoNumber !== currentUser.talkoNumber
          ) || conv.participantUsers[0];
          
          const isSystem = otherUser.isSystemAccount || otherUser.talkoNumber === 'TALKO';
          const displayName = getDisplayName(otherUser);
          const unreadCount = conv.unreadCount[currentUser.talkoNumber] || 0;
          const hasUnread = unreadCount > 0;
          const isTyping = !isSystem && conv.typingUsers?.includes(otherUser.talkoNumber);

          return (
            <div 
              key={conv.id}
              onClick={() => onSelectConversation(conv)}
              className="flex items-center gap-4 p-3 rounded-2xl hover:bg-[#23262F] transition-all cursor-pointer group active:scale-[0.98]"
            >
              <div className="relative">
                <DefaultAvatar 
                  color={otherUser.avatarColor}
                  size="lg"
                  avatarUrl={otherUser.avatarUrl}
                  name={displayName}
                  talkoNumber={otherUser.talkoNumber}
                  isAlphanumeric={otherUser.isAlphanumericSender || otherUser.isBusinessAccount}
                />
                {!isSystem && isUserOnline(otherUser) && (
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#181B22] rounded-full"></span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className={`font-bold text-sm text-white truncate group-hover:text-blue-400 transition-colors ${!otherUser.isAlphanumericSender && !otherUser.isBusinessAccount ? 'font-mono' : ''}`}>
                    {displayName}
                  </h3>
                  {conv.lastMessage && (
                    <span className="text-[10px] text-[#9AA4B2] font-mono shrink-0">
                      {new Date(conv.lastMessage.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-[#9AA4B2] truncate leading-tight">
                    {isTyping ? (
                      <span className="text-blue-400 font-semibold animate-pulse">yazıyor...</span>
                    ) : conv.lastMessage ? (
                      conv.lastMessage.content
                    ) : (
                      <span className="italic opacity-60">Sohbet başlatıldı</span>
                    )}
                  </p>

                  {hasUnread && (
                    <span className="min-w-[20px] h-5 px-1.5 bg-blue-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shrink-0 shadow-md shadow-blue-500/30">
                      {unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
