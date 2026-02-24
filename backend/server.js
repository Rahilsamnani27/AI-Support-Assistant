require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Anthropic = require('@anthropic-ai/sdk');
const { getDb, run, all, get } = require('./db');
const docs = require('./docs.json');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const docsContext = docs.map(d => `**${d.title}**\n${d.content}`).join('\n\n');

// POST /api/chat
app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body;
  if (!sessionId || !sessionId.trim()) return res.status(400).json({ error: 'sessionId is required.' });
  if (!message || !message.trim()) return res.status(400).json({ error: 'message is required.' });

  try {
    await getDb();
    const existing = get('SELECT id FROM sessions WHERE id = ?', [sessionId]);
    if (existing) {
      run("UPDATE sessions SET updated_at = datetime('now') WHERE id = ?", [sessionId]);
    } else {
      run('INSERT INTO sessions (id) VALUES (?)', [sessionId]);
    }
    run("INSERT INTO messages (session_id, role, content) VALUES (?, 'user', ?)", [sessionId, message.trim()]);

    const history = all('SELECT role, content FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT 10', [sessionId]).reverse();
    const chatHistory = history.slice(0, -1).map(m => ({ role: m.role, content: m.content }));

    const systemPrompt = `You are a helpful customer support assistant for Weitredge.
You must ONLY answer questions based on the product documentation provided below.
If a user asks something not covered in the documentation, respond with exactly:
"Sorry, I don't have information about that."
Do NOT guess, hallucinate, or use any outside knowledge.

PRODUCT DOCUMENTATION:
${docsContext}`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: systemPrompt,
      messages: [...chatHistory, { role: 'user', content: message.trim() }]
    });

    const reply = response.content[0].text;
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
    run("INSERT INTO messages (session_id, role, content) VALUES (?, 'assistant', ?)", [sessionId, reply]);

    return res.json({ reply, tokensUsed });
  } catch (err) {
    console.error('Chat error:', err);
    if (err.status === 401) return res.status(500).json({ error: 'LLM authentication failed.' });
    if (err.status === 429) return res.status(429).json({ error: 'LLM rate limit reached.' });
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

// GET /api/conversations/:sessionId
app.get('/api/conversations/:sessionId', async (req, res) => {
  try {
    await getDb();
    const session = get('SELECT * FROM sessions WHERE id = ?', [req.params.sessionId]);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    const messages = all('SELECT id, role, content, created_at FROM messages WHERE session_id = ? ORDER BY id ASC', [req.params.sessionId]);
    return res.json({ sessionId: req.params.sessionId, messages });
  } catch (err) {
    return res.status(500).json({ error: 'Database error.' });
  }
});

// GET /api/sessions
app.get('/api/sessions', async (req, res) => {
  try {
    await getDb();
    const sessions = all('SELECT id, created_at, updated_at FROM sessions ORDER BY updated_at DESC', []);
    return res.json({ sessions });
  } catch (err) {
    return res.status(500).json({ error: 'Database error.' });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, async () => {
  await getDb();
  console.log(`Server running on http://localhost:${PORT}`);
});
