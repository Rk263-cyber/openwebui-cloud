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
app.use(express.static(path.join(__dirname, 'client', 'dist')));


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

const GLOBAL_SYSTEM_PROMPT = {
  role: "system",
  content: "You are a helpful, concise, and natural conversational assistant. Answer directly and immediately. Do NOT output huge markdown tables, long essays, or bulleted lists unless explicitly requested. Keep your answers short and conversational. Do not add unnecessary explanations or sections like 'Have you considered...'. If the user wants more detail, they will ask for it."
};

async function callOpenRouter(messages, usePlanningPrompt = false) {
  const models = await getModels();
  if (!models || models.length === 0) throw new Error("No models configured");

  for (let model of models) {
    try {
      let finalMessages = [...messages];
      
      // Filter out any existing system prompts so we don't conflict
      finalMessages = finalMessages.filter(m => m.role !== 'system');
      
      // Inject GLOBAL_SYSTEM_PROMPT at the very beginning
      finalMessages.unshift(GLOBAL_SYSTEM_PROMPT);

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
    const chatResult = await pgClient.query('SELECT title FROM chat WHERE id = $1 AND user_id = $2', [req.params.id, USER_ID]);
    if (chatResult.rows.length > 0) {
      const msgResult = await pgClient.query(
        'SELECT id, role, content, model, created_at FROM cloud_message WHERE conversation_id = $1 ORDER BY created_at ASC',
        [req.params.id]
      );
      // Map to OpenRouter format
      const messages = msgResult.rows.map(r => ({
        id: r.id,
        role: r.role,
        content: r.content,
        model_used: r.model
      }));
      res.json({ messages: messages, title: chatResult.rows[0].title });
    } else {
      res.status(404).json({ error: 'Chat not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/chat', async (req, res) => {
  let { messages, chatId, userMessageId } = req.body;
  let isNewChat = false;
  
  if (!chatId) {
    chatId = crypto.randomUUID();
    isNewChat = true;
  }
  
  try {
    const uMsgId = userMessageId || crypto.randomUUID();
    const lastUserMsg = messages[messages.length - 1];
    
    // Fetch existing chat JSON if it exists
    let chatJson = {
      id: chatId,
      title: "New Chat",
      models: [],
      history: { currentId: null, messages: {} },
      messages: [],
      timestamp: Date.now()
    };
    
    const chatExists = await pgClient.query('SELECT chat FROM chat WHERE id = $1', [chatId]);
    if (chatExists.rows.length > 0) {
      if (typeof chatExists.rows[0].chat === 'string') {
        try { chatJson = JSON.parse(chatExists.rows[0].chat); } catch(e){}
      } else if (chatExists.rows[0].chat) {
        chatJson = chatExists.rows[0].chat;
      }
    }
    
    // Append User Message to Tree
    let parentId = chatJson.history.currentId || null;
    if (parentId && chatJson.history.messages[parentId]) {
      if (!chatJson.history.messages[parentId].childrenIds.includes(uMsgId)) {
        chatJson.history.messages[parentId].childrenIds.push(uMsgId);
      }
    }
    
    chatJson.history.messages[uMsgId] = {
      id: uMsgId,
      parentId: parentId,
      childrenIds: [],
      role: 'user',
      content: lastUserMsg.content,
      timestamp: Math.floor(Date.now() / 1000)
    };
    chatJson.history.currentId = uMsgId;

    if (lastUserMsg && lastUserMsg.role === 'user') {
      const exists = await pgClient.query('SELECT id FROM cloud_message WHERE id = $1', [uMsgId]);
      if (exists.rows.length === 0) {
        await pgClient.query(`
          INSERT INTO cloud_message (id, conversation_id, user_id, role, content, created_at, updated_at, device, source, parent_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [uMsgId, chatId, USER_ID, 'user', lastUserMsg.content, Date.now(), Date.now(), 'web', 'cloud-lite', parentId]);
      }
    }

    // Call OpenRouter
    const aiResponse = await callOpenRouter(messages.map(m => ({role: m.role, content: m.content})), true);
    const assistantMessage = aiResponse.choices[0].message;
    assistantMessage.model_used = aiResponse.model_used;
    const aMsgId = crypto.randomUUID();
    assistantMessage.id = aMsgId;
    
    // Append Assistant Message to Tree
    chatJson.history.messages[uMsgId].childrenIds.push(aMsgId);
    chatJson.history.messages[aMsgId] = {
      id: aMsgId,
      parentId: uMsgId,
      childrenIds: [],
      role: 'assistant',
      content: assistantMessage.content,
      model: aiResponse.model_used,
      timestamp: Math.floor(Date.now() / 1000)
    };
    chatJson.history.currentId = aMsgId;
    if (!chatJson.models.includes(aiResponse.model_used)) chatJson.models.push(aiResponse.model_used);
    
    if (isNewChat && messages.length > 0 && messages[0].content) {
      chatJson.title = messages[0].content.substring(0, 40) + (messages[0].content.length > 40 ? '...' : '');
    }

    // Save AI message to cloud_message
    await pgClient.query(`
      INSERT INTO cloud_message (id, conversation_id, user_id, role, content, model, created_at, updated_at, device, source, parent_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [aMsgId, chatId, USER_ID, 'assistant', assistantMessage.content, aiResponse.model_used, Date.now(), Date.now(), 'web', 'cloud-lite', uMsgId]);

    const updatedMessages = [...messages, assistantMessage];

    // Create or update chat row with full JSON tree
    if (isNewChat) {
      await pgClient.query(`
        INSERT INTO chat (id, user_id, title, chat, meta, created_at, updated_at) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [chatId, USER_ID, chatJson.title, JSON.stringify(chatJson), '{}', Date.now(), Date.now()]);
    } else {
      await pgClient.query(`UPDATE chat SET chat = $1, updated_at = $2 WHERE id = $3`, [JSON.stringify(chatJson), Date.now(), chatId]);
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
    const aiResponse = await callOpenRouter([...messages.map(m=>({role:m.role, content:m.content})), buildInstructions], false);
    res.json({ result: aiResponse.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Removed obsolete /api/sync endpoint as sync is handled by Event-Driven Sync Engine
// Catch-all route to serve the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Cloud Lite Client running on port ${PORT}`));
