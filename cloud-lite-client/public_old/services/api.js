// api.js
import { API_BASE } from './config.js';

export async function fetchChats() {
    const res = await fetch(`${API_BASE}/chats`);
    if (!res.ok) throw new Error('Failed to fetch chats');
    return res.json();
}

export async function fetchChat(id) {
    const res = await fetch(`${API_BASE}/chat/${id}`);
    if (!res.ok) throw new Error('Failed to fetch chat');
    return res.json();
}

export async function sendChatMessage(messages, chatId = null) {
    const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, chatId })
    });
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
}

export async function deleteChat(id) {
    const res = await fetch(`${API_BASE}/chat/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete chat');
    return res.json();
}

export async function renameChat(id, title) {
    const res = await fetch(`${API_BASE}/chat/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
    });
    if (!res.ok) throw new Error('Failed to rename chat');
    return res.json();
}

export async function buildPrompt(messages) {
    const res = await fetch(`${API_BASE}/build-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
    });
    if (!res.ok) throw new Error('Failed to build prompt');
    return res.json();
}

export async function fetchModels() {
    const res = await fetch(`${API_BASE}/models`);
    if (!res.ok) throw new Error('Failed to fetch models');
    return res.json();
}

export async function updateModels(models) {
    const res = await fetch(`${API_BASE}/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ models })
    });
    if (!res.ok) throw new Error('Failed to update models');
    return res.json();
}
