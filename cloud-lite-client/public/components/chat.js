// chat.js
import { state, emit } from '../services/state.js';
import { sendChatMessage } from '../services/api.js';
import { appendMessage, showThinking, hideThinking } from './renderer.js';

const form = document.getElementById('chat-form');
const input = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

export function initChat() {
    // Auto-grow textarea
    input.addEventListener('input', function() {
        this.style.height = '56px';
        this.style.height = (this.scrollHeight) + 'px';
        sendBtn.disabled = this.value.trim().length === 0;
    });

    // Enter to send, Shift+Enter for newline
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (this.value.trim().length > 0 && !sendBtn.disabled) {
                form.dispatchEvent(new Event('submit'));
            }
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;

        // Reset input
        input.value = '';
        input.style.height = '56px';
        sendBtn.disabled = true;

        const userMsg = { role: 'user', content: text };
        state.messages.push(userMsg);
        
        // Render immediately
        appendMessage(userMsg, state.messages.length - 1);
        showThinking();

        try {
            const data = await sendChatMessage(state.messages, state.currentChatId);
            
            hideThinking();
            
            // If it was a new chat, update state
            if (data.isNewChat) {
                state.currentChatId = data.chatId;
                emit('chatCreated', data.chatId); // Refresh sidebar
            }
            
            state.messages = data.allMessages;
            const assistantMsg = state.messages[state.messages.length - 1];
            appendMessage(assistantMsg, state.messages.length - 1);
            
        } catch(err) {
            hideThinking();
            alert('Error sending message');
        } finally {
            sendBtn.disabled = input.value.trim().length === 0;
            input.focus();
        }
    });
}
