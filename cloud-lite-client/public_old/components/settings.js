// settings.js
import { fetchModels, updateModels } from '../services/api.js';
import { THEME_KEY } from '../services/config.js';

const modal = document.getElementById('settings-modal');
const textarea = document.getElementById('models-textarea');
const themeSelect = document.getElementById('theme-select');

export function initSettings() {
    document.getElementById('open-settings-btn').addEventListener('click', openSettings);
    document.getElementById('close-settings-btn').addEventListener('click', closeSettings);
    document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
    
    // Close on click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeSettings();
    });

    // Theme logic
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeSelect.value = savedTheme;
    
    themeSelect.addEventListener('change', (e) => {
        const t = e.target.value;
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem(THEME_KEY, t);
    });
}

async function openSettings() {
    modal.classList.add('active');
    try {
        const data = await fetchModels();
        textarea.value = JSON.stringify(data.models, null, 2);
    } catch(e) {
        textarea.value = 'Error fetching models';
    }
}

function closeSettings() {
    modal.classList.remove('active');
}

async function saveSettings() {
    try {
        const models = JSON.parse(textarea.value);
        await updateModels(models);
        closeSettings();
    } catch(e) {
        alert("Invalid JSON format");
    }
}
