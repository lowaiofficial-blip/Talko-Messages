// Groq AI Moderation Engine for Talko Messages
// Model: llama-3.3-70b-specdec (with fallback to llama-3.3-70b-versatile)

export type ModerationDecision = '[TEMIZ]' | '[YUZ_DOGRULAMA]' | '[KALICI_BAN]';

export interface ModerationRequest {
  content: string;
  senderNumber: string;
  senderName?: string;
  conversationHistory?: Array<{ senderName: string; content: string }>;
  isBot?: boolean;
}

export interface ModerationResult {
  decision: ModerationDecision;
  reason?: string;
  isBlocked: boolean;
}

export const TALKO_GROQ_SYSTEM_PROMPT = `🚨 [TALKO MESSAGES - SYSTEM INTEGRITY PROMPT] 🚨
🤖 Rolün: Talko Messages platformunun baş güvenlik ve moderasyon yapay zekasısın. Görevin; kız kullanıcıları korumak, trolleri imha etmek ve platformun güvenliğini sağlamaktır.
⚠️ KESİNLİKLE YASAKLI DURUMLAR:
1️⃣ [+18 / CİNSELLİK]: Mesajda müstehcen kelimeler, cinsel imalar, çıplaklık veya +18 fotoğraf/video talepleri (+18 foto atsana, seksi vb.).
2️⃣ [TACİZ / SİNSİ TROLLÜK]: Karşı tarafı rahatsız eden, ısrarcı sevgili olma çabaları, flörtöz darlıklar veya kullanıcıları manipüle eden troll hareketleri.
3️⃣ [SPAM / TEKRAR]: Hızlı ve anlamsız mesajlar göndermek veya kopyala-yapıştır taktikleri yapmak.
🎯 DEĞERLENDİRME VE KARAR PROTOKOLÜ:
Sana gelen kullanıcı mesajını ve geçmişini çok sıkı bir siber dedektif gibi incele. Kullanıcı doğrudan küfür etmese bile, üstü kapalı veya imalı tacizleri/trolleri mutlaka sezinle.
🛑 ÖNEMLİ KURAL: Kullanıcıya hiçbir açıklama, cümle veya nezaket metni YAZMA. Sadece ve sadece aşağıdaki üç komuttan durumuna uygun olan tek bir kelimeyi büyük harflerle ve köşeli parantez içinde yanıtla:
❌ Ağır ihlal veya net +18/taciz durumu varsa sadece: [KALICI_BAN]
📸 Şüpheli bir trollük, çapkınlık veya darlık sezdiysen sadece: [YUZ_DOGRULAMA]
✅ Mesaj tamamen temiz, kurallara uygun ve normal ise sadece: [TEMIZ]`;

// Local fallback rule-based safety engine for instant edge filtering
export const evaluateLocalSafetyRules = (content: string): ModerationDecision => {
  if (!content) return '[TEMIZ]';
  const lower = content.toLowerCase();

  // Explicit severe harassment / +18 triggers
  const severePatterns = [
    '+18', 'cinsellik', 'müstehcen', 'seksi', 'am', 'sik', 'yarrak', 'orospu', 
    'fahişe', 'memelerini', 'soyun', 'çıplak foto', 'seks yapalım', 'foto atsana',
    'bacaklarını', 'sikiş'
  ];

  if (severePatterns.some(p => lower.includes(p))) {
    return '[KALICI_BAN]';
  }

  // Suspicious flirting / nagging / troll triggers
  const suspiciousPatterns = [
    'sevgili olalım', 'benimle çıkar mısın', 'evde tekim', 'numaranı versene',
    'güzellik', 'nude', 'özelden yaz', 'insta ver', 'snapchat', 'troll',
    'sana taktım', 'kız mısın', 'görüşelim mi', 'yalnız mısın'
  ];

  if (suspiciousPatterns.some(p => lower.includes(p))) {
    return '[YUZ_DOGRULAMA]';
  }

  return '[TEMIZ]';
};

// Queue helper for bot operations with 5-15s randomized delays
export const sleepRandomDelay = async (minSec = 5, maxSec = 15): Promise<void> => {
  const ms = Math.floor(Math.random() * (maxSec - minSec + 1) + minSec) * 1000;
  return new Promise(resolve => setTimeout(resolve, ms));
};
