import React, { useEffect, useState } from 'react';
import { ShieldCheck, Info, Clock, CheckCircle2, ChevronRight, X, User as UserIcon, Camera, Lock } from 'lucide-react';
import { User } from '../types';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

interface SecurityVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUnlocked?: () => void;
}

export const SecurityVerificationModal: React.FC<SecurityVerificationModalProps> = ({ isOpen, onClose, currentUser, onUnlocked }) => {
  const [step, setStep] = useState<'info' | 'camera' | 'success'>('info');
  const [isClosing, setIsClosing] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep('info');
      setIsClosing(false);
      setStream(null);
      setCameraError(null);
      setIsVerifying(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  // Handle Camera access
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let verifyTimeout: NodeJS.Timeout;
    let successTimeout: NodeJS.Timeout;

    if (step === 'camera') {
      const startCamera = async () => {
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setCameraError("Kamera bu tarayıcıda desteklenmiyor veya HTTPS bağlantısı gerekiyor.");
            return;
          }
          const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
          activeStream = s;
          setStream(s);
          setCameraError(null);
          
          // Simulate successful verification
          verifyTimeout = setTimeout(() => {
            setIsVerifying(true);
            successTimeout = setTimeout(() => {
              setStep('success');
            }, 2000);
          }, 3000);
        } catch (err: any) {
          console.error("Camera access error:", err);
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setCameraError("Kamera izni reddedildi. Lütfen tarayıcı ayarlarından kamera izni verin.");
          } else {
            setCameraError("Kamera bulunamadı veya kullanılamıyor.");
          }
        }
      };

      startCamera();
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      clearTimeout(verifyTimeout);
      clearTimeout(successTimeout);
    };
  }, [step]);

  // Handle video element binding
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleUnlockComplete = async () => {
    try {
      if (currentUser?.id) {
        await setDoc(doc(db, 'users', currentUser.id), {
          is_locked: false
        }, { merge: true });
      }
    } catch (err) {
      console.error('Error unlocking user:', err);
    }
    if (onUnlocked) onUnlocked();
    handleClose();
  };

  const handleClose = () => {
    // If locked, cannot dismiss without completing verification
    if (currentUser?.is_locked && step !== 'success') {
      alert("Hesabınız güvenlik incelemesinde olduğu için doğrulama yapmadan chate dönemezsiniz.");
      return;
    }
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300);
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div 
        className={`w-full h-full sm:w-[480px] sm:h-[800px] sm:max-h-[90vh] bg-[#0B0E14] sm:rounded-3xl sm:border border-[#1E293B] shadow-2xl overflow-hidden flex flex-col transition-all duration-300 transform ${
          isOpen && !isClosing ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-10 opacity-0 scale-95'
        }`}
      >
        {step === 'info' && (
          <div className="flex flex-col h-full bg-gradient-to-b from-[#1E3A8A]/20 to-[#0B0E14]">
            {/* Header with Meta Logo Badge */}
            <div className="relative pt-10 pb-6 px-6 text-center shrink-0">
              {!currentUser?.is_locked && (
                <button 
                  onClick={handleClose}
                  className="absolute top-6 right-6 w-10 h-10 bg-[#1E293B]/50 hover:bg-[#1E293B] rounded-full flex items-center justify-center text-white transition-colors"
                >
                  <X size={20} />
                </button>
              )}
              
              {/* Meta Branding Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#1E293B]/80 rounded-full border border-blue-500/30 text-xs font-semibold text-blue-400 mb-5">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M16.98 6.42c-1.3 0-2.43.76-3.08 1.87-.65-1.11-1.78-1.87-3.08-1.87-2.12 0-3.82 1.7-3.82 3.82 0 3.2 5.08 7.34 6.9 8.74.12.09.28.14.43.14s.31-.05.43-.14c1.82-1.4 6.9-5.54 6.9-8.74 0-2.12-1.7-3.82-3.82-3.82z"/>
                </svg>
                <span>META INTEGRITY & SECURITY CENTER</span>
              </div>
              
              <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4 relative">
                <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping"></div>
                <ShieldCheck size={40} className="text-blue-500 relative z-10" />
              </div>
              
              <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Meta Yüz Doğrulaması</h1>
              <p className="text-[#9AA4B2] text-sm">Şüpheli aktivite veya troll tespiti nedeniyle hesabınız dondurulmuştur. Canlı video selfie doğrulaması yapınız.</p>
            </div>

            {/* Content Scrollable */}
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6 custom-scrollbar">
              
              {/* Section 1 */}
              <div className="bg-[#1E293B]/40 rounded-2xl p-5 border border-[#1E293B]">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                  <UserIcon size={18} className="text-blue-400" />
                  Bu doğrulama neden kilitlendi?
                </h3>
                <p className="text-[#9AA4B2] text-sm leading-relaxed mb-3">Meta AI güvenlik botu tarafından yapılan taramada;</p>
                <ul className="space-y-2 text-[#9AA4B2] text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                    <span>Taciz, flörtöz darlık veya kural dışı troll davranışı,</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                    <span>Uygunsuz müstehcen (+18) içerik şüphesi,</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                    <span>Spam veya bot davranışı algılandı.</span>
                  </li>
                </ul>
                <p className="text-[#9AA4B2] text-sm leading-relaxed mt-3">Hesabınızı tekrar açmak için yüz doğrulama adımlarını tamamlayınız.</p>
              </div>

              {/* Section 2 */}
              <div className="bg-[#1E293B]/40 rounded-2xl p-5 border border-[#1E293B]">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                  <Info size={18} className="text-blue-400" />
                  Görüntülerim nasıl işleniyor?
                </h3>
                <p className="text-[#9AA4B2] text-sm leading-relaxed mb-3">Canlı kamera selfiesi yalnızca bot ve sahte hesap kontrolü için yapay zeka tarafından taranır.</p>
                <ul className="space-y-2 text-[#9AA4B2] text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                    <span>Üçüncü şahıslara aktarılmaz veya satılmaz.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                    <span>Doğrulama bittikten hemen sonra kilit otomatik kaldırılır.</span>
                  </li>
                </ul>
              </div>

              {/* Section 3 */}
              <div className="bg-[#1E293B]/40 rounded-2xl p-5 border border-[#1E293B]">
                <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                  <Clock size={18} className="text-blue-400" />
                  İşlem Süresi
                </h3>
                <p className="text-[#9AA4B2] text-sm leading-relaxed">
                  Yaklaşık 10 saniye sürer.<br/>
                  Yüzünüz taranıp doğrulandığında sohbet kilidi anında kalkacaktır.
                </p>
              </div>

            </div>

            {/* Bottom Actions */}
            <div className="shrink-0 p-6 bg-[#0B0E14] border-t border-[#1E293B]">
              <div className="flex items-center gap-3 bg-[#1E3A8A]/20 p-3 rounded-xl border border-blue-900/30 mb-5">
                <ShieldCheck size={24} className="text-blue-500 shrink-0" />
                <p className="text-[11px] text-blue-200/80 font-medium leading-relaxed">
                  Meta Güvenlik Portalı: Doğrulamayı tamamlamadan chate dönüş yapamazsınız.
                </p>
              </div>
              
              <button 
                onClick={() => setStep('camera')}
                className="w-full py-4 bg-[#2563EB] hover:bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <span>Kamerayı Aç ve Doğrula</span>
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}

        {step === 'camera' && (
          <div className="flex flex-col h-full bg-[#0B0E14]">
            <div className="pt-10 px-6 pb-4 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-900/30 rounded-full text-xs text-blue-400 border border-blue-500/20 mb-3">
                <Lock size={12} />
                <span>META CANLI YÜZ TARAMASI</span>
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Kameraya Bakın</h2>
              <p className="text-sm text-[#9AA4B2]">{cameraError || (isVerifying ? "Yapay zeka yüzünüzü doğruluyor..." : "Yüzünüzü dairesel çerçevenin içine ortalayın.")}</p>
            </div>
            
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="relative w-full max-w-[280px] aspect-square rounded-full overflow-hidden border-4 border-blue-500/50 shadow-[0_0_50px_rgba(37,99,235,0.3)] bg-[#1E293B] flex items-center justify-center">
                {!stream && !cameraError && <Camera size={64} className="text-[#334155]" />}
                {cameraError && <X size={64} className="text-red-500/50" />}
                
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${stream ? 'opacity-100' : 'opacity-0'}`} 
                />
                
                <div className={`absolute inset-0 border-4 border-t-blue-500 rounded-full transition-all duration-1000 ${isVerifying ? 'animate-spin border-blue-400' : 'border-transparent'}`}></div>
                
                {!stream && !cameraError && (
                  <div className="absolute bottom-10 left-0 right-0 text-center">
                    <p className="text-xs font-bold text-[#9AA4B2] animate-pulse">Kamera başlatılıyor...</p>
                  </div>
                )}
                {isVerifying && (
                  <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-[2px] flex items-center justify-center z-10">
                    <ShieldCheck size={64} className="text-white animate-pulse" />
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 text-center">
              <p className="text-xs text-[#9AA4B2] mb-4">Meta AI canlı tespiti sürdürüyor. Lütfen hareket etmeyin.</p>
            </div>
          </div>
        )}
        
        {step === 'success' && (
          <div className="flex flex-col h-full bg-gradient-to-b from-[#10B981]/20 to-[#0B0E14] items-center justify-center p-6 text-center">
            <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-6 relative">
              <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
              <ShieldCheck size={48} className="text-green-500 relative z-10" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Yüz Doğrulaması Başarılı!</h2>
            <p className="text-[#9AA4B2] mb-8">Gerçek kullanıcı olduğunuz doğrulandı. Hesabınızın sohbet kilidi kaldırıldı.</p>
            <button 
              onClick={handleUnlockComplete}
              className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg shadow-green-600/20 transition-all active:scale-[0.98]"
            >
              Chate Dön
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

