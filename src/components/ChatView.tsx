import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Image as ImageIcon, Check, CheckCheck, AlertTriangle, Ban, ShieldCheck, MoreVertical, CheckCircle2, Building2, Loader2 } from 'lucide-react';
import { Conversation, Message, User, getDisplayName, isUserOnline, formatLastSeen, checkIsSpam, isBusinessAccountUser } from '../types';
import { DefaultAvatar } from './DefaultAvatar';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import { soundManager } from '../lib/audio';
import { format } from 'date-fns';
import { getBrowserFingerprint } from '../lib/fingerprint';
import { evaluateLocalSafetyRules } from '../lib/groqModeration';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  
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

    // --- Groq AI Safety & Moderation Check ---
    const fingerprint = getBrowserFingerprint();
    const historyContext = messages.slice(-10).map(m => ({
      senderName: m.senderName,
      content: m.content
    }));

    let decision: '[TEMIZ]' | '[YUZ_DOGRULAMA]' | '[KALICI_BAN]' = '[TEMIZ]';

    try {
      const res = await fetch('/api/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          senderNumber: currentUser.talkoNumber,
          conversationHistory: historyContext,
          browserFingerprint: fingerprint
        })
      });

      if (res.ok) {
        const data = await res.json();
        decision = data.decision || '[TEMIZ]';
      } else {
        decision = evaluateLocalSafetyRules(content);
      }
    } catch {
      decision = evaluateLocalSafetyRules(content);
    }

    if (decision === '[KALICI_BAN]') {
      localStorage.setItem('talko_banned_fingerprint', fingerprint);
      await setDoc(doc(db, 'users', currentUser.id), {
        isBanned: true,
        banReason: 'Groq AI Security Moderation [KALICI_BAN]: +18 / Taciz / Ağır İhlal',
        browserFingerprint: fingerprint
      }, { merge: true });
      return;
    }

    if (decision === '[YUZ_DOGRULAMA]') {
      localStorage.setItem('talko_locked_fingerprint', fingerprint);
      await setDoc(doc(db, 'users', currentUser.id), {
        is_locked: true,
        browserFingerprint: fingerprint
      }, { merge: true });
      window.dispatchEvent(new CustomEvent('open-security-verification'));
      return;
    }

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    if (files.length > 5) {
      alert("En fazla 5 adet fotoğraf seçebilirsiniz.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    const totalFiles = files.length;
    const IMGBB_API_KEY = (import.meta as any).env?.VITE_IMGBB_API_KEY || '1b1acded736668402c8136719fa92102';

    if (soundManager.isSoundEnabled()) {
      soundManager.playSendSound();
    }

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      setUploadProgress(`${i + 1}/${totalFiles}`);

      try {
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const data = await response.json();
        const imageUrl = data?.data?.url;

        if (imageUrl) {
          const msgId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
          const newMsgRef = doc(db, 'conversations', conversation.id, 'messages', msgId);
          
          const messageData: Message = {
            id: msgId,
            conversationId: conversation.id,
            senderId: currentUser.id,
            senderNumber: currentUser.talkoNumber,
            senderName: getDisplayName(currentUser),
            content: '📷 Fotoğraf',
            attachment: {
              type: 'photo',
              url: imageUrl,
              name: file.name,
              size: `${Math.round(file.size / 1024)} KB`
            },
            timestamp: new Date().toISOString(),
            status: 'sent'
          };

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
        }
      } catch (err) {
        console.error('Failed to upload image:', err);
        alert(`"${file.name}" yüklenirken bir hata oluştu.`);
      }
    }

    setIsUploading(false);
    setUploadProgress('');
    if (fileInputRef.current) fileInputRef.current.value = '';
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
    if (currentUser.settings?.readReceipts === false || otherUser.settings?.readReceipts === false) {
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
              talkoNumber={otherUser.talkoNumber}
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
                  formatLastSeen(otherUser)
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
                {msg.isSecurityVerification && msg.senderNumber === 'TALKO' ? (
                  <div className="w-full max-w-sm sm:max-w-md mx-auto my-4 bg-gradient-to-b from-[#1E3A8A]/40 to-[#172554]/40 border border-[#3B82F6]/30 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
                    <div className="p-5">
                      <div className="flex items-center gap-2 text-blue-400 font-bold mb-3">
                        <ShieldCheck size={20} className="text-blue-500" />
                        <span>TALKO Güvenlik Bildirimi</span>
                      </div>
                      <h3 className="text-white text-base font-medium leading-relaxed mb-4">
                        Merhaba,<br/><br/>
                        Hesabınızın güvenliğini artırmak amacıyla kimlik doğrulama işlemini tamamlamanız önerilir.<br/><br/>
                        Yüz doğrulaması, hesabınızın size ait olduğunu doğrulamaya yardımcı olur ve hesabınızı yetkisiz erişimlere karşı korur.<br/><br/>
                        Lütfen güvenlik doğrulamasını 24 saat içinde tamamlayın.
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-[#9AA4B2] font-medium bg-[#1e293b]/50 p-2.5 rounded-xl border border-gray-800">
                        <span className="text-blue-400">⏱️</span>
                        <span>Tahmini süre: 1–2 dakika</span>
                      </div>
                    </div>
                    
                    <div className="px-5 pb-5">
                      <button 
                        onClick={() => window.dispatchEvent(new CustomEvent('open-security-verification'))}
                        className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98]"
                      >
                        Doğrula
                      </button>
                      <div className="mt-4 flex items-center justify-between text-xs font-medium border-t border-[#3B82F6]/20 pt-3">
                        <div className="flex items-center gap-1.5 text-[#9AA4B2]">
                          <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                            <span className="text-[10px] text-white font-bold">T</span>
                          </div>
                          <span>TALKO</span>
                        </div>
                        <span className="text-[#9AA4B2] uppercase tracking-wider text-[10px]">From</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl overflow-hidden shadow-sm ${
                    isMine 
                      ? 'bg-[#2563EB] text-white rounded-br-sm' 
                      : 'bg-[#23262F] text-white rounded-bl-sm border border-gray-800'
                  }`}>
                    {msg.attachment?.type === 'photo' && (
                      <div className="relative cursor-pointer max-w-full">
                        <a href={msg.attachment.url} target="_blank" rel="noopener noreferrer">
                          <img 
                            src={msg.attachment.url} 
                            alt="Görsel" 
                            referrerPolicy="no-referrer"
                            className="max-h-72 w-full object-cover rounded-t-xl hover:opacity-90 transition-opacity"
                          />
                        </a>
                      </div>
                    )}
                    <div className="px-4 py-2.5">
                      {msg.content && msg.content !== '📷 Fotoğraf' && (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words mb-1">{msg.content}</p>
                      )}
                      <div className={`flex items-center justify-end gap-1 text-[10px] ${isMine ? 'text-blue-200' : 'text-[#9AA4B2]'}`}>
                        <span>{format(new Date(msg.timestamp), 'HH:mm')}</span>
                        {renderStatus(msg)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Uploading Status Banner */}
      {isUploading && (
        <div className="px-4 py-2 bg-blue-600/10 border-t border-blue-500/20 flex items-center gap-2 text-xs text-[#9AA4B2]">
          <Loader2 size={14} className="animate-spin text-[#2563EB]" />
          <span>Fotoğraf yükleniyor: <strong className="text-white">{uploadProgress}</strong></span>
        </div>
      )}

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
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            multiple 
            className="hidden" 
          />
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isUploading}
            className="p-3 text-[#9AA4B2] hover:text-white disabled:opacity-50 transition-colors rounded-xl shrink-0"
          >
            {isUploading ? (
              <Loader2 size={20} className="animate-spin text-[#2563EB]" />
            ) : (
              <ImageIcon size={20} />
            )}
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
            disabled={!inputText.trim() || isUploading}
            className="p-3 bg-[#2563EB] text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:bg-gray-800 disabled:text-[#9AA4B2] transition-colors shrink-0 shadow-lg shadow-blue-500/20"
          >
            <Send size={20} className={inputText.trim() ? 'ml-1' : ''} />
          </button>
        </form>
      )}
    </div>
  );
};

