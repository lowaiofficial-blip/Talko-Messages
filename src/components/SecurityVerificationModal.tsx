import React, { useEffect, useState } from 'react';
import { ShieldCheck, Info, Clock, CheckCircle2, ChevronRight, X, User as UserIcon, Camera } from 'lucide-react';
import { User } from '../types';

interface SecurityVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
}

export const SecurityVerificationModal: React.FC<SecurityVerificationModalProps> = ({ isOpen, onClose, currentUser }) => {
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

  const handleClose = () => {
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
            {/* Header */}
            <div className="relative pt-12 pb-6 px-6 text-center shrink-0">
              <button 
                onClick={handleClose}
                className="absolute top-6 right-6 w-10 h-10 bg-[#1E293B]/50 hover:bg-[#1E293B] rounded-full flex items-center justify-center text-white transition-colors"
              >
                <X size={20} />
              </button>
              
              <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping"></div>
                <ShieldCheck size={40} className="text-blue-500 relative z-10" />
              </div>
              
              <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Yüz doğrulama</h1>
              <p className="text-[#9AA4B2] text-sm">Hesabınızı korumak için kısa bir güvenlik doğrulaması yapacağız.</p>
            </div>

            {/* Content Scrollable */}
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6 custom-scrollbar">
              
              {/* Section 1 */}
              <div className="bg-[#1E293B]/40 rounded-2xl p-5 border border-[#1E293B]">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                  <UserIcon size={18} className="text-blue-400" />
                  Bu doğrulama neden isteniyor?
                </h3>
                <p className="text-[#9AA4B2] text-sm leading-relaxed mb-3">Yüz doğrulaması;</p>
                <ul className="space-y-2 text-[#9AA4B2] text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                    <span>hesabınızın size ait olduğunu doğrulamak,</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                    <span>sahte hesapları önlemek,</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                    <span>hesabınızı yetkisiz erişimlere karşı korumak,</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                    <span>güvenli giriş işlemlerini desteklemek</span>
                  </li>
                </ul>
                <p className="text-[#9AA4B2] text-sm leading-relaxed mt-3">amacıyla kullanılmaktadır.</p>
              </div>

              {/* Section 2 */}
              <div className="bg-[#1E293B]/40 rounded-2xl p-5 border border-[#1E293B]">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                  <Info size={18} className="text-blue-400" />
                  Fotoğraflarım nereye gidecek?
                </h3>
                <p className="text-[#9AA4B2] text-sm leading-relaxed mb-3">Doğrulama sırasında alınan görüntüler yalnızca güvenlik doğrulaması amacıyla işlenir.</p>
                <ul className="space-y-2 text-[#9AA4B2] text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                    <span>Üçüncü kişilerle paylaşılmaz.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                    <span>Reklam amacıyla kullanılmaz.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                    <span>Kimliğinizi doğrulamak dışında kullanılmaz.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                    <span>Güvenlik politikalarımıza uygun şekilde korunur.</span>
                  </li>
                </ul>
              </div>

              {/* Section 3 */}
              <div className="bg-[#1E293B]/40 rounded-2xl p-5 border border-[#1E293B]">
                <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                  <Clock size={18} className="text-blue-400" />
                  İşlem ne kadar sürer?
                </h3>
                <p className="text-[#9AA4B2] text-sm leading-relaxed">
                  Yaklaşık 1–2 dakika sürer.<br/>
                  Doğrulama tamamlandıktan sonra hesabınızı güvenli şekilde kullanmaya devam edebilirsiniz.
                </p>
              </div>

            </div>

            {/* Bottom Actions */}
            <div className="shrink-0 p-6 bg-[#0B0E14] border-t border-[#1E293B]">
              <div className="flex items-center gap-3 bg-[#1E3A8A]/20 p-3 rounded-xl border border-blue-900/30 mb-5">
                <ShieldCheck size={24} className="text-blue-500 shrink-0" />
                <p className="text-[11px] text-blue-200/80 font-medium leading-relaxed">
                  Bu doğrulama işlemi yalnızca TALKO Güvenlik Merkezi tarafından yürütülmektedir.
                </p>
              </div>
              
              <button 
                onClick={() => setStep('camera')}
                className="w-full py-4 bg-[#2563EB] hover:bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <span>Devam Et</span>
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}

        {step === 'camera' && (
          <div className="flex flex-col h-full bg-[#0B0E14]">
            <div className="pt-12 px-6 pb-6 text-center">
              <h2 className="text-xl font-bold text-white mb-2">Kameraya Bakın</h2>
              <p className="text-sm text-[#9AA4B2]">{cameraError || (isVerifying ? "Doğrulanıyor..." : "Yüzünüzü çerçevenin içine ortalayın.")}</p>
            </div>
            
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="relative w-full max-w-[300px] aspect-[3/4] rounded-full overflow-hidden border-4 border-blue-500/50 shadow-[0_0_50px_rgba(37,99,235,0.2)] bg-[#1E293B] flex items-center justify-center">
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
                    <p className="text-xs font-bold text-[#9AA4B2] animate-pulse">Kamera bekleniyor...</p>
                  </div>
                )}
                {isVerifying && (
                  <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-[2px] flex items-center justify-center z-10">
                    <ShieldCheck size={64} className="text-white animate-pulse" />
                  </div>
                )}
              </div>
            </div>

            <div className="p-6">
              <button 
                onClick={handleClose}
                className="w-full py-4 bg-[#1E293B] hover:bg-gray-800 text-white font-bold rounded-xl transition-all"
              >
                İptal Et
              </button>
            </div>
          </div>
        )}
        
        {step === 'success' && (
          <div className="flex flex-col h-full bg-gradient-to-b from-[#10B981]/20 to-[#0B0E14] items-center justify-center p-6 text-center">
            <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-6 relative">
              <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
              <ShieldCheck size={48} className="text-green-500 relative z-10" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Doğrulama Başarılı!</h2>
            <p className="text-[#9AA4B2] mb-8">Kimliğiniz doğrulandı. Hesabınızı güvenle kullanmaya devam edebilirsiniz.</p>
            <button 
              onClick={handleClose}
              className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg shadow-green-600/20 transition-all active:scale-[0.98]"
            >
              Tamamla
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
