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

export const normalizeText = (text: string): string => {
  if (!text) return '';
  return text.toLowerCase().replace(/[\s\._\-\+\*\/\:\;\,\\\|\@\#\$\%\^\&\(\)\[\]\{\}\?\!\<\>]/g, '');
};

export const checkIsSpam = (text?: string): boolean => {
  if (!text) return false;
  const lower = text.toLowerCase();
  const normalized = normalizeText(text);

  if (SPAM_KEYWORDS.some(kw => lower.includes(kw) || normalized.includes(normalizeText(kw)))) {
    return true;
  }

  return false;
};

export interface FilterResult {
  isBlocked: boolean;
  reasons: string[];
}

export const checkBusinessFilter = (text?: string): FilterResult => {
  if (!text) return { isBlocked: false, reasons: [] };
  const lower = text.toLowerCase();
  const normalized = normalizeText(text);
  const reasons: string[] = [];

  // 1. E-posta adresleri (gmail, proton, outlook, hotmail, yahoo, icloud)
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i;
  const emailKeywords = ['gmail', 'proton', 'outlook', 'hotmail', 'yahoo', 'icloud', 'protonmail'];
  if (
    emailRegex.test(text) || 
    emailKeywords.some(kw => normalized.includes(kw))
  ) {
    reasons.push('E-posta adresi içeriyor (Gmail, Proton, Outlook vb.).');
  }

  // 2. Mesajlaşma uygulamaları (whatsapp, telegram, discord, signal)
  const messagingApps = ['whatsapp', 'telegram', 'discord', 'signal'];
  if (messagingApps.some(app => normalized.includes(app))) {
    reasons.push('Mesajlaşma uygulaması yönlendirmesi içeriyor (WhatsApp, Telegram vb.).');
  }

  // 3. Sosyal medya (instagram, tiktok, facebook, xcom, twitter)
  const socialPlatforms = ['instagram', 'tiktok', 'facebook', 'xcom', 'twitter'];
  if (socialPlatforms.some(platform => normalized.includes(platform))) {
    reasons.push('Sosyal medya adresi/platformu içeriyor (Instagram, TikTok vb.).');
  }

  // 4. Web siteleri (http, https, www, discord.gg, vb.)
  const urlRegex = /\b(https?:\/\/|www\.)[^\s]+/i;
  if (
    urlRegex.test(text) || 
    normalized.includes('http') || 
    normalized.includes('https') || 
    normalized.includes('www') ||
    normalized.includes('discordgg')
  ) {
    reasons.push('Dış bağlantı / Web sitesi adresi içeriyor.');
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
  const normalizedPhoneRegex = /(05\d{9}|905\d{9}|0850\d{7}|850\d{7}|0212\d{7}|0216\d{7})/;

  if (phonePatterns.some(pattern => pattern.test(text)) || normalizedPhoneRegex.test(normalized)) {
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
