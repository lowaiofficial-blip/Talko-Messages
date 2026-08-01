import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Image as ImageIcon, Video, Mic, FileText, Upload, Check } from 'lucide-react';
import { Attachment, MessageType } from '../types';

interface MediaUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAttach: (attachment: Attachment, caption: string) => void;
}

export const MediaUploadModal: React.FC<MediaUploadModalProps> = ({
  isOpen,
  onClose,
  onAttach,
}) => {
  const [activeType, setActiveType] = useState<MessageType>('photo');
  const [urlInput, setUrlInput] = useState('');
  const [caption, setCaption] = useState('');
  const [fileName, setFileName] = useState('');

  if (!isOpen) return null;

  // Presets for fast testing
  const PRESET_PHOTOS = [
    { name: 'Doğa Manzarası', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80' },
    { name: 'Şehir Projesi', url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=80' },
    { name: 'Teknoloji Tasarımı', url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80' },
  ];

  const PRESET_VIDEOS = [
    { name: 'Örnek Tanıtım Videosu', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' },
  ];

  const PRESET_DOCS = [
    { name: 'Talko_Kullanim_Kilavuzu.pdf', size: '2.4 MB', url: '#' },
    { name: 'Sözleşme_Taslağı_2026.docx', size: '850 KB', url: '#' },
  ];

  const handleSelectPreset = (url: string, name?: string) => {
    setUrlInput(url);
    if (name) setFileName(name);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalUrl = urlInput || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80';
    
    const attachment: Attachment = {
      type: activeType,
      url: finalUrl,
      name: fileName || `${activeType.toUpperCase()}_Ek_${Date.now()}`,
      size: activeType === 'document' ? '1.8 MB' : undefined,
    };

    onAttach(attachment, caption);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-slate-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Medya Ekle</span>
            <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100">
              <X size={20} />
            </button>
          </div>

          {/* Type Selector Tabs */}
          <div className="grid grid-cols-4 gap-1 p-2 bg-slate-50 border-b border-slate-100">
            <button
              onClick={() => setActiveType('photo')}
              className={`py-2 flex flex-col items-center gap-1 rounded-xl text-xs font-medium transition-colors ${
                activeType === 'photo' ? 'bg-white text-blue-600 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ImageIcon size={18} /> Fotoğraf
            </button>

            <button
              onClick={() => setActiveType('video')}
              className={`py-2 flex flex-col items-center gap-1 rounded-xl text-xs font-medium transition-colors ${
                activeType === 'video' ? 'bg-white text-blue-600 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Video size={18} /> Video
            </button>

            <button
              onClick={() => setActiveType('audio')}
              className={`py-2 flex flex-col items-center gap-1 rounded-xl text-xs font-medium transition-colors ${
                activeType === 'audio' ? 'bg-white text-blue-600 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Mic size={18} /> Ses
            </button>

            <button
              onClick={() => setActiveType('document')}
              className={`py-2 flex flex-col items-center gap-1 rounded-xl text-xs font-medium transition-colors ${
                activeType === 'document' ? 'bg-white text-blue-600 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText size={18} /> Belge
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Preset Selection or Custom URL */}
            {activeType === 'photo' && (
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Örnek Fotoğraflar:</label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {PRESET_PHOTOS.map((p, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectPreset(p.url, p.name)}
                      className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                        urlInput === p.url ? 'border-blue-600 ring-2 ring-blue-100 scale-95' : 'border-transparent hover:opacity-90'
                      }`}
                    >
                      <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                      {urlInput === p.url && (
                        <div className="absolute inset-0 bg-blue-600/30 flex items-center justify-center text-white">
                          <Check size={20} className="stroke-[3]" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeType === 'video' && (
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Örnek Video:</label>
                {PRESET_VIDEOS.map((v, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectPreset(v.url, v.name)}
                    className={`p-3 rounded-2xl border cursor-pointer flex items-center gap-3 transition-colors ${
                      urlInput === v.url ? 'bg-blue-50 border-blue-500 text-blue-900' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <Video size={20} className="text-blue-600" />
                    <span className="text-xs font-semibold">{v.name}</span>
                  </div>
                ))}
              </div>
            )}

            {activeType === 'document' && (
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Örnek Belgeler:</label>
                <div className="space-y-2">
                  {PRESET_DOCS.map((d, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectPreset(d.url, d.name)}
                      className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between transition-colors ${
                        urlInput === d.url ? 'bg-blue-50 border-blue-500 text-blue-900' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <FileText size={20} className="text-blue-600" />
                        <div>
                          <div className="text-xs font-bold">{d.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{d.size}</div>
                        </div>
                      </div>
                      {urlInput === d.url && <Check size={18} className="text-blue-600" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Custom URL or Name Input */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Veya Özel Bağlantı (URL):</label>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://..."
                className="w-full text-xs p-2.5 bg-slate-100 rounded-xl border border-slate-200 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Caption */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Açıklama / Mesaj Notu:</label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Medya ile gönderilecek metin..."
                className="w-full text-xs p-2.5 bg-slate-100 rounded-xl border border-slate-200 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl shadow-md shadow-blue-500/20 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <Upload size={16} /> Medyayı Gönder
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
