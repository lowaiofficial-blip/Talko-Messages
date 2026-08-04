import { db } from './firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

export const SILHOUETTE_AVATAR = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0MDAgNDAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2MzY2RkNSIvPjxjaXJjbGUgY3g9IjIwMCIgY3k9IjE0OCIgcj0iNzIiIGZpbGw9IiNmZmZmZmYiLz48cGF0aCBmaWxsPSIjZmZmZmZmIiBkPSJNMjAwIDI4MEMyNjAgMjM0IDMyMCAyNjUgMzQyIDM0NUMzNDUgMzYwIDM0NSA0MDAgMzQ1IDQwMEw1NSA0MDBDNTUgNDAwIDU1IDM2MCA1OCAzNDVDODAgMjY1IDE0MCAyMzAgMjAwIDI4MFoiLz48L3N2Zz4=";

export const DEFAULT_USERS = [
  {
    id: 'user_8829407',
    talkoNumber: '+90 850 882 9407',
    username: 'Talko Kullanıcısı',
    avatarUrl: SILHOUETTE_AVATAR,
    avatarColor: 'blue' as const,
    isOnline: true,
    lastSeen: new Date().toISOString(),
    isBanned: false,
  },
  {
    id: 'user-001',
    talkoNumber: '+90 850 100 4821',
    username: 'Zeynep Kaya',
    avatarColor: 'pink' as const,
    isOnline: true,
    lastSeen: new Date().toISOString(),
    isBanned: false,
  },
  {
    id: 'user-002',
    talkoNumber: '+90 850 100 7315',
    username: 'Ahmet Demir',
    avatarColor: 'green' as const,
    isOnline: true,
    lastSeen: new Date().toISOString(),
    isBanned: false,
  },
  {
    id: 'user-003',
    talkoNumber: '+90 850 101 2048',
    username: 'Mehmet Arslan',
    avatarColor: 'orange' as const,
    isOnline: false,
    lastSeen: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    isBanned: false,
  },
  {
    id: 'user-corp-001',
    talkoNumber: 'TRENDYOL',
    username: 'TRENDYOL',
    avatarColor: 'purple' as const,
    isOnline: true,
    lastSeen: new Date().toISOString(),
    isBanned: false,
    isAlphanumericSender: true,
    alphanumericName: 'TRENDYOL',
  },
];

export const seedDefaultUsers = async () => {
  try {
    for (const u of DEFAULT_USERS) {
      const userRef = doc(db, 'users', u.id);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, u);
      } else {
        if (u.talkoNumber === '+90 850 882 9407') {
          await setDoc(userRef, { avatarUrl: SILHOUETTE_AVATAR, username: u.username }, { merge: true });
        }
      }
    }
    // Also update any logged-in user with +90 850 882 9407
    const q = query(collection(db, 'users'), where('talkoNumber', '==', '+90 850 882 9407'));
    const matched = await getDocs(q);
    matched.forEach(async (docSnap) => {
      await setDoc(doc(db, 'users', docSnap.id), { avatarUrl: SILHOUETTE_AVATAR }, { merge: true });
    });
  } catch (err) {
    console.error('Seed users error:', err);
  }
};
