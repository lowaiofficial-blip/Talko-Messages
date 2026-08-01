import React from 'react';
import { User, Conversation, getDisplayName, isUserOnline } from '../types';
import { DefaultAvatar } from './DefaultAvatar';
import { X, MessageSquare, QrCode, Ban, AlertOctagon, ShieldCheck } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, getDoc, setDoc, doc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

interface ProfileCardModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onStartChat: (conv: Conversation) => void;
  onOpenQR?: (user: User) => void;
}

export const ProfileCardModal: React.FC<ProfileCardModalProps> = ({ 
  user, 
  isOpen, 
  onClose, 
  currentUser, 
  onStartChat,
  onOpenQR
}) => {
  if (!isOpen || !user) return null;

  const isSelf = currentUser?.talkoNumber === user.talkoNumber;
  const isProtectedAccount = 
    user.isSystemAccount || 
    user.talkoNumber === 'TALKO' || 
    user.email?.toLowerCase() === 'lowai.official@gmail.com' || 
    user.email?.toLowerCase() === 'devy.build.backup@gmail.com';

  const displayName = getDisplayName(user);

  const isBusinessUser = currentUser?.role === 'business' || currentUser?.isBusinessAccount;

  const handleMessageClick = async () => {
    if (!currentUser) return;
    if (isBusinessUser) {
      alert("Kurumsal gönderici hesapları normal sohbet için kullanılamaz. Lütfen Talko Business Panel'ini kullanın.");
      return;
    }
    
    const sortedParticipants = [currentUser.talkoNumber, user.talkoNumber].sort();
    const convId = `${sortedParticipants[0]}_${sortedParticipants[1]}`;
    const convRef = doc(db, 'conversations', convId);
    
    const convSnap = await getDoc(convRef);
    
    if (convSnap.exists()) {
      onStartChat({ id: convSnap.id, ...convSnap.data() } as Conversation);
    } else {
      const newConv: Conversation = {
        id: convId,
        participants: [currentUser.talkoNumber, user.talkoNumber],
        participantUsers: [currentUser, user],
        unreadCount: { [currentUser.talkoNumber]: 0, [user.talkoNumber]: 0 },
        typingUsers: [],
        updatedAt: new Date().toISOString()
      };
      await setDoc(convRef, newConv);
      onStartChat(newConv);
    }
  };

  const handleBlock = () => {
    alert(`${displayName} kişisi engellendi.`);
    onClose();
  };

  const handleReport = () => {
    alert(`${displayName} hakkında şikayetiniz alındı.`);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-[#181B22] border border-[#23262F] rounded-3xl w-full max-w-sm overflow-hidden relative shadow-2xl flex flex-col"
        >
          <button onClick={onClose} className="absolute top-4 right-4 text-[#9AA4B2] hover:text-white z-10 bg-[#0F1115] p-2 rounded-full transition-colors">
            <X size={20} />
          </button>
          
          <div className="px-6 pt-10 pb-6 text-center flex flex-col items-center">
            <div className="relative group">
              <DefaultAvatar 
                color={user.avatarColor}
                size="xl"
                avatarUrl={user.avatarUrl}
                name={displayName}
                className="border-4 border-[#181B22] shadow-lg"
                isAlphanumeric={user.isAlphanumericSender}
              />
              {!user.isSystemAccount && user.talkoNumber !== 'TALKO' && (
                <div className={`absolute bottom-2 right-2 w-4 h-4 rounded-full border-2 border-[#181B22] ${isUserOnline(user) ? 'bg-green-500' : 'bg-gray-500'}`}></div>
              )}
            </div>
            
            <h2 className="text-xl font-bold font-mono text-white mt-4 tracking-tight flex items-center gap-1.5 justify-center">
              {displayName}
              {isSelf && <span className="text-[10px] bg-[#2563EB]/20 text-[#2563EB] font-sans px-2 py-0.5 rounded-full">(Sen)</span>}
            </h2>
            
            <div className="text-xs text-[#9AA4B2] mt-1 flex items-center gap-1 justify-center">
              {user.isSystemAccount || user.talkoNumber === 'TALKO' ? (
                <span className="text-xs font-bold text-[#2563EB] bg-[#2563EB]/10 px-3 py-1 rounded-full border border-[#2563EB]/20 mt-1">
                  Resmi Sistem Hesabı
                </span>
              ) : (
                <>
                  <span className={`w-2 h-2 rounded-full ${isUserOnline(user) ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                  <span>{isUserOnline(user) ? 'Çevrimiçi' : 'Çevrimdışı'}</span>
                </>
              )}
            </div>
            
            <div className="mt-6 px-4 py-3 bg-[#0F1115] rounded-2xl w-full flex items-center justify-between border border-[#23262F]">
              <p className="text-xs text-[#9AA4B2] font-semibold">Talko Numarası</p>
              <p className="font-mono text-xs text-[#2563EB] bg-[#2563EB]/10 px-2.5 py-1 rounded-lg font-bold">{user.talkoNumber}</p>
            </div>
            
            {!isSelf && !user.isSystemAccount && !isBusinessUser && (
              <div className="w-full mt-6">
                <button 
                  onClick={handleMessageClick}
                  className="w-full py-3.5 bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
                >
                  <MessageSquare size={18} /> Mesaj Gönder
                </button>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="w-full mt-6 flex justify-around gap-2 border-t border-[#23262F] pt-5">
              <button 
                className="flex-1 flex flex-col items-center justify-center gap-2 text-[#9AA4B2] hover:text-white transition-colors" 
                onClick={() => {
                  onClose();
                  if (onOpenQR) onOpenQR(user);
                }}
              >
                <div className="w-11 h-11 rounded-2xl bg-[#0F1115] flex items-center justify-center border border-[#23262F] hover:border-[#2563EB] transition-colors">
                  <QrCode size={20} className="text-[#2563EB]" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider">QR Kod</span>
              </button>

              {!isSelf && !isProtectedAccount && (
                <>
                  <button 
                    className="flex-1 flex flex-col items-center justify-center gap-2 text-[#9AA4B2] hover:text-red-500 transition-colors" 
                    onClick={handleBlock}
                  >
                    <div className="w-11 h-11 rounded-2xl bg-[#0F1115] flex items-center justify-center border border-[#23262F] hover:border-red-500/50 transition-colors">
                      <Ban size={18} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Engelle</span>
                  </button>
                  <button 
                    className="flex-1 flex flex-col items-center justify-center gap-2 text-[#9AA4B2] hover:text-orange-500 transition-colors" 
                    onClick={handleReport}
                  >
                    <div className="w-11 h-11 rounded-2xl bg-[#0F1115] flex items-center justify-center border border-[#23262F] hover:border-orange-500/50 transition-colors">
                      <AlertOctagon size={18} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Şikayet Et</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

