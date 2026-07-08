const express = require('express');
const { Client } = require('pg');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const crypto = require('crypto');
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

let CACHED_MODELS = [];

// Fetch models from DB
async function getModels() {
  try {
    const res = await pgClient.query("SELECT models_list FROM app_config WHERE id = 'default'");
    if (res.rows.length > 0) {
      CACHED_MODELS = res.rows[0].models_list;
    }
  } catch (e) {
    console.error("Error fetching models:", e);
  }
  return CACHED_MODELS;
}

// Initial fetch
getModels();

const DEFAULT_REASONING_MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";
const PLANNING_SYSTEM_PROMPT = {
  role: "system",
  content: "You are a planning and brainstorming partner. When the user describes a project idea or plan, proactively suggest better approaches, point out gaps, and ask 'have you considered X' rather than just accepting the plan at face value. Critique their ideas constructively to arrive at the best possible solution."
};

async function callOpenRouter(messages, usePlanningPrompt = false) {
  const models = await getModels();
  if (!models || models.length === 0) throw new Error("No models configured");

  for (let model of models) {
    try {
      let finalMessages = [...messages];
      
      // Inject planning system prompt if it's the default reasoning model AND planning is requested
      if (usePlanningPrompt && model === models[0] && model === DEFAULT_REASONING_MODEL) {
        // Ensure system prompt is first
        finalMessages = [PLANNING_SYSTEM_PROMPT, ...finalMessages.filter(m => m.role !== 'system')];
      }

      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model,
        messages: finalMessages
      }, {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.data.error) {
        console.warn(`Model ${model} returned error: ${response.data.error.message}`);
        continue;
      }
      // Attach the model used so frontend can display it
      response.data.model_used = model;
      return response.data;
    } catch (err) {
      if (err.response && err.response.status === 429) {
        console.warn(`Model ${model} rate limited, falling back...`);
        continue;
      }
      console.warn(`Model ${model} threw error, falling back...`);
      continue;
    }
  }
  throw new Error('All fallback models failed or rate limited');
}

// const CHAT_ID = 'cloud-lite-chat-1'; // Replaced with dynamic IDs
const USER_ID = '00000000-0000-0000-0000-000000000000'; // Hardcoded for now

// API: Get Models
app.get('/api/models', async (req, res) => {
  const models = await getModels();
  res.json({ models });
});

// API: Set Models
app.post('/api/models', async (req, res) => {
  const { models } = req.body;
  if (!Array.isArray(models)) return res.status(400).json({ error: "models must be an array" });
  try {
    await pgClient.query(`UPDATE app_config SET models_list = $1 WHERE id = 'default'`, [JSON.stringify(models)]);
    CACHED_MODELS = models;
    res.json({ success: true, models });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// API: List all chats
app.get('/api/chats', async (req, res) => {
  try {
    const result = await pgClient.query(
      'SELECT id, title, updated_at FROM chat WHERE user_id = $1 ORDER BY updated_at DESC', 
      [USER_ID]
    );
    res.json({ chats: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// API: Get specific chat
app.get('/api/chat/:id', async (req, res) => {
  try {
    const result = await pgClient.query('SELECT chat, title FROM chat WHERE id = $1 AND user_id = $2', [req.params.id, USER_ID]);
    if (result.rows.length > 0 && result.rows[0].chat) {
      res.json({ messages: result.rows[0].chat.messages || [], title: result.rows[0].title });
    } else {
      res.status(404).json({ error: 'Chat not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/chat', async (req, res) => {
  let { messages, chatId } = req.body;
  let isNewChat = false;
  
  if (!chatId) {
    chatId = crypto.randomUUID();
    isNewChat = true;
  }
  
  try {
    // 1. Get response from OpenRouter, enable planning prompt if applicable
    const aiResponse = await callOpenRouter(messages, true);
    const assistantMessage = aiResponse.choices[0].message;
    assistantMessage.model_used = aiResponse.model_used; // attach model used
    
    const updatedMessages = [...messages, assistantMessage];

    // 2. Save to Postgres
    const chatExists = await pgClient.query('SELECT id FROM chat WHERE id = $1', [chatId]);
    
    if (chatExists.rows.length === 0) {
      // Auto-generate title from the first message
      let title = 'New Chat';
      if (messages.length > 0 && messages[0].content) {
        title = messages[0].content.substring(0, 40) + (messages[0].content.length > 40 ? '...' : '');
      }
      
      await pgClient.query(`
        INSERT INTO chat (id, user_id, title, chat, meta, created_at, updated_at) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [chatId, USER_ID, title, JSON.stringify({ messages: updatedMessages }), '{}', Date.now(), Date.now()]);
    } else {
      await pgClient.query(`
        UPDATE chat SET chat = $1, updated_at = $2 WHERE id = $3
      `, [JSON.stringify({ messages: updatedMessages }), Date.now(), chatId]);
    }

    res.json({ message: assistantMessage, allMessages: updatedMessages, chatId: chatId, isNewChat });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// API: Delete chat
app.delete('/api/chat/:id', async (req, res) => {
  try {
    await pgClient.query('DELETE FROM chat WHERE id = $1 AND user_id = $2', [req.params.id, USER_ID]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// API: Rename chat
app.put('/api/chat/:id', async (req, res) => {
  const { title } = req.body;
  try {
    await pgClient.query('UPDATE chat SET title = $1, updated_at = $2 WHERE id = $3 AND user_id = $4', [title, Date.now(), req.params.id, USER_ID]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// API: Turn into build prompt
app.post('/api/build-prompt', async (req, res) => {
  const { messages } = req.body;
  
  const buildInstructions = {
    role: "user",
    content: "Take the full conversation so far as context. First, generate a concise summary of what was discussed, what problem is being solved, and what solution/plan was arrived at. Then, below the summary, generate a complete, execution-ready prompt formatted for pasting directly into an AI agent (Antigravity). The prompt must be specific, step-by-step, no placeholders or ambiguous judgment calls, flagging any step that requires manual user action. Wrap the final prompt in a markdown block."
  };
  
  try {
    const aiResponse = await callOpenRouter([...messages, buildInstructions], false);
    res.json({ result: aiResponse.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Cloud Lite Client running on port ${PORT}`));
