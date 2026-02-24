# Weitredge AI Support Assistant

A full-stack AI-powered support chatbot built with React, Node.js/Express, SQLite, and Claude (Anthropic).

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React.js 18, react-markdown |
| Backend | Node.js, Express |
| Database | SQLite (via better-sqlite3) |
| LLM | Claude (Anthropic) — claude-haiku-4-5 |
| Rate Limiting | express-rate-limit |

---

## Project Structure

```
project/
├── backend/
│   ├── server.js        # Express app + API routes
│   ├── db.js            # SQLite init + schema
│   ├── docs.json        # Product documentation (source of truth)
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.js       # Main chat component
    │   └── App.css      # Styles
    ├── public/
    │   └── index.html
    ├── .env.example
    └── package.json
```

---

## Setup

### Prerequisites
- Node.js >= 18
- An Anthropic API key (get one at https://console.anthropic.com)

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env and set your ANTHROPIC_API_KEY
npm install
npm start
# Server runs on http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm start
# App runs on http://localhost:3000
```

---

## API Documentation

### POST /api/chat
Send a message and get an AI reply.

**Request:**
```json
{
  "sessionId": "abc123",
  "message": "How do I reset my password?"
}
```

**Response:**
```json
{
  "reply": "Users can reset their password from Settings > Security...",
  "tokensUsed": 152
}
```

**Errors:**
- `400` — Missing sessionId or message
- `429` — Rate limit exceeded (50 req / 15 min per IP)
- `500` — LLM or DB error

---

### GET /api/conversations/:sessionId
Returns all messages for a session in chronological order.

**Response:**
```json
{
  "sessionId": "abc123",
  "messages": [
    { "id": 1, "role": "user", "content": "...", "created_at": "..." },
    { "id": 2, "role": "assistant", "content": "...", "created_at": "..." }
  ]
}
```

---

### GET /api/sessions
Returns list of all sessions.

**Response:**
```json
{
  "sessions": [
    { "id": "abc123", "created_at": "...", "updated_at": "..." }
  ]
}
```

---

## Database Schema

### sessions
| Column | Type | Notes |
|---|---|---|
| id | TEXT | sessionId (PK) |
| created_at | DATETIME | Auto-set on insert |
| updated_at | DATETIME | Updated on each chat |

### messages
| Column | Type | Notes |
|---|---|---|
| id | INTEGER | PK autoincrement |
| session_id | TEXT | FK → sessions.id |
| role | TEXT | "user" or "assistant" |
| content | TEXT | Message text |
| created_at | DATETIME | Auto-set on insert |

---

## How It Works

### Document-Based Answering
- All product docs live in `backend/docs.json`
- The full docs are injected into the system prompt for every request
- The LLM is strictly instructed to answer ONLY from docs — no hallucination
- If the answer isn't in docs, responds: *"Sorry, I don't have information about that."*

### Context & Memory
- Last **5 user+assistant message pairs** are fetched from SQLite for each request
- Context is built from DB — no in-memory state

### Session Handling
- A UUID `sessionId` is generated on first load and stored in `localStorage`
- All API calls include `sessionId` for persistence across page reloads
- Users can start a new chat (new UUID) via the "New" button

---

## Assumptions
- Claude Haiku is used for cost efficiency; can be changed to Sonnet/Opus in `server.js`
- Rate limit is 50 requests per 15 min per IP (configurable)
- `docs.json` is the single source of truth — editing it updates the assistant's knowledge immediately
- No authentication — sessions are identified by UUID only

---

## Sample docs.json format

```json
[
  {
    "title": "Reset Password",
    "content": "Users can reset password from Settings > Security."
  },
  {
    "title": "Refund Policy",
    "content": "Refunds are allowed within 7 days of purchase."
  }
]
```

---

## Bonus Features Implemented
- ✅ Markdown rendering in assistant replies
- ✅ Session sidebar with history
- ✅ Typing indicator / loading state
- ✅ Optimistic UI updates
- ✅ Token usage display
- ✅ Suggestion chips on empty state
