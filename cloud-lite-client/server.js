const express = require('express');
const { Client } = require('pg');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pgClient = new Client({
  connectionString: process.env.DATABASE_URL
});

pgClient.connect().catch(console.error);

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODELS = [
  'qwen/qwen3-coder:free',
  'deepseek/deepseek-r1-distill:free',
  'meta-llama/llama-3.3-70b:free',
  'openai/gpt-oss-20b:free',
  'google/gemma-2-27b:free'
];

async function callOpenRouter(messages) {
  for (let model of MODELS) {
    try {
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model,
        messages
      }, {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (err) {
      if (err.response && err.response.status === 429) {
        console.warn(`Model ${model} rate limited, falling back...`);
        continue;
      }
      throw err;
    }
  }
  throw new Error('All fallback models failed or rate limited');
}

// Simple unique ID for our shared chat
const CHAT_ID = 'cloud-lite-chat-1';

app.get('/api/chat', async (req, res) => {
  try {
    const result = await pgClient.query('SELECT chat FROM chat WHERE id = $1', [CHAT_ID]);
    if (result.rows.length > 0 && result.rows[0].chat) {
      res.json({ messages: result.rows[0].chat.messages || [] });
    } else {
      res.json({ messages: [] });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  
  try {
    // 1. Get response from OpenRouter
    const aiResponse = await callOpenRouter(messages);
    const assistantMessage = aiResponse.choices[0].message;
    const updatedMessages = [...messages, assistantMessage];

    // 2. Save to Postgres
    const chatExists = await pgClient.query('SELECT id FROM chat WHERE id = $1', [CHAT_ID]);
    
    // We mock the user_id since auth isn't fully synced yet
    const USER_ID = '00000000-0000-0000-0000-000000000000'; 
    const TITLE = 'Cloud Lite Chat';
    
    if (chatExists.rows.length === 0) {
      await pgClient.query(`
        INSERT INTO chat (id, user_id, title, chat, meta, created_at, updated_at) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [CHAT_ID, USER_ID, TITLE, JSON.stringify({ messages: updatedMessages }), '{}', Date.now(), Date.now()]);
    } else {
      await pgClient.query(`
        UPDATE chat SET chat = $1, updated_at = $2 WHERE id = $3
      `, [JSON.stringify({ messages: updatedMessages }), Date.now(), CHAT_ID]);
    }

    res.json({ message: assistantMessage, allMessages: updatedMessages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Cloud Lite Client running on port ${PORT}`));
