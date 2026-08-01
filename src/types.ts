export type AvatarColor = 'blue' | 'yellow' | 'purple' | 'green' | 'orange' | 'pink';

export interface User {
  id: string;
  talkoNumber: string; // e.g. "+90 850 100 4821"
  username: string;
  email?: string;
  isAdmin?: boolean;
  avatarUrl?: string;
  avatarColor: AvatarColor;
  isOnline: boolean;
  lastSeen: string; // ISO string
  isBanned: boolean;
  banReason?: string;
  isSystemAccount?: boolean; // For TALKO system account
  isAlphanumericSender?: boolean; // For approved companies like TRENDYOL, ZIRAAT
  alphanumericName?: string; // Max 11 chars
  isBusinessAccount?: boolean; // For Talko Business users
  businessTitle?: string; // e.g. "DEVYBUILD"
  spamConvs?: string[]; // Conversation IDs manually marked as spam by user
  notSpamConvs?: string[]; // Conversation IDs manually marked "Spam Değil"
  blockedSenders?: string[]; // Talko numbers or sender names blocked by user
  blockedConvs?: string[]; // Conversation IDs blocked
  settings?: {
    readReceipts: boolean;
    lastSeen: boolean;
    onlineStatus: boolean;
    soundEnabled: boolean;
    notificationsEnabled?: boolean;
  };
}

export const SPAM_KEYWORDS = [
  'bahis',
  'casino',
  'jackpot',
  'yatırım garantisi',
  'ücretsiz para',
  'kredi onayı',
  'tıkla',
  'kazandınız'
];

export const checkIsSpam = (text?: string): boolean => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return SPAM_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
};

export interface FilterResult {
  isBlocked: boolean;
  reasons: string[];
}

export const checkBusinessFilter = (text?: string): FilterResult => {
  if (!text) return { isBlocked: false, reasons: [] };
  const lower = text.toLowerCase();
  const reasons: string[] = [];

  // 1. E-posta adresleri
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i;
  const emailDomains = ['@gmail.com', '@outlook.com', '@hotmail.com', '@yahoo.com', '@icloud.com', '@proton.me', '@protonmail.com'];
  if (emailRegex.test(text) || emailDomains.some(domain => lower.includes(domain))) {
    reasons.push('E-posta adresi içeriyor.');
  }

  // 2. Mesajlaşma uygulamaları
  const messagingApps = ['whatsapp', 'telegram', 'discord', 'signal'];
  if (messagingApps.some(app => lower.includes(app))) {
    reasons.push('Mesajlaşma uygulaması içeriyor.');
  }

  // 3. Sosyal medya
  const socialPlatforms = ['instagram', 'tiktok', 'facebook', 'x.com', 'twitter'];
  if (socialPlatforms.some(platform => lower.includes(platform))) {
    reasons.push('Sosyal medya adresi/platformu içeriyor.');
  }

  // 4. Web siteleri
  const urlRegex = /\b(https?:\/\/|www\.)[^\s]+/i;
  if (urlRegex.test(text) || lower.includes('http://') || lower.includes('https://') || lower.includes('www.')) {
    reasons.push('Dış bağlantı içeriyor.');
  }

  // 5. Telefon numaraları (+90, 05xx, 850, 212, 216 vb.)
  const phonePatterns = [
    /\+90/i,
    /\b0?5\d{2}[\s\d-]{6,10}\b/i,
    /\b05\d{2}\b/i,
    /\b05\d{9}\b/i,
    /\b(850|212|216)\b/i,
    /\b(0850|0212|0216)\b/i,
    /\b\+?90\s?\d{3}\s?\d{3}\s?\d{2}\s?\d{2}\b/i
  ];
  if (phonePatterns.some(pattern => pattern.test(text))) {
    reasons.push('Telefon numarası içeriyor.');
  }

  return {
    isBlocked: reasons.length > 0,
    reasons
  };
};

export const getDisplayName = (user: Partial<User> | null | undefined): string => {
  if (!user) return 'Bilinmeyen Numara';
  if (user.isSystemAccount || user.talkoNumber === 'TALKO') return 'TALKO';
  if (user.isAlphanumericSender && user.alphanumericName) return user.alphanumericName;
  if (user.isBusinessAccount && user.businessTitle) return user.businessTitle;
  return user.talkoNumber || user.username || 'Bilinmeyen Numara';
};

export const isUserOnline = (user: Partial<User> | null | undefined): boolean => {
  if (!user || !user.isOnline) return false;
  if (user.settings?.onlineStatus === false) return false;
  if (!user.lastSeen) return user.isOnline;
  
  const lastSeenMs = new Date(user.lastSeen).getTime();
  if (isNaN(lastSeenMs)) return user.isOnline;

  return (Date.now() - lastSeenMs) < 150000;
};

export type MessageStatus = 'sent' | 'delivered' | 'read';
export type MessageType = 'text' | 'photo' | 'video' | 'audio' | 'document';

export interface Attachment {
  type: MessageType;
  url: string;
  name?: string;
  size?: string;
  duration?: number; // seconds for voice/video
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderNumber: string;
  senderName: string;
  senderAvatarColor?: AvatarColor;
  senderAvatarUrl?: string;
  content: string;
  attachment?: Attachment;
  timestamp: string;
  status: MessageStatus;
  isSystem?: boolean;
  isSpam?: boolean;
}

export interface Conversation {
  id: string;
  participants: string[]; // Talko numbers
  participantUsers: User[];
  lastMessage?: Message;
  unreadCount: Record<string, number>; // talkoNumber -> count
  typingUsers: string[]; // Talko numbers
  updatedAt: string;
  isCorporate?: boolean;
  isSpam?: boolean;
}

export interface BusinessCampaign {
  id: string;
  businessId: string;
  businessTalkoNumber: string;
  senderTitle: string;
  content: string;
  recipientCount: number;
  deliveredCount: number;
  readCount: number;
  spamCount: number;
  blockedCount: number;
  createdAt: string;
  recipients?: string[]; // Talko numbers
  isFilterBlocked?: boolean;
  filterReasons?: string[];
  status?: 'delivered' | 'filter_blocked';
}

export interface AlphanumericApp {
  id: string;
  userId: string;
  userTalkoNumber: string;
  senderName: string; // Max 11 characters
  companyName: string;
  description: string;
  logoUrl?: string;
  email: string;
  website?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  rejectionReason?: string;
}

export interface ChatLog {
  id: string;
  messageId: string;
  conversationId: string;
  senderNumber: string;
  recipientNumber: string;
  content: string;
  timestamp: string;
}

export interface Report {
  id: string;
  reporterNumber: string;
  reportedNumber: string;
  reason: string;
  timestamp: string;
}

export interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalMessages: number;
  bannedUsers: number;
  pendingAlphanumerics: number;
}
