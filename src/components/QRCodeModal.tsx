import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, Share2 } from 'lucide-react';
import { User, getDisplayName } from '../types';
import { DefaultAvatar } from './DefaultAvatar';
import { motion, AnimatePresence } from 'motion/react';

interface QRCodeModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ user, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !user) return null;

  const qrValue = `https://talko-messages.app/user/${user.talkoNumber}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(user.talkoNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="bg-[#181B22] border border-[#23262F] rounded-3xl w-full max-w-sm overflow-hidden relative shadow-2xl flex flex-col p-6 items-center text-center"
        >
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-[#9AA4B2] hover:text-white z-10 bg-[#0F1115] p-2 rounded-full transition-colors"
          >
            <X size={20} />
          </button>

          <div className="mt-2 mb-4">
            <DefaultAvatar
              color={user.avatarColor}
              size="lg"
              avatarUrl={user.avatarUrl}
              name={getDisplayName(user)}
              className="border-2 border-[#2563EB]"
            />
          </div>

          <h3 className="text-xl font-bold text-white tracking-tight">{getDisplayName(user)}</h3>
          <p className="text-xs text-[#9AA4B2] mt-0.5 mb-6 font-mono bg-[#0F1115] px-3 py-1 rounded-full border border-[#23262F]">
            {user.talkoNumber}
          </p>

          {/* QR Code Canvas Frame */}
          <div className="bg-white p-5 rounded-3xl shadow-xl flex items-center justify-center border-4 border-[#2563EB]/20 my-2">
            <QRCodeSVG 
              value={qrValue} 
              size={180} 
              level="H" 
              fgColor="#0F1115" 
              bgColor="#FFFFFF"
              includeMargin={false}
            />
          </div>

          <p className="text-xs text-[#9AA4B2] mt-4 max-w-xs">
            Talko numaranızı QR kodu okutarak arkadaşlarınızla anında sohbet başlatabilirsiniz.
          </p>

          <div className="w-full flex gap-3 mt-6">
            <button
              onClick={handleCopy}
              className="flex-1 py-3 px-4 bg-[#23262F] hover:bg-gray-800 text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors border border-gray-800"
            >
              {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
              {copied ? 'Kopyalandı!' : 'Numarayı Kopyala'}
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'Talko Messages',
                    text: `Talko üzerinden benimle sohbet et! Numaram: ${user.talkoNumber}`,
                    url: qrValue
                  }).catch(() => {});
                } else {
                  handleCopy();
                }
              }}
              className="py-3 px-4 bg-[#2563EB] hover:bg-blue-600 text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
            >
              <Share2 size={16} />
              Paylaş
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
