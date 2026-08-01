import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'ai-studio-talkomessages-6307891a-8fd3-4665-8810-90b0547735ef' });
const db = admin.firestore();

async function run() {
  const convsSnap = await db.collection('conversations').get();
  for (const doc of convsSnap.docs) {
    const data = doc.data();
    if (data.participants && data.participants.includes('TALKO')) {
      const convId = doc.id;
      
      const msgsSnap = await db.collection('conversations').doc(convId).collection('messages').get();
      let hasSec = false;
      msgsSnap.forEach(m => {
        if (m.data().isSecurityVerification) hasSec = true;
      });
      
      if (!hasSec) {
        console.log(`Adding sec message to conv: ${convId}`);
        const secMsgRef = db.collection('conversations').doc(convId).collection('messages').doc();
        const secContent = 'Hesabınızın güvenliğini artırmak amacıyla kimlik doğrulama işlemini tamamlamanız önerilir.';
        const secTs = new Date(Date.now() + 1000).toISOString();
        
        const secMsgData = {
          id: secMsgRef.id,
          conversationId: convId,
          senderId: 'system_talko',
          senderNumber: 'TALKO',
          senderName: 'TALKO',
          senderAvatarColor: 'blue',
          content: secContent,
          timestamp: secTs,
          status: 'sent',
          isSystem: true,
          isSecurityVerification: true
        };

        await secMsgRef.set(secMsgData);
        await db.collection('conversations').doc(convId).set({
          lastMessage: secMsgData,
          updatedAt: secTs
        }, { merge: true });
        console.log(`Added!`);
      } else {
        console.log(`Already has sec message: ${convId}`);
      }
    }
  }
}

run().catch(console.error);
