import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Image as ImageIcon, Check, CheckCheck, AlertTriangle, Ban, ShieldCheck, MoreVertical, CheckCircle2, Building2 } from 'lucide-react';
import { Conversation, Message, User, getDisplayName, isUserOnline, checkIsSpam, isBusinessAccountUser } from '../types';
import { DefaultAvatar } from './DefaultAvatar';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import { soundManager } from '../lib/audio';
import { format } from 'date-fns';

interface ChatViewProps {
  conversation: Conversation;
  messages: Message[];
  currentUser: User;
  onBack: () => void;
  onOpenProfile: (u: User) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ conversation, messages, currentUser, onBack, onOpenProfile }) => {
  const [inputText, setInputText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const otherUser = conversation.participantUsers.find(u => u.talkoNumber !== currentUser.talkoNumber) || conversation.participantUsers[0];
  const otherDisplayName = getDisplayName(otherUser);

  const isProtectedAccount = 
    otherUser.isSystemAccount || 
    otherUser.talkoNumber === 'TALKO';

  // Check if sender is blocked or conversation is in spam
  const isBlocked = !isProtectedAccount && (
    (currentUser.blockedSenders || []).includes(otherUser.talkoNumber) ||
    (currentUser.blockedSenders || []).includes(otherUser.alphanumericName || '') ||
    (currentUser.blockedSenders || []).includes(otherUser.username) ||
    (currentUser.blockedConvs || []).includes(conversation.id)
  );

  const isNotSpamManually = (currentUser.notSpamConvs || []).includes(conversation.id);
  const isSenderOfLastMessage = conversation.lastMessage?.senderNumber === currentUser.talkoNumber || conversation.lastMessage?.senderId === currentUser.id;
  const isSpam = !isProtectedAccount && !isBlocked && !isNotSpamManually && !isSenderOfLastMessage && (
    (currentUser.spamConvs || []).includes(conversation.id) ||
    conversation.isSpam ||
    checkIsSpam(conversation.lastMessage?.content)
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  const markingReadRef = useRef<Set<string>>(new Set());

  // Mark unread as read
  useEffect(() => {
    const unreadVal = conversation.unreadCount?.[currentUser.talkoNumber] || 0;
    const markRead = async () => {
      if (unreadVal > 0) {
        const convRef = doc(db, 'conversations', conversation.id);
        const newUnread = { ...(conversation.unreadCount || {}), [currentUser.talkoNumber]: 0 };
        await updateDoc(convRef, { unreadCount: newUnread });
      }
      
      // Update message statuses to read for messages sent by the other user
      if (currentUser.settings?.readReceipts !== false) {
        messages.forEach(async msg => {
          if (msg.senderNumber !== currentUser.talkoNumber && msg.status !== 'read') {
            if (!markingReadRef.current.has(msg.id)) {
              markingReadRef.current.add(msg.id);
              try {
                await updateDoc(doc(db, 'conversations', conversation.id, 'messages', msg.id), { status: 'read' });
              } catch (e) {
                markingReadRef.current.delete(msg.id);
              }
            }
          }
        });
      }
    };
    markRead();
  }, [conversation.id, conversation.unreadCount?.[currentUser.talkoNumber], currentUser.talkoNumber, messages, currentUser.settings?.readReceipts]);

  // Handle Mark as Not Spam
  const handleMarkNotSpam = async () => {
    const userRef = doc(db, 'users', currentUser.id);
    const newSpamList = (currentUser.spamConvs || []).filter(id => id !== conversation.id);
    const newNotSpamList = [...(currentUser.notSpamConvs || []), conversation.id];
    
    await setDoc(userRef, {
      spamConvs: newSpamList,
      notSpamConvs: newNotSpamList
    }, { merge: true });
    setShowMenu(false);
  };

  // Handle Mark as Spam
  const handleMarkSpam = async () => {
    const userRef = doc(db, 'users', currentUser.id);
    const newNotSpamList = (currentUser.notSpamConvs || []).filter(id => id !== conversation.id);
    const newSpamList = [...(currentUser.spamConvs || []), conversation.id];
    
    await setDoc(userRef, {
      spamConvs: newSpamList,
      notSpamConvs: newNotSpamList
    }, { merge: true });
    setShowMenu(false);
  };

  // Handle Block / Unblock
  const handleToggleBlock = async () => {
    const userRef = doc(db, 'users', currentUser.id);
    let newBlockedSenders = [...(currentUser.blockedSenders || [])];
    let newBlockedConvs = [...(currentUser.blockedConvs || [])];

    if (isBlocked) {
      newBlockedSenders = newBlockedSenders.filter(s => s !== otherUser.talkoNumber && s !== (otherUser.alphanumericName || ''));
      newBlockedConvs = newBlockedConvs.filter(id => id !== conversation.id);
    } else {
      newBlockedSenders.push(otherUser.talkoNumber);
      if (otherUser.alphanumericName) newBlockedSenders.push(otherUser.alphanumericName);
      newBlockedConvs.push(conversation.id);
    }

    await setDoc(userRef, {
      blockedSenders: newBlockedSenders,
      blockedConvs: newBlockedConvs
    }, { merge: true });
    setShowMenu(false);
  };

  const isBusinessUser = isBusinessAccountUser(currentUser);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusinessUser || !inputText.trim() || isBlocked) return;
    
    const content = inputText.trim();
    setInputText('');

    if (soundManager.isSoundEnabled()) {
      soundManager.playSendSound();
    }

    const msgId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newMsgRef = doc(db, 'conversations', conversation.id, 'messages', msgId);
    
    const messageData: Message = {
      id: msgId,
      conversationId: conversation.id,
      senderId: currentUser.id,
      senderNumber: currentUser.talkoNumber,
      senderName: getDisplayName(currentUser),
      content,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    try {
      await setDoc(newMsgRef, messageData);
      
      const convRef = doc(db, 'conversations', conversation.id);
      const currentUnread = conversation.unreadCount || {};
      const targetNumber = otherUser?.talkoNumber || 'TALKO';
      const newUnread = { 
        ...currentUnread,
        [targetNumber]: (currentUnread[targetNumber] || 0) + 1
      };
      
      await setDoc(convRef, {
        lastMessage: messageData,
        unreadCount: newUnread,
        updatedAt: messageData.timestamp
      }, { merge: true });
    } catch (err) {
      console.error('Error sending message or updating conversation:', err);
    }
  };

  const setTyping = async (isTyping: boolean) => {
    const convRef = doc(db, 'conversations', conversation.id);
    let typers = [...(conversation.typingUsers || [])];
    let changed = false;
    
    if (isTyping && !typers.includes(currentUser.talkoNumber)) {
      typers.push(currentUser.talkoNumber);
      changed = true;
    } else if (!isTyping && typers.includes(currentUser.talkoNumber)) {
      typers = typers.filter(t => t !== currentUser.talkoNumber);
      changed = true;
    }
    
    if (changed) {
      await updateDoc(convRef, { typingUsers: typers });
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    setTyping(e.target.value.trim().length > 0);
  };

  const renderStatus = (msg: Message) => {
    if (msg.senderNumber !== currentUser.talkoNumber) return null;
    if (otherUser.settings?.readReceipts === false) {
      if (msg.status === 'read' || msg.status === 'delivered') return <CheckCheck size={14} className="text-white/70" />;
      return <Check size={14} className="text-white/70" />;
    }
    if (msg.status === 'read') return <CheckCheck size={14} className="text-blue-300" />;
    if (msg.status === 'delivered') return <CheckCheck size={14} className="text-white/70" />;
    return <Check size={14} className="text-white/70" />;
  };

  return (
    <div className="flex flex-col h-full bg-[#0F1115]">
      {/* Header */}
      <header className="bg-[#181B22] border-b border-gray-800 p-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 text-[#9AA4B2] hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div 
            onClick={() => onOpenProfile(otherUser)}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <DefaultAvatar 
              color={otherUser.avatarColor}
              size="sm"
              avatarUrl={otherUser.avatarUrl}
              name={otherDisplayName}
              isAlphanumeric={otherUser.isAlphanumericSender || otherUser.isBusinessAccount}
              isSpam={isSpam}
              isBlocked={isBlocked}
            />
            <div>
              <h2 className={`text-sm font-bold text-white group-hover:text-[#2563EB] transition-colors ${!otherUser.isAlphanumericSender && !otherUser.isBusinessAccount && !otherUser.isSystemAccount ? 'font-mono' : ''}`}>
                {otherDisplayName}
              </h2>
              <p className="text-[11px] text-[#9AA4B2]">
                {otherUser.isSystemAccount || otherUser.talkoNumber === 'TALKO' ? (
                  <span className="text-[#2563EB] font-bold">Resmi Sistem Hesabı</span>
                ) : conversation.typingUsers?.includes(otherUser.talkoNumber) ? (
                  <span className="text-[#2563EB] font-bold animate-pulse">Yazıyor...</span>
                ) : (
                  isUserOnline(otherUser) 
                    ? 'Çevrimiçi' 
                    : (otherUser.settings?.lastSeen !== false && otherUser.lastSeen ? `Son görülme: ${format(new Date(otherUser.lastSeen), 'HH:mm')}` : '')
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Options Menu Dropdown */}
        {!isProtectedAccount && (
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)} 
              className="p-2 text-[#9AA4B2] hover:text-white transition-colors rounded-xl hover:bg-[#23262F]"
            >
              <MoreVertical size={20} />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-[#181B22] border border-[#23262F] rounded-2xl shadow-2xl py-2 z-50 text-xs font-bold space-y-1">
                {isSpam ? (
                  <button
                    onClick={handleMarkNotSpam}
                    className="w-full px-4 py-2.5 text-left text-green-400 hover:bg-[#23262F] flex items-center gap-2"
                  >
                    <CheckCircle2 size={16} /> Spam Değil
                  </button>
                ) : (
                  <button
                    onClick={handleMarkSpam}
                    className="w-full px-4 py-2.5 text-left text-yellow-400 hover:bg-[#23262F] flex items-center gap-2"
                  >
                    <AlertTriangle size={16} /> Spam Olarak İşaretle
                  </button>
                )}

                <button
                  onClick={handleToggleBlock}
                  className={`w-full px-4 py-2.5 text-left hover:bg-[#23262F] flex items-center gap-2 ${isBlocked ? 'text-green-400' : 'text-red-500'}`}
                >
                  <Ban size={16} /> {isBlocked ? 'Engeli Kaldır' : 'Göndericiyi Engelle'}
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Warning Banners for Spam & Blocked */}
      {isSpam && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/30 p-3 px-4 flex items-center justify-between text-yellow-400 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle size={18} className="shrink-0" />
            <span>Bu mesaj otomatik spam filtresine takılmıştır.</span>
          </div>
          <button
            onClick={handleMarkNotSpam}
            className="px-3 py-1 bg-yellow-500 text-black font-black text-[11px] rounded-xl hover:bg-yellow-400 transition-colors shrink-0 shadow-md"
          >
            Spam Değil
          </button>
        </div>
      )}

      {isBlocked && (
        <div className="bg-red-500/10 border-b border-red-500/30 p-3 px-4 flex items-center justify-between text-red-400 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <Ban size={18} className="shrink-0" />
            <span>Bu göndericiyi engellediniz.</span>
          </div>
          <button
            onClick={handleToggleBlock}
            className="px-3 py-1 bg-red-500 text-white font-bold text-[11px] rounded-xl hover:bg-red-600 transition-colors shrink-0 shadow-md"
          >
            Engeli Kaldır
          </button>
        </div>
      )}

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="text-center mb-6">
          <p className="text-xs text-[#9AA4B2] bg-[#181B22] inline-block px-3 py-1.5 rounded-xl border border-gray-800">
            {otherUser.isAlphanumericSender || otherUser.isBusinessAccount ? 'Kurumsal Hesap' : 'Sohbet uçtan uca şifrelenmiştir.'}
          </p>
        </div>

        {messages.map((msg, idx) => {
          const isMine = msg.senderNumber === currentUser.talkoNumber;
          const showDate = idx === 0 || new Date(messages[idx-1].timestamp).toDateString() !== new Date(msg.timestamp).toDateString();
          
          return (
            <React.Fragment key={msg.id}>
              {showDate && (
                <div className="text-center my-4">
                  <span className="text-[10px] font-bold text-[#9AA4B2] bg-[#181B22] px-3 py-1 rounded-full uppercase tracking-wider">
                    {format(new Date(msg.timestamp), 'dd MMM yyyy')}
                  </span>
                </div>
              )}
              
              <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                  isMine 
                    ? 'bg-[#2563EB] text-white rounded-br-sm' 
                    : 'bg-[#23262F] text-white rounded-bl-sm border border-gray-800'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                  <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMine ? 'text-blue-200' : 'text-[#9AA4B2]'}`}>
                    <span>{format(new Date(msg.timestamp), 'HH:mm')}</span>
                    {renderStatus(msg)}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {otherUser.isSystemAccount ? (
        <div className="p-4 bg-[#181B22] border-t border-gray-800 text-center">
          <p className="text-xs text-[#9AA4B2]">Bu resmi TALKO hesabıdır, yanıt verilemez.</p>
        </div>
      ) : isBlocked ? (
        <div className="p-4 bg-[#181B22] border-t border-gray-800 text-center text-red-400 font-bold text-xs">
          Engellenmiş göndericilere mesaj gönderemezsiniz.
        </div>
      ) : isBusinessUser ? (
        <div className="p-5 bg-[#181B22] border-t border-[#23262F] flex flex-col items-center justify-center text-center gap-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs bg-amber-500/10 px-3.5 py-1.5 rounded-xl border border-amber-500/20 shadow-sm">
            <Building2 size={16} />
            <span>Kurumsal Gönderici Hesabı</span>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">
              Kurumsal gönderici hesapları normal sohbet için kullanılamaz.
            </h3>
            <p className="text-xs text-[#9AA4B2] max-w-sm">
              Mesaj göndermek için Talko Business Panel'ini kullanın.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              window.history.pushState({}, '', '/business');
              window.dispatchEvent(new Event('popstate'));
            }}
            className="mt-1 px-5 py-2.5 bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs rounded-2xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
          >
            <Building2 size={16} />
            <span>Business Panel'ine Git</span>
          </button>
        </div>
      ) : (
        <form onSubmit={handleSend} className="p-3 bg-[#181B22] border-t border-gray-800 flex items-end gap-2">
          <button type="button" className="p-3 text-[#9AA4B2] hover:text-white transition-colors rounded-xl shrink-0">
            <ImageIcon size={20} />
          </button>
          <input 
            type="text"
            value={inputText}
            onChange={handleInput}
            onBlur={() => setTyping(false)}
            placeholder="Mesaj yazın..."
            className="flex-1 max-h-32 bg-[#0F1115] text-white text-sm rounded-2xl py-3 px-4 border border-gray-800 focus:outline-none focus:border-[#2563EB] transition-colors"
          />
          <button 
            type="submit"
            disabled={!inputText.trim()}
            className="p-3 bg-[#2563EB] text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:bg-gray-800 disabled:text-[#9AA4B2] transition-colors shrink-0 shadow-lg shadow-blue-500/20"
          >
            <Send size={20} className={inputText.trim() ? 'ml-1' : ''} />
          </button>
        </form>
      )}
    </div>
  );
};

