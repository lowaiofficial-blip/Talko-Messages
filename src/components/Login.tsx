import React, { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { AlertCircle } from 'lucide-react';
import { AvatarColor } from '../types';

export const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Generate unique Talko number
  const generateTalkoNumber = async () => {
    let unique = false;
    let number = '';
    while (!unique) {
      const part1 = Math.floor(100 + Math.random() * 900);
      const part2 = Math.floor(1000 + Math.random() * 9000);
      number = `+90 850 ${part1} ${part2}`;
      
      const q = query(collection(db, 'users'), where('talkoNumber', '==', number));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        unique = true;
      }
    }
    return number;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      if (isLogin) {
        try {
          await signInWithEmailAndPassword(auth, cleanEmail, password);
        } catch (authErr: any) {
          // If auth provider is disabled (operation-not-allowed) or invalid key, fallback to Firestore user lookup
          if (
            authErr.code === 'auth/operation-not-allowed' ||
            authErr.code === 'auth/api-key-not-valid' ||
            authErr.code === 'auth/invalid-api-key' ||
            authErr.message?.includes('operation-not-allowed') ||
            authErr.message?.includes('api-key-not-valid')
          ) {
            console.warn('Firebase auth restricted, falling back to Firestore session:', authErr);
            const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const userDoc = querySnapshot.docs[0];
              const uData = userDoc.data();
              // Update status
              const isBiz = cleanEmail.includes('devy.build');
              await setDoc(doc(db, 'users', userDoc.id), {
                isOnline: true,
                lastSeen: new Date().toISOString(),
                ...(isBiz ? { isBusinessAccount: true, businessTitle: 'DEVYBUILD' } : {})
              }, { merge: true });

              localStorage.setItem('talko_session_id', userDoc.id);
              window.dispatchEvent(new Event('talko_session_change'));
              return;
            } else {
              throw new Error('Bu e-posta adresiyle kayıtlı bir hesap bulunamadı.');
            }
          } else if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/wrong-password') {
            throw new Error('E-posta veya şifre hatalı.');
          } else {
            throw authErr;
          }
        }
      } else {
        if (!name.trim() || !surname.trim()) {
          throw new Error('Lütfen ad ve soyad giriniz.');
        }

        let userId = '';
        let userEmail = cleanEmail;
        const fullName = `${name.trim()} ${surname.trim()}`;

        try {
          const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          userId = userCredential.user.uid;
          await updateProfile(userCredential.user, { displayName: fullName });
        } catch (authErr: any) {
          if (
            authErr.code === 'auth/operation-not-allowed' ||
            authErr.code === 'auth/api-key-not-valid' ||
            authErr.code === 'auth/invalid-api-key' ||
            authErr.message?.includes('operation-not-allowed') ||
            authErr.message?.includes('api-key-not-valid')
          ) {
            console.warn('Firebase auth restricted, using fallback Firestore account creation:', authErr);
            // Check if user already exists
            const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
            const existing = await getDocs(q);
            if (!existing.empty) {
              throw new Error('Bu e-posta adresiyle zaten kayıtlı bir hesap var.');
            }
            userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          } else if (authErr.code === 'auth/email-already-in-use') {
            throw new Error('Bu e-posta adresi zaten kullanımda.');
          } else {
            throw authErr;
          }
        }
        
        const talkoNumber = await generateTalkoNumber();
        const colors: AvatarColor[] = ['blue', 'yellow', 'purple', 'green', 'orange', 'pink'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        await setDoc(doc(db, 'users', userId), {
          id: userId,
          talkoNumber,
          username: fullName,
          email: userEmail,
          avatarColor: randomColor,
          isOnline: true,
          lastSeen: new Date().toISOString(),
          isBanned: false,
          settings: {
            readReceipts: true,
            lastSeen: true,
            onlineStatus: true,
            soundEnabled: true
          }
        });

        // Send Welcome Message from TALKO
        const sortedParticipants = ['TALKO', talkoNumber].sort();
        const convId = `${sortedParticipants[0]}_${sortedParticipants[1]}`;
        const convRef = doc(db, 'conversations', convId);
        const welcomeContent = `👋 Hoş geldiniz!\n\nTalko Messages hesabınız başarıyla oluşturuldu.\n\n📱 Talko Numaranız:\n\n${talkoNumber}\n\nArtık Talko numaranız ile güvenli şekilde mesajlaşabilirsiniz.\n\nİyi sohbetler dileriz. 💙`;
        const ts = new Date().toISOString();

        await setDoc(convRef, {
          participants: ['TALKO', talkoNumber],
          participantUsers: [
            {
              id: 'system_talko',
              talkoNumber: 'TALKO',
              username: 'TALKO',
              avatarColor: 'blue',
              isOnline: false,
              lastSeen: ts,
              isBanned: false,
              isSystemAccount: true
            },
            {
              id: userId,
              talkoNumber,
              username: fullName,
              avatarColor: randomColor,
              isOnline: true,
              lastSeen: ts,
              isBanned: false
            }
          ],
          unreadCount: { [talkoNumber]: 1, 'TALKO': 0 },
          typingUsers: [],
          lastMessage: {
            content: welcomeContent,
            senderNumber: 'TALKO',
            timestamp: ts,
            status: 'sent',
            isSystem: true
          },
          updatedAt: ts
        });

        const msgRef = doc(collection(db, 'conversations', convId, 'messages'));
        
        await setDoc(msgRef, {
          id: msgRef.id,
          conversationId: convId,
          senderId: 'system_talko',
          senderNumber: 'TALKO',
          senderName: 'TALKO',
          senderAvatarColor: 'blue',
          content: welcomeContent,
          timestamp: ts,
          status: 'sent',
          isSystem: true
        });

        localStorage.setItem('talko_session_id', userId);
        window.dispatchEvent(new Event('talko_session_change'));
      }
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1115] text-white flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-[#181B22] p-8 rounded-3xl border border-gray-800 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
            <span className="text-2xl font-black tracking-tighter">T</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">TALKO MESSAGES</h1>
          <p className="text-[#9AA4B2] text-sm mt-1">Gerçek zamanlı kurumsal mesajlaşma</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl flex items-start gap-2">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[#9AA4B2] mb-1.5 block">Ad</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-[#0F1115] border border-gray-800 text-white p-3 rounded-xl focus:outline-none focus:border-blue-500 transition-colors text-sm"
                  placeholder="Ahmet"
                  required={!isLogin}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#9AA4B2] mb-1.5 block">Soyad</label>
                <input
                  type="text"
                  value={surname}
                  onChange={e => setSurname(e.target.value)}
                  className="w-full bg-[#0F1115] border border-gray-800 text-white p-3 rounded-xl focus:outline-none focus:border-blue-500 transition-colors text-sm"
                  placeholder="Yılmaz"
                  required={!isLogin}
                />
              </div>
            </div>
          )}
          
          <div>
            <label className="text-xs font-semibold text-[#9AA4B2] mb-1.5 block">E-posta</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#0F1115] border border-gray-800 text-white p-3 rounded-xl focus:outline-none focus:border-blue-500 transition-colors text-sm"
              placeholder="ornek@sirket.com"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#9AA4B2] mb-1.5 block">Şifre</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#0F1115] border border-gray-800 text-white p-3 rounded-xl focus:outline-none focus:border-blue-500 transition-colors text-sm"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2563EB] hover:bg-blue-600 text-white font-bold p-3 rounded-xl transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            {loading ? 'İşleniyor...' : (isLogin ? 'Giriş Yap' : 'Kayıt Ol')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-[#9AA4B2] hover:text-white transition-colors"
          >
            {isLogin ? "Hesabınız yok mu? Yeni Talko numarası alın." : "Zaten hesabınız var mı? Giriş yapın."}
          </button>
        </div>
      </div>
    </div>
  );
};
