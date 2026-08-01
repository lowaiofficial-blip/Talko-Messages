import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { User as TalkoUser } from './types';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  talkoUser: TalkoUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  talkoUser: null,
  loading: true,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [talkoUser, setTalkoUser] = useState<TalkoUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<number>(0);

  useEffect(() => {
    let unsubDoc: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        unsubDoc = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
          if (docSnap.exists()) {
            setTalkoUser(docSnap.data() as TalkoUser);
          } else {
            setTalkoUser(null);
          }
          setLoading(false);
        });
      } else {
        // Fallback: check localStorage for custom session
        const localUid = localStorage.getItem('talko_session_id');
        if (localUid) {
          unsubDoc = onSnapshot(doc(db, 'users', localUid), (docSnap) => {
            if (docSnap.exists()) {
              const uData = docSnap.data() as TalkoUser;
              setTalkoUser(uData);
              // Create compatible mock user object for currentUser
              setCurrentUser({
                uid: localUid,
                email: uData.email || '',
                displayName: uData.username || '',
                emailVerified: true,
                isAnonymous: false,
                metadata: {},
                providerData: [],
                refreshToken: '',
                tenantId: null,
                delete: async () => {},
                getIdToken: async () => '',
                getIdTokenResult: async () => ({} as any),
                reload: async () => {},
                toJSON: () => ({}),
                phoneNumber: null,
                photoURL: null,
                providerId: 'custom'
              } as unknown as FirebaseUser);
            } else {
              setTalkoUser(null);
              setCurrentUser(null);
              localStorage.removeItem('talko_session_id');
            }
            setLoading(false);
          }, (err) => {
            console.error('Fallback user listener error:', err);
            setLoading(false);
          });
        } else {
          setCurrentUser(null);
          setTalkoUser(null);
          setLoading(false);
        }
      }
    });

    const handleCustomLoginEvent = () => {
      setSessionToken(prev => prev + 1);
    };
    window.addEventListener('talko_session_change', handleCustomLoginEvent);

    return () => {
      unsubscribe();
      if (unsubDoc) unsubDoc();
      window.removeEventListener('talko_session_change', handleCustomLoginEvent);
    };
  }, [sessionToken]);

  const logout = async () => {
    const userToLogout = auth.currentUser || currentUser;
    if (userToLogout) {
      try {
        const userRef = doc(db, 'users', userToLogout.uid);
        await Promise.race([
          setDoc(userRef, { 
            isOnline: false, 
            lastSeen: new Date().toISOString() 
          }, { merge: true }),
          new Promise((resolve) => setTimeout(resolve, 1000))
        ]);
      } catch (err) {
        console.error('Logout offline status error:', err);
      }
    }
    localStorage.removeItem('talko_session_id');
    setTalkoUser(null);
    setCurrentUser(null);
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error('Firebase signout error:', err);
    }
    window.dispatchEvent(new Event('talko_session_change'));
  };

  return (
    <AuthContext.Provider value={{ currentUser, talkoUser, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
