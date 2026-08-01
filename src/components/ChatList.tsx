import React, { useState, useEffect } from 'react';
import { Conversation, User, getDisplayName, isUserOnline, checkIsSpam, isBusinessAccountUser } from '../types';
import { DefaultAvatar } from './DefaultAvatar';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { Search, MessageSquare, Building2, AlertTriangle, Ban } from 'lucide-react';

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
  const [globalSearchResult, setGlobalSearchResult] = useState<User | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const isBusinessUser = isBusinessAccountUser(currentUser);

  useEffect(() => {
    if (!searchQuery.trim() || isBusinessUser) {
      setGlobalSearchResult(null);
      return;
    }

    const searchNum = formatSearchNumber(searchQuery);
    
    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const q = query(collection(db, 'users'), where('talkoNumber', '==', searchNum));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const foundUser = { id: snap.docs[0].id, ...snap.docs[0].data() } as User;
          if (
            foundUser.talkoNumber !== currentUser.talkoNumber &&
            !foundUser.isBusinessAccount &&
            !foundUser.isAlphanumericSender
          ) {
            setGlobalSearchResult(foundUser);
          } else {
            setGlobalSearchResult(null);
          }
        } else {
          setGlobalSearchResult(null);
        }
      } catch (err) {
        console.error("Search error", err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, currentUser.talkoNumber]);

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
      </div>

      {searchQuery.trim() && (
        <div className="px-3 pb-2 mb-2 border-b border-[#23262F]">
          <h4 className="text-xs font-bold text-[#9AA4B2] uppercase tracking-wider mb-2">Genel Arama Sonuçları</h4>
          
          {isSearching ? (
            <div className="p-3 text-center text-xs text-[#9AA4B2]">Aranıyor...</div>
          ) : globalSearchResult ? (
            <div 
              onClick={() => handleStartGlobalChat(globalSearchResult)}
              className="flex items-center gap-4 p-3 rounded-2xl bg-[#2563EB]/10 border border-[#2563EB]/20 hover:bg-[#2563EB]/20 transition-all cursor-pointer"
            >
              <DefaultAvatar 
                color={globalSearchResult.avatarColor}
                size="md"
                avatarUrl={globalSearchResult.avatarUrl}
                name={getDisplayName(globalSearchResult)}
                isAlphanumeric={globalSearchResult.isAlphanumericSender}
              />
              <div className="flex-1 min-w-0">
                <h3 className={`font-bold text-[14px] text-white ${!globalSearchResult.isAlphanumericSender ? 'font-mono' : ''}`}>
                  {getDisplayName(globalSearchResult)}
                </h3>
                <p className="text-xs font-mono text-[#2563EB] mt-0.5">{globalSearchResult.talkoNumber}</p>
              </div>
              <div className="px-3 py-1.5 bg-[#2563EB] text-white text-[10px] font-bold rounded-xl shadow-lg shadow-blue-500/20">
                Sohbet Başlat
              </div>
            </div>
          ) : (
            <div className="p-3 text-center text-xs text-[#9AA4B2]">Numarayla eşleşen kullanıcı bulunamadı. (Örn: 850 123 4567)</div>
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
                  isAlphanumeric={otherUser.isAlphanumericSender || otherUser.isBusinessAccount}
                  isSpam={activeFolder === 'spam' || isSpam(conv)}
                  isBlocked={activeFolder === 'blocked' || isBlocked(conv)}
                />
                {isUserOnline(otherUser) && !isSystem && (
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#181B22]"></div>
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h3 className={`font-bold text-[15px] truncate ${!otherUser.isAlphanumericSender && !isSystem && !otherUser.isBusinessAccount ? 'font-mono' : ''} ${hasUnread ? 'text-white' : 'text-gray-100'}`}>
                    {displayName}
                  </h3>
                  <span className={`text-xs ml-2 shrink-0 ${hasUnread ? 'text-red-500 font-bold' : 'text-[#9AA4B2]'}`}>
                    {conv.lastMessage ? new Date(conv.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                
                {/* Status or Alphanumeric Tag */}
                {(otherUser.isAlphanumericSender || otherUser.isBusinessAccount) && (
                  <div className="text-[10px] font-bold text-[#2563EB] uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Building2 size={10} /> Kurumsal Gönderici
                  </div>
                )}

                {activeFolder === 'spam' && (
                  <div className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <AlertTriangle size={10} /> Spam İletisi
                  </div>
                )}
                
                <div className="flex justify-between items-center gap-2">
                  {isTyping ? (
                    <p className="text-sm text-[#2563EB] font-semibold animate-pulse truncate">
                      Yazıyor...
                    </p>
                  ) : (
                    <p className={`text-sm truncate ${hasUnread ? 'text-white font-medium' : (isSystem ? 'text-[#2563EB] font-medium' : 'text-[#9AA4B2]')}`}>
                      {conv.lastMessage?.content ? conv.lastMessage.content.replace(/\n/g, ' ') : (isSystem ? 'Sistem Mesajı' : 'Sohbete başla...')}
                    </p>
                  )}

                  {hasUnread && (
                    <div className="min-w-[22px] h-[22px] px-1.5 bg-red-500 text-white text-[11px] font-black flex items-center justify-center rounded-full shrink-0 shadow-md shadow-red-500/40 animate-pulse">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </div>
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

