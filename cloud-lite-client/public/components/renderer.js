// renderer.js
import { copyText } from './utils.js';
import { state } from '../services/state.js';
import { buildPrompt } from '../services/api.js';

const container = document.getElementById('messages-container');
const chatDiv = document.getElementById('chat-container');

export function clearMessages() {
    container.innerHTML = '';
}

export function scrollToBottom() {
    chatDiv.scrollTop = chatDiv.scrollHeight;
}

export function appendMessage(msg, index, autoScroll = true) {
    const row = document.createElement('div');
    row.className = 'message-row';
    row.id = `msg-${index}`;

    const messageWrapper = document.createElement('div');
    messageWrapper.className = `message ${msg.role}`;
    
    // Avatar
    const avatar = document.createElement('div');
    avatar.className = `avatar ${msg.role}`;
    if (msg.role === 'assistant') {
        avatar.innerHTML = `<i data-lucide="bot" style="width:18px; height:18px;"></i>`;
    }
    
    // Content
    const content = document.createElement('div');
    content.className = 'message-content';
    content.innerHTML = marked.parse(msg.content);
    
    messageWrapper.appendChild(avatar);
    messageWrapper.appendChild(content);
    row.appendChild(messageWrapper);

    // Footer actions
    const footer = document.createElement('div');
    footer.className = 'msg-footer';
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-btn';
    copyBtn.innerHTML = `<i data-lucide="copy" style="width:14px; height:14px;"></i> Copy`;
    copyBtn.onclick = async () => {
        const success = await copyText(msg.content);
        if(success) {
            copyBtn.innerHTML = `<i data-lucide="check" style="width:14px; height:14px; color:var(--accent)"></i> Copied`;
            setTimeout(() => {
                copyBtn.innerHTML = `<i data-lucide="copy" style="width:14px; height:14px;"></i> Copy`;
                lucide.createIcons();
            }, 2000);
        }
    };
    footer.appendChild(copyBtn);

    if (msg.role === 'assistant') {
        if (msg.model_used) {
            const tag = document.createElement('div');
            tag.className = 'model-badge';
            tag.innerHTML = `<i data-lucide="cpu" style="width:12px; height:12px;"></i> ${msg.model_used}`;
            footer.appendChild(tag);
        }
        
        const promptBtn = document.createElement('button');
        promptBtn.className = 'action-btn';
        promptBtn.style.color = '#EAB308';
        promptBtn.innerHTML = `<i data-lucide="zap" style="width:14px; height:14px;"></i> Turn into build prompt`;
        promptBtn.onclick = async () => {
            promptBtn.innerHTML = `<i data-lucide="loader" class="spin" style="width:14px; height:14px;"></i>`;
            promptBtn.disabled = true;
            try {
                const context = state.messages.slice(0, index + 1);
                const data = await buildPrompt(context);
                
                const block = document.createElement('div');
                block.className = 'build-prompt-block';
                block.innerHTML = `
                    <div class="build-prompt-header">
                        <span><i data-lucide="zap" style="width:14px; height:14px; vertical-align:middle;"></i> Generated Build Prompt</span>
                        <button class="action-btn" onclick='navigator.clipboard.writeText(${JSON.stringify(data.result)})'>
                            <i data-lucide="copy" style="width:14px; height:14px;"></i> Copy
                        </button>
                    </div>
                    <div class="message-content">${marked.parse(data.result)}</div>
                `;
                row.appendChild(block);
                
                // Re-highlight any code blocks in the generated prompt
                block.querySelectorAll('pre code').forEach(hljs.highlightElement);
                
            } catch(e) {
                alert('Failed to generate prompt');
            } finally {
                promptBtn.innerHTML = `<i data-lucide="zap" style="width:14px; height:14px;"></i> Turn into build prompt`;
                promptBtn.disabled = false;
                lucide.createIcons();
            }
        };
        footer.appendChild(promptBtn);
    }
    
    row.appendChild(footer);
    container.appendChild(row);
    
    lucide.createIcons();
    row.querySelectorAll('pre code').forEach(hljs.highlightElement);
    
    if (autoScroll) scrollToBottom();
}

export function showThinking() {
    const row = document.createElement('div');
    row.className = 'message-row';
    row.id = 'thinking-indicator';
    
    const messageWrapper = document.createElement('div');
    messageWrapper.className = `message assistant`;
    
    const avatar = document.createElement('div');
    avatar.className = `avatar assistant`;
    avatar.innerHTML = `<i data-lucide="bot" style="width:18px; height:18px;"></i>`;
    
    const content = document.createElement('div');
    content.className = 'message-content loading-dots';
    content.innerHTML = `<div class="dot"></div><div class="dot"></div><div class="dot"></div>`;
    
    messageWrapper.appendChild(avatar);
    messageWrapper.appendChild(content);
    row.appendChild(messageWrapper);
    
    container.appendChild(row);
    lucide.createIcons();
    scrollToBottom();
}

export function hideThinking() {
    const indicator = document.getElementById('thinking-indicator');
    if (indicator) {
        indicator.remove();
    }
}
