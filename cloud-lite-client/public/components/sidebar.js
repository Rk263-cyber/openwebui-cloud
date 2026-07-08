// sidebar.js
import { fetchChats, fetchChat, deleteChat, renameChat } from '../services/api.js';
import { state, subscribe, emit } from '../services/state.js';
import { clearMessages, appendMessage } from './renderer.js';

const sidebar = document.getElementById('sidebar');
const backdrop = document.getElementById('sidebar-backdrop');
const historyList = document.getElementById('history-list');

export function initSidebar() {
    document.getElementById('toggle-sidebar-btn').addEventListener('click', toggleSidebar);
    backdrop.addEventListener('click', closeSidebar);
    
    document.getElementById('new-chat-btn').addEventListener('click', () => {
        state.currentChatId = null;
        state.messages = [];
        clearMessages();
        renderSidebar(); // highlight nothing/new
        if (window.innerWidth <= 768) closeSidebar();
    });

    subscribe('chatCreated', async () => {
        await loadChats();
    });
}

export function toggleSidebar() {
    sidebar.classList.toggle('open');
    backdrop.classList.toggle('open');
}

export function closeSidebar() {
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
}

export async function loadChats() {
    try {
        const data = await fetchChats();
        state.chatList = data.chats || [];
        renderSidebar();
    } catch(e) {
        console.error('Failed to load chats', e);
    }
}

function renderSidebar() {
    historyList.innerHTML = '';
    
    state.chatList.forEach(chat => {
        const item = document.createElement('div');
        item.className = `history-item ${chat.id === state.currentChatId ? 'active' : ''}`;
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'history-title';
        titleSpan.innerText = chat.title || 'New Chat';
        item.appendChild(titleSpan);
        
        const actions = document.createElement('div');
        actions.className = 'history-actions';
        
        const renameBtn = document.createElement('button');
        renameBtn.className = 'history-action-btn';
        renameBtn.innerHTML = `<i data-lucide="edit-2" style="width:14px; height:14px;"></i>`;
        renameBtn.onclick = async (e) => {
            e.stopPropagation();
            const newTitle = prompt('Rename chat:', chat.title);
            if (newTitle && newTitle.trim()) {
                await renameChat(chat.id, newTitle.trim());
                await loadChats();
            }
        };
        
        const delBtn = document.createElement('button');
        delBtn.className = 'history-action-btn';
        delBtn.innerHTML = `<i data-lucide="trash-2" style="width:14px; height:14px;"></i>`;
        delBtn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm('Delete this chat?')) {
                await deleteChat(chat.id);
                if (state.currentChatId === chat.id) {
                    document.getElementById('new-chat-btn').click();
                } else {
                    await loadChats();
                }
            }
        };
        
        actions.appendChild(renameBtn);
        actions.appendChild(delBtn);
        item.appendChild(actions);
        
        // Select chat
        item.addEventListener('click', async () => {
            if (state.currentChatId === chat.id) return;
            
            state.currentChatId = chat.id;
            renderSidebar();
            if (window.innerWidth <= 768) closeSidebar();
            
            clearMessages();
            try {
                const data = await fetchChat(chat.id);
                state.messages = data.messages || [];
                state.messages.forEach((msg, idx) => appendMessage(msg, idx, false));
                document.getElementById('chat-container').scrollTop = document.getElementById('chat-container').scrollHeight;
            } catch(e) {
                console.error(e);
            }
        });
        
        historyList.appendChild(item);
    });
    
    lucide.createIcons();
    
    // AutoAnimate if available globally
    if (window.autoAnimate) {
        window.autoAnimate(historyList);
    }
}
