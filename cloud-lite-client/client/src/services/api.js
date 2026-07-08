import axios from 'axios';
import { get, set, keys } from 'idb-keyval';

const API_BASE = '/api';

export const generateId = () => crypto.randomUUID();

export async function fetchLocalChats() {
  const allKeys = await keys();
  const chatKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith('chat_'));
  const chats = await Promise.all(chatKeys.map(k => get(k)));
  return chats.sort((a, b) => b.updated_at - a.updated_at);
}

export async function fetchLocalMessages(chatId) {
  const msgs = await get(`msgs_${chatId}`);
  return msgs || [];
}

export async function saveLocalMessage(msg) {
  const chatId = msg.conversation_id;
  let msgs = await get(`msgs_${chatId}`) || [];
  
  const existingIdx = msgs.findIndex(m => m.id === msg.id);
  if (existingIdx >= 0) {
    if (msg.updated_at > msgs[existingIdx].updated_at) {
      msgs[existingIdx] = msg;
    }
  } else {
    msgs.push(msg);
  }
  
  msgs.sort((a, b) => a.created_at - b.created_at);
  await set(`msgs_${chatId}`, msgs);
  
  // Update chat metadata
  let chat = await get(`chat_${chatId}`);
  if (!chat) {
    chat = {
      id: chatId,
      title: msgs[0]?.content?.substring(0, 40) || 'New Chat',
      created_at: msg.created_at,
      updated_at: msg.updated_at
    };
  } else {
    chat.updated_at = msg.updated_at;
  }
  await set(`chat_${chatId}`, chat);
}

export async function syncMessages() {
  const lastSync = await get('last_sync') || 0;
  
  // 1. Gather all local messages updated since last sync
  const allKeys = await keys();
  const msgKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith('msgs_'));
  
  let pendingSync = [];
  for (const k of msgKeys) {
    const msgs = await get(k);
    if (msgs) {
      pendingSync.push(...msgs.filter(m => m.updated_at > lastSync));
    }
  }
  
  try {
    const res = await axios.post(`${API_BASE}/sync`, {
      messages: pendingSync,
      last_sync: lastSync
    });
    
    if (res.data.success) {
      const serverMessages = res.data.updated_messages || [];
      for (const msg of serverMessages) {
        await saveLocalMessage(msg);
      }
      await set('last_sync', res.data.server_timestamp);
    }
    return true;
  } catch (e) {
    console.error('Sync failed', e);
    return false;
  }
}

export async function sendMessage(messagesContext, chatId, userMessageText) {
  // Save local user message immediately for optimistic UI
  const uMsgId = generateId();
  const uMsg = {
    id: uMsgId,
    conversation_id: chatId,
    role: 'user',
    content: userMessageText,
    created_at: Date.now(),
    updated_at: Date.now(),
    device: 'web'
  };
  await saveLocalMessage(uMsg);

  try {
    const res = await axios.post(`${API_BASE}/chat`, {
      messages: messagesContext,
      chatId,
      userMessageId: uMsgId
    });
    
    // Save assistant message
    if (res.data.message) {
      const aMsg = {
        id: res.data.message.id,
        conversation_id: chatId,
        role: 'assistant',
        content: res.data.message.content,
        model: res.data.message.model_used,
        created_at: Date.now(),
        updated_at: Date.now(),
        device: 'web'
      };
      await saveLocalMessage(aMsg);
    }
    
    // Trigger background sync
    syncMessages();
    return res.data;
  } catch(e) {
    throw e;
  }
}

export async function deleteChat(chatId) {
  // Local first
  const db = indexedDB.deleteDatabase(`msgs_${chatId}`);
  const db2 = indexedDB.deleteDatabase(`chat_${chatId}`);
  // Actually we use idb-keyval
  const { del } = await import('idb-keyval');
  await del(`msgs_${chatId}`);
  await del(`chat_${chatId}`);
  
  try {
    await axios.delete(`${API_BASE}/chat/${chatId}`);
  } catch (e) {
    console.error('Failed to delete on server');
  }
}
