import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { User, Message, Conversation, AlphanumericApp, ChatLog, Report, AvatarColor } from './src/types';

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = Number(process.env.PORT) || 3000;

// SSE Clients for real-time updates across sessions
const sseClients: Response[] = [];

function broadcastSSE(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((res) => {
    try {
      res.write(payload);
    } catch {
      // client disconnected
    }
  });
}

// Memory Database
const AVATAR_COLORS: AvatarColor[] = ['blue', 'yellow', 'purple', 'green', 'orange', 'pink'];

// System Account TALKO
const talkoSystemUser: User = {
  id: 'talko-system-001',
  talkoNumber: '+90 850 100 0000',
  username: 'TALKO',
  avatarColor: 'blue',
  isOnline: true,
  lastSeen: new Date().toISOString(),
  isBanned: false,
  isSystemAccount: true,
};

// Demo Users
let users: User[] = [
  talkoSystemUser,
  {
    id: 'user-001',
    talkoNumber: '+90 850 100 4821',
    username: 'Zeynep Kaya',
    avatarColor: 'pink',
    isOnline: true,
    lastSeen: new Date().toISOString(),
    isBanned: false,
  },
  {
    id: 'user-002',
    talkoNumber: '+90 850 100 7315',
    username: 'Ahmet Demir',
    avatarColor: 'green',
    isOnline: true,
    lastSeen: new Date().toISOString(),
    isBanned: false,
  },
  {
    id: 'user-003',
    talkoNumber: '+90 850 101 2048',
    username: 'Mehmet Arslan',
    avatarColor: 'orange',
    isOnline: false,
    lastSeen: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    isBanned: false,
  },
  {
    id: 'user-corp-001',
    talkoNumber: 'TRENDYOL',
    username: 'TRENDYOL',
    avatarColor: 'purple',
    isOnline: true,
    lastSeen: new Date().toISOString(),
    isBanned: false,
    isAlphanumericSender: true,
    alphanumericName: 'TRENDYOL',
  },
];

let conversations: Conversation[] = [];
let messages: Message[] = [];
let alphanumericApps: AlphanumericApp[] = [];
let chatLogs: ChatLog[] = [];
let reports: Report[] = [];

// Helper: generate unique Talko number "+90 850 10X XXXX"
function generateTalkoNumber(): string {
  let num = '';
  let exists = true;
  while (exists) {
    const range = Math.floor(100 + Math.random() * 900); // 100 to 999
    const suffix = Math.floor(1000 + Math.random() * 9000); // 1000 to 9999
    num = `+90 850 ${range} ${suffix}`;
    exists = users.some((u) => u.talkoNumber === num);
  }
  return num;
}

// Seed initial system conversations & welcome messages
function initSeedData() {
  const zeynep = users.find((u) => u.talkoNumber === '+90 850 100 4821')!;
  const ahmet = users.find((u) => u.talkoNumber === '+90 850 100 7315')!;

  // Conversation 1: TALKO System welcome for Zeynep
  const conv1Id = 'conv-talko-zeynep';
  const msg1: Message = {
    id: 'msg-001',
    conversationId: conv1Id,
    senderId: talkoSystemUser.id,
    senderNumber: talkoSystemUser.talkoNumber,
    senderName: talkoSystemUser.username,
    senderAvatarColor: 'blue',
    content: `Hoş geldiniz! Talko numaranız oluşturuldu: ${zeynep.talkoNumber}. Güvenli ve yüksek hızlı mesajlaşmanın tadını çıkarın.`,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    status: 'read',
    isSystem: true,
  };

  // Conversation 2: Zeynep & Ahmet
  const conv2Id = 'conv-zeynep-ahmet';
  const msg2: Message = {
    id: 'msg-002',
    conversationId: conv2Id,
    senderId: ahmet.id,
    senderNumber: ahmet.talkoNumber,
    senderName: ahmet.username,
    senderAvatarColor: ahmet.avatarColor,
    content: 'Merhaba Zeynep! Talko Messages Ultra Edition harika çalışıyor, yeni numaram ile ulaştım.',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    status: 'read',
  };

  const msg3: Message = {
    id: 'msg-003',
    conversationId: conv2Id,
    senderId: zeynep.id,
    senderNumber: zeynep.talkoNumber,
    senderName: zeynep.username,
    senderAvatarColor: zeynep.avatarColor,
    content: 'Selam Ahmet, harika! Google Messages hızında çalışması çok etkileyici.',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    status: 'read',
  };

  // Conversation 3: TRENDYOL Alphanumeric SMS
  const conv3Id = 'conv-trendyol-zeynep';
  const trendyol = users.find((u) => u.talkoNumber === 'TRENDYOL')!;
  const msg4: Message = {
    id: 'msg-004',
    conversationId: conv3Id,
    senderId: trendyol.id,
    senderNumber: 'TRENDYOL',
    senderName: 'TRENDYOL',
    senderAvatarColor: 'purple',
    content: 'Siparişiniz yola çıktı! Kargo takip kodunuz: #TLK-889412. Bizi tercih ettiğiniz için teşekkür ederiz.',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    status: 'read',
  };

  messages = [msg1, msg2, msg3, msg4];

  conversations = [
    {
      id: conv1Id,
      participants: [talkoSystemUser.talkoNumber, zeynep.talkoNumber],
      participantUsers: [talkoSystemUser, zeynep],
      lastMessage: msg1,
      unreadCount: { [zeynep.talkoNumber]: 0 },
      typingUsers: [],
      updatedAt: msg1.timestamp,
    },
    {
      id: conv2Id,
      participants: [zeynep.talkoNumber, ahmet.talkoNumber],
      participantUsers: [zeynep, ahmet],
      lastMessage: msg3,
      unreadCount: { [zeynep.talkoNumber]: 0, [ahmet.talkoNumber]: 0 },
      typingUsers: [],
      updatedAt: msg3.timestamp,
    },
    {
      id: conv3Id,
      participants: ['TRENDYOL', zeynep.talkoNumber],
      participantUsers: [trendyol, zeynep],
      lastMessage: msg4,
      unreadCount: { [zeynep.talkoNumber]: 0 },
      typingUsers: [],
      updatedAt: msg4.timestamp,
    },
  ];

  // Seed sample Alphanumeric Applications for Admin
  alphanumericApps = [
    {
      id: 'alpha-app-101',
      userId: zeynep.id,
      userTalkoNumber: zeynep.talkoNumber,
      senderName: 'HEPSIBURADA',
      companyName: 'D-Market Elektronik A.Ş.',
      description: 'E-Ticaret müşteri sipariş ve kampanya bilgilendirmeleri',
      logoUrl: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=100&auto=format&fit=crop&q=80',
      email: 'bilgi@hepsiburada.com',
      website: 'https://hepsiburada.com',
      status: 'pending',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    },
    {
      id: 'alpha-app-102',
      userId: ahmet.id,
      userTalkoNumber: ahmet.talkoNumber,
      senderName: 'ZIRAAT',
      companyName: 'T.C. Ziraat Bankası A.Ş.',
      description: 'Bankacılık şifre ve tek kullanımlık kod bildirimleri',
      email: 'iletisim@ziraatbank.com.tr',
      status: 'approved',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
  ];

  // Initial Chat Logs
  chatLogs = messages.map((m) => ({
    id: `log-${m.id}`,
    messageId: m.id,
    conversationId: m.conversationId,
    senderNumber: m.senderNumber,
    recipientNumber: m.conversationId.includes('ahmet') ? ahmet.talkoNumber : zeynep.talkoNumber,
    content: m.content,
    timestamp: m.timestamp,
  }));
}

initSeedData();

// --- SSE Realtime Stream Endpoint ---
app.get('/api/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.push(res);

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// --- User & Auth APIs ---
// Create or Register Auto User
app.post('/api/users/register', (req: Request, res: Response) => {
  const { username } = req.body;
  const name = (username || '').trim() || `Kullanıcı ${Math.floor(100 + Math.random() * 900)}`;

  const talkoNumber = generateTalkoNumber();
  const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  const newUser: User = {
    id: `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    talkoNumber,
    username: name,
    avatarColor: randomColor,
    isOnline: true,
    lastSeen: new Date().toISOString(),
    isBanned: false,
  };

  users.push(newUser);

  // Send TALKO System Welcome Message to this new user
  const systemConvId = `conv-talko-${newUser.id}`;
  const welcomeMsg: Message = {
    id: `msg-welcome-${Date.now()}`,
    conversationId: systemConvId,
    senderId: talkoSystemUser.id,
    senderNumber: talkoSystemUser.talkoNumber,
    senderName: talkoSystemUser.username,
    senderAvatarColor: 'blue',
    content: `Hoş geldiniz! Talko numaranız tanımlandı: ${newUser.talkoNumber}. Güvenlik kodunuz: ${Math.floor(100000 + Math.random() * 900000)}. Keyifli sohbetler dileriz!`,
    timestamp: new Date().toISOString(),
    status: 'read',
    isSystem: true,
  };

  messages.push(welcomeMsg);
  conversations.push({
    id: systemConvId,
    participants: [talkoSystemUser.talkoNumber, newUser.talkoNumber],
    participantUsers: [talkoSystemUser, newUser],
    lastMessage: welcomeMsg,
    unreadCount: { [newUser.talkoNumber]: 1 },
    typingUsers: [],
    updatedAt: welcomeMsg.timestamp,
  });

  broadcastSSE('user_created', newUser);
  res.json({ success: true, user: newUser });
});

// Get User Profile or List Users
app.get('/api/users', (req: Request, res: Response) => {
  const talkoNumber = req.query.number as string;
  if (talkoNumber) {
    const user = users.find((u) => u.talkoNumber.replace(/\s+/g, '') === talkoNumber.replace(/\s+/g, ''));
    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    return res.json({ user });
  }
  res.json({ users: users.filter((u) => !u.isSystemAccount && !u.isAlphanumericSender) });
});

// Update User Profile
app.patch('/api/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const user = users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

  if (req.body.username) user.username = req.body.username;
  if (req.body.avatarColor) user.avatarColor = req.body.avatarColor;
  if (req.body.avatarUrl !== undefined) user.avatarUrl = req.body.avatarUrl;
  if (req.body.isOnline !== undefined) {
    user.isOnline = req.body.isOnline;
    user.lastSeen = new Date().toISOString();
  }

  broadcastSSE('user_updated', user);
  res.json({ success: true, user });
});

// --- Chat & Messaging APIs ---
// Get Conversations for User
app.get('/api/conversations', (req: Request, res: Response) => {
  const userNumber = req.query.userNumber as string;
  if (!userNumber) return res.status(400).json({ error: 'userNumber gerekli' });

  const cleanNum = userNumber.replace(/\s+/g, '');
  const userConvs = conversations.filter((c) =>
    c.participants.some((p) => p.replace(/\s+/g, '') === cleanNum)
  );

  res.json({ conversations: userConvs });
});

// Get or Create Conversation with a Talko Number
app.post('/api/conversations/find-or-create', (req: Request, res: Response) => {
  const { currentNumber, targetNumber } = req.body;
  if (!currentNumber || !targetNumber) {
    return res.status(400).json({ error: 'Numaralar eksik' });
  }

  const cleanCurrent = currentNumber.replace(/\s+/g, '');
  const cleanTarget = targetNumber.replace(/\s+/g, '');

  const targetUser = users.find((u) => u.talkoNumber.replace(/\s+/g, '') === cleanTarget);
  if (!targetUser) {
    return res.status(404).json({ error: 'Bu Talko numarası bulunamadı.' });
  }

  const currentUser = users.find((u) => u.talkoNumber.replace(/\s+/g, '') === cleanCurrent);
  if (!currentUser) {
    return res.status(404).json({ error: 'Mevcut kullanıcı oturumu geçersiz.' });
  }

  // Find existing
  let conv = conversations.find(
    (c) =>
      c.participants.some((p) => p.replace(/\s+/g, '') === cleanCurrent) &&
      c.participants.some((p) => p.replace(/\s+/g, '') === cleanTarget)
  );

  if (!conv) {
    conv = {
      id: `conv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      participants: [currentUser.talkoNumber, targetUser.talkoNumber],
      participantUsers: [currentUser, targetUser],
      unreadCount: { [currentUser.talkoNumber]: 0, [targetUser.talkoNumber]: 0 },
      typingUsers: [],
      updatedAt: new Date().toISOString(),
    };
    conversations.push(conv);
    broadcastSSE('conversation_created', conv);
  }

  res.json({ conversation: conv, targetUser });
});

// Get Messages for Conversation
app.get('/api/messages/:conversationId', (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const userNumber = req.query.userNumber as string;

  const convMessages = messages.filter((m) => m.conversationId === conversationId);

  // Auto update status to read if user is recipient
  if (userNumber) {
    const cleanUser = userNumber.replace(/\s+/g, '');
    let updated = false;
    convMessages.forEach((m) => {
      if (m.senderNumber.replace(/\s+/g, '') !== cleanUser && m.status !== 'read') {
        m.status = 'read';
        updated = true;
      }
    });

    const conv = conversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.unreadCount[userNumber] = 0;
    }

    if (updated) {
      broadcastSSE('messages_read', { conversationId });
    }
  }

  res.json({ messages: convMessages });
});

// Send Message
app.post('/api/messages', (req: Request, res: Response) => {
  const { conversationId, senderNumber, content, attachment } = req.body;

  const sender = users.find((u) => u.talkoNumber.replace(/\s+/g, '') === senderNumber.replace(/\s+/g, ''));
  if (!sender) return res.status(404).json({ error: 'Gönderici bulunamadı' });

  if (sender.isBanned) {
    return res.status(403).json({ error: 'Hesabınız engellenmiştir. Mesaj gönderemezsiniz.' });
  }

  const conv = conversations.find((c) => c.id === conversationId);
  if (!conv) return res.status(404).json({ error: 'Sohbet bulunamadı' });

  // Disallow sending messages to TALKO System Account
  if (conv.participants.includes(talkoSystemUser.talkoNumber) && sender.talkoNumber !== talkoSystemUser.talkoNumber) {
    return res.status(400).json({ error: 'TALKO sistem hesabına mesaj gönderilemez.' });
  }

  const newMsg: Message = {
    id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    conversationId,
    senderId: sender.id,
    senderNumber: sender.talkoNumber,
    senderName: sender.username,
    senderAvatarColor: sender.avatarColor,
    senderAvatarUrl: sender.avatarUrl,
    content: content || '',
    attachment: attachment || undefined,
    timestamp: new Date().toISOString(),
    status: 'sent', // Progression: sent -> delivered -> read
  };

  messages.push(newMsg);

  // Progress status to 'delivered' immediately for online participants
  setTimeout(() => {
    newMsg.status = 'delivered';
    broadcastSSE('message_status_update', { messageId: newMsg.id, status: 'delivered' });
  }, 400);

  // Update conversation
  conv.lastMessage = newMsg;
  conv.updatedAt = newMsg.timestamp;

  // Increment unread count for other participants
  conv.participants.forEach((p) => {
    if (p.replace(/\s+/g, '') !== senderNumber.replace(/\s+/g, '')) {
      conv.unreadCount[p] = (conv.unreadCount[p] || 0) + 1;
    }
  });

  // Log message for Admin Chat Logs
  const recipient = conv.participants.find((p) => p.replace(/\s+/g, '') !== senderNumber.replace(/\s+/g, '')) || 'BroadCast';
  chatLogs.unshift({
    id: `log-${newMsg.id}`,
    messageId: newMsg.id,
    conversationId,
    senderNumber: sender.talkoNumber,
    recipientNumber: recipient,
    content: content || (attachment ? `[Medya: ${attachment.type}]` : ''),
    timestamp: newMsg.timestamp,
  });

  broadcastSSE('new_message', { conversationId, message: newMsg });

  // Simulated auto-reply for demo contact if chatting with Ahmet or Zeynep
  const otherParticipantNumber = conv.participants.find(
    (p) => p.replace(/\s+/g, '') !== senderNumber.replace(/\s+/g, '')
  );
  if (otherParticipantNumber) {
    const recipientUser = users.find((u) => u.talkoNumber.replace(/\s+/g, '') === otherParticipantNumber.replace(/\s+/g, ''));
    if (recipientUser && (recipientUser.talkoNumber === '+90 850 100 7315' || recipientUser.talkoNumber === '+90 850 100 4821')) {
      // Simulate typing indicator
      setTimeout(() => {
        conv.typingUsers = [recipientUser.talkoNumber];
        broadcastSSE('typing_update', { conversationId, typingUsers: conv.typingUsers });
      }, 1000);

      // Send automated smart response
      setTimeout(() => {
        conv.typingUsers = [];
        broadcastSSE('typing_update', { conversationId, typingUsers: [] });

        const replies = [
          'Mesajınızı aldım, harika bir Talko deneyimi!',
          'Talko numarası ile iletişim kurmak gerçekten güvenli ve hızlı hissettiriyor.',
          'Anlaşıldı, hemen inceleyip geri dönüyorum.',
          'Süper! Google Messages tarzı sade arayüz mükemmel oturmuş.',
        ];
        const replyText = replies[Math.floor(Math.random() * replies.length)];

        const autoMsg: Message = {
          id: `msg-auto-${Date.now()}`,
          conversationId,
          senderId: recipientUser.id,
          senderNumber: recipientUser.talkoNumber,
          senderName: recipientUser.username,
          senderAvatarColor: recipientUser.avatarColor,
          content: replyText,
          timestamp: new Date().toISOString(),
          status: 'sent',
        };

        messages.push(autoMsg);
        conv.lastMessage = autoMsg;
        conv.updatedAt = autoMsg.timestamp;
        conv.unreadCount[sender.talkoNumber] = (conv.unreadCount[sender.talkoNumber] || 0) + 1;

        broadcastSSE('new_message', { conversationId, message: autoMsg });

        setTimeout(() => {
          autoMsg.status = 'delivered';
          broadcastSSE('message_status_update', { messageId: autoMsg.id, status: 'delivered' });
        }, 300);
      }, 3500);
    }
  }

  res.json({ success: true, message: newMsg });
});

// Update Typing status
app.post('/api/chats/typing', (req: Request, res: Response) => {
  const { conversationId, userNumber, isTyping } = req.body;
  const conv = conversations.find((c) => c.id === conversationId);
  if (!conv) return res.status(404).json({ error: 'Sohbet bulunamadı' });

  if (isTyping) {
    if (!conv.typingUsers.includes(userNumber)) conv.typingUsers.push(userNumber);
  } else {
    conv.typingUsers = conv.typingUsers.filter((u) => u !== userNumber);
  }

  broadcastSSE('typing_update', { conversationId, typingUsers: conv.typingUsers });
  res.json({ success: true });
});

// Report User
app.post('/api/reports', (req: Request, res: Response) => {
  const { reporterNumber, reportedNumber, reason } = req.body;
  const newReport: Report = {
    id: `report-${Date.now()}`,
    reporterNumber,
    reportedNumber,
    reason: reason || 'Kullanıcı ihlali bildirildi.',
    timestamp: new Date().toISOString(),
  };
  reports.push(newReport);
  res.json({ success: true, message: 'Şikayetiniz modere edilmek üzere yöneticilere iletildi.' });
});

// --- Alphanumeric Application APIs ---
// Submit Alphanumeric request
app.post('/api/alphanumeric/apply', (req: Request, res: Response) => {
  const { userTalkoNumber, senderName, companyName, description, logoUrl, email, website } = req.body;

  if (!senderName || senderName.length > 11) {
    return res.status(400).json({ error: 'Gönderici adı en fazla 11 karakter olabilir.' });
  }

  const newApp: AlphanumericApp = {
    id: `alpha-${Date.now()}`,
    userId: `user-${Date.now()}`,
    userTalkoNumber,
    senderName: senderName.toUpperCase().trim(),
    companyName,
    description,
    logoUrl,
    email,
    website,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  alphanumericApps.unshift(newApp);
  broadcastSSE('alphanumeric_new', newApp);
  res.json({ success: true, application: newApp });
});

// Get user alphanumeric applications
app.get('/api/alphanumeric/my', (req: Request, res: Response) => {
  const userNumber = req.query.userNumber as string;
  const apps = alphanumericApps.filter((a) => a.userTalkoNumber === userNumber);
  res.json({ applications: apps });
});

// --- Admin Panel APIs (`/#/admin`) ---
// Admin Dashboard Stats
app.get('/api/admin/stats', (req: Request, res: Response) => {
  const totalUsers = users.filter((u) => !u.isSystemAccount && !u.isAlphanumericSender).length;
  const activeUsers = users.filter((u) => u.isOnline).length;
  const totalMessages = messages.length;
  const bannedUsers = users.filter((u) => u.isBanned).length;
  const pendingAlphanumerics = alphanumericApps.filter((a) => a.status === 'pending').length;

  res.json({
    stats: {
      totalUsers,
      activeUsers,
      totalMessages,
      bannedUsers,
      pendingAlphanumerics,
    },
  });
});

// Admin User Ban / Unban / Delete
app.post('/api/admin/ban', (req: Request, res: Response) => {
  const { talkoNumber, ban, reason } = req.body;
  const user = users.find((u) => u.talkoNumber.replace(/\s+/g, '') === talkoNumber.replace(/\s+/g, ''));
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

  user.isBanned = ban;
  user.banReason = ban ? reason || 'Admin tarafından kural ihlali nedeniyle engellendi.' : undefined;
  if (ban) user.isOnline = false;

  broadcastSSE('user_updated', user);
  res.json({ success: true, user });
});

app.delete('/api/admin/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = users.findIndex((u) => u.id === id);
  if (idx !== -1) {
    users.splice(idx, 1);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }
});

// Admin Alphanumeric Management
app.get('/api/admin/alphanumerics', (req: Request, res: Response) => {
  res.json({ applications: alphanumericApps });
});

app.post('/api/admin/alphanumerics/action', (req: Request, res: Response) => {
  const { appId, action, rejectionReason } = req.body; // action: 'approve' | 'reject'
  const appItem = alphanumericApps.find((a) => a.id === appId);
  if (!appItem) return res.status(404).json({ error: 'Başvuru bulunamadı' });

  if (action === 'approve') {
    appItem.status = 'approved';

    // Create Corporate User
    const corpUser: User = {
      id: `user-corp-${Date.now()}`,
      talkoNumber: appItem.senderName,
      username: appItem.companyName,
      avatarColor: 'purple',
      avatarUrl: appItem.logoUrl,
      isOnline: true,
      lastSeen: new Date().toISOString(),
      isBanned: false,
      isAlphanumericSender: true,
      alphanumericName: appItem.senderName,
    };
    users.push(corpUser);

    // Send TALKO result notification to applicant
    const userConv = conversations.find(
      (c) => c.participants.includes(appItem.userTalkoNumber) && c.participants.includes(talkoSystemUser.talkoNumber)
    );
    if (userConv) {
      const sysMsg: Message = {
        id: `msg-sys-${Date.now()}`,
        conversationId: userConv.id,
        senderId: talkoSystemUser.id,
        senderNumber: talkoSystemUser.talkoNumber,
        senderName: 'TALKO',
        senderAvatarColor: 'blue',
        content: `Tebrikler! ${appItem.senderName} gönderici adı başvurunuz onaylandı. Artık şirket adınızla mesaj gönderebilirsiniz.`,
        timestamp: new Date().toISOString(),
        status: 'read',
        isSystem: true,
      };
      messages.push(sysMsg);
      userConv.lastMessage = sysMsg;
      userConv.updatedAt = sysMsg.timestamp;
      broadcastSSE('new_message', { conversationId: userConv.id, message: sysMsg });
    }
  } else if (action === 'reject') {
    appItem.status = 'rejected';
    appItem.rejectionReason = rejectionReason || 'Belgeler veya başvuru şartları yetersiz görüldü.';

    // Send TALKO notification
    const userConv = conversations.find(
      (c) => c.participants.includes(appItem.userTalkoNumber) && c.participants.includes(talkoSystemUser.talkoNumber)
    );
    if (userConv) {
      const sysMsg: Message = {
        id: `msg-sys-${Date.now()}`,
        conversationId: userConv.id,
        senderId: talkoSystemUser.id,
        senderNumber: talkoSystemUser.talkoNumber,
        senderName: 'TALKO',
        senderAvatarColor: 'blue',
        content: `Bilgilendirme: ${appItem.senderName} gönderici adı başvurunuz reddedildi. Neden: ${appItem.rejectionReason}`,
        timestamp: new Date().toISOString(),
        status: 'read',
        isSystem: true,
      };
      messages.push(sysMsg);
      userConv.lastMessage = sysMsg;
      userConv.updatedAt = sysMsg.timestamp;
      broadcastSSE('new_message', { conversationId: userConv.id, message: sysMsg });
    }
  }

  broadcastSSE('alphanumeric_updated', appItem);
  res.json({ success: true, application: appItem });
});

// Admin Chat Logs
app.get('/api/admin/chat-logs', (req: Request, res: Response) => {
  const query = (req.query.query as string || '').toLowerCase().trim();
  let filtered = [...chatLogs];

  if (query) {
    filtered = filtered.filter(
      (log) =>
        log.senderNumber.toLowerCase().includes(query) ||
        log.recipientNumber.toLowerCase().includes(query) ||
        log.content.toLowerCase().includes(query)
    );
  }

  res.json({ chatLogs: filtered });
});

// Admin TALKO Broadcast Announcement
app.post('/api/admin/broadcast', (req: Request, res: Response) => {
  const { title, messageContent } = req.body;
  if (!messageContent) return res.status(400).json({ error: 'Duyuru metni boş olamaz.' });

  const broadcastText = `📢 [TALKO DUYURU] ${title ? title + ': ' : ''}${messageContent}`;

  // Broadcast to all user conversations with TALKO
  const realUsers = users.filter((u) => !u.isSystemAccount && !u.isAlphanumericSender);

  realUsers.forEach((user) => {
    let conv = conversations.find(
      (c) => c.participants.includes(user.talkoNumber) && c.participants.includes(talkoSystemUser.talkoNumber)
    );
    if (!conv) {
      conv = {
        id: `conv-talko-${user.id}`,
        participants: [talkoSystemUser.talkoNumber, user.talkoNumber],
        participantUsers: [talkoSystemUser, user],
        unreadCount: {},
        typingUsers: [],
        updatedAt: new Date().toISOString(),
      };
      conversations.push(conv);
    }

    const sysMsg: Message = {
      id: `msg-bc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      conversationId: conv.id,
      senderId: talkoSystemUser.id,
      senderNumber: talkoSystemUser.talkoNumber,
      senderName: 'TALKO',
      senderAvatarColor: 'blue',
      content: broadcastText,
      timestamp: new Date().toISOString(),
      status: 'read',
      isSystem: true,
    };

    messages.push(sysMsg);
    conv.lastMessage = sysMsg;
    conv.updatedAt = sysMsg.timestamp;
    conv.unreadCount[user.talkoNumber] = (conv.unreadCount[user.talkoNumber] || 0) + 1;

    broadcastSSE('new_message', { conversationId: conv.id, message: sysMsg });
  });

  res.json({ success: true, count: realUsers.length });
});

// --- Vite Middleware Server Setup ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Talko Messages backend running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
