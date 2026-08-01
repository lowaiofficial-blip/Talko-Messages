import React, { useState } from 'react';
import { User } from '../types';
import { X } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';

interface AlphanumericModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
}

export const AlphanumericModal: React.FC<AlphanumericModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [senderName, setSenderName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senderName.length > 11) {
      alert("Gönderici adı en fazla 11 karakter olabilir.");
      return;
    }
    
    const appRef = doc(collection(db, 'alphanumeric_apps'));
    await setDoc(appRef, {
      id: appRef.id,
      userId: currentUser.id,
      userTalkoNumber: currentUser.talkoNumber,
      senderName: senderName.toUpperCase(),
      companyName,
      description,
      email,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    
    alert("Başvurunuz başarıyla alındı.");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#181B22] border border-gray-800 rounded-3xl w-full max-w-md overflow-hidden relative shadow-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-white">Alphanumeric Başvurusu</h2>
          <button onClick={onClose} className="p-2 text-[#9AA4B2] hover:text-white rounded-full bg-gray-800">
            <X size={18} />
          </button>
        </div>
        
        <p className="text-xs text-[#9AA4B2] mb-6">
          Firmanız adına numara yerine isimle SMS gönderebilmek için Alphanumeric Sender ID başvurusunda bulunun.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#9AA4B2] mb-1.5 block">Talep Edilen Gönderici Adı (Max 11 karakter)</label>
            <input 
              type="text" 
              maxLength={11}
              value={senderName}
              onChange={e => setSenderName(e.target.value)}
              className="w-full bg-[#0F1115] text-white p-3 rounded-xl border border-gray-800 focus:border-[#2563EB] outline-none text-sm uppercase"
              placeholder="TRENDYOL"
              required 
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#9AA4B2] mb-1.5 block">Firma Ünvanı</label>
            <input 
              type="text" 
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              className="w-full bg-[#0F1115] text-white p-3 rounded-xl border border-gray-800 focus:border-[#2563EB] outline-none text-sm"
              placeholder="Trendyol A.Ş."
              required 
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#9AA4B2] mb-1.5 block">Kurumsal E-posta</label>
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#0F1115] text-white p-3 rounded-xl border border-gray-800 focus:border-[#2563EB] outline-none text-sm"
              placeholder="iletisim@trendyol.com"
              required 
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#9AA4B2] mb-1.5 block">Kullanım Amacı</label>
            <textarea 
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-[#0F1115] text-white p-3 rounded-xl border border-gray-800 focus:border-[#2563EB] outline-none text-sm"
              placeholder="Müşterilerimize sipariş bildirimleri göndermek için."
              required 
            />
          </div>
          <button type="submit" className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl mt-2 transition-colors">
            Başvuruyu Tamamla
          </button>
        </form>
      </div>
    </div>
  );
};
