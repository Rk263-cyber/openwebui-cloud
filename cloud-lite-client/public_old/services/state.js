// state.js
export const state = {
    chatList: [],
    currentChatId: null,
    messages: [],
    isSidebarOpen: false
};

// Simple event emitter
const listeners = {};

export function subscribe(event, callback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
}

export function emit(event, data) {
    if (listeners[event]) {
        listeners[event].forEach(cb => cb(data));
    }
}
