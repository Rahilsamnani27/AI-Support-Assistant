import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import './App.css';

const API_BASE = process.env.REACT_APP_API_URL || '';

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function App() {
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessions, setSessions] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Init or restore sessionId
  useEffect(() => {
    let sid = localStorage.getItem('sessionId');
    if (!sid) {
      sid = uuidv4();
      localStorage.setItem('sessionId', sid);
    }
    setSessionId(sid);
  }, []);

  // Load conversation when sessionId changes
  useEffect(() => {
    if (!sessionId) return;
    fetchConversation(sessionId);
  }, [sessionId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function fetchConversation(sid) {
    try {
      const res = await fetch(`${API_BASE}/api/conversations/${sid}`);
      if (res.status === 404) { setMessages([]); return; }
      const data = await res.json();
      if (data.messages) setMessages(data.messages);
    } catch {
      setMessages([]);
    }
  }

  async function fetchSessions() {
    try {
      const res = await fetch(`${API_BASE}/api/sessions`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {}
  }

  function newChat() {
    const sid = uuidv4();
    localStorage.setItem('sessionId', sid);
    setSessionId(sid);
    setMessages([]);
    setError('');
    setSidebarOpen(false);
  }

  function switchSession(sid) {
    localStorage.setItem('sessionId', sid);
    setSessionId(sid);
    setSidebarOpen(false);
  }

  async function sendMessage(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setInput('');
    setError('');
    const optimisticUser = { id: Date.now(), role: 'user', content: trimmed, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimisticUser]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: trimmed })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.reply,
        created_at: new Date().toISOString(),
        tokensUsed: data.tokensUsed
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setMessages(prev => prev.filter(m => m.id !== optimisticUser.id));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  const handleSidebarOpen = () => {
    setSidebarOpen(true);
    fetchSessions();
  };

  return (
    <div className="app">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">Chat Sessions</span>
          <button className="close-btn" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        <button className="new-chat-btn-sidebar" onClick={newChat}>
          <span>＋</span> New Chat
        </button>
        <div className="sessions-list">
          {sessions.length === 0 && <p className="no-sessions">No sessions yet</p>}
          {sessions.map(s => (
            <div
              key={s.id}
              className={`session-item ${s.id === sessionId ? 'active' : ''}`}
              onClick={() => switchSession(s.id)}
            >
              <div className="session-id">{s.id.slice(0, 8)}…</div>
              <div className="session-time">{formatDate(s.updated_at)}</div>
            </div>
          ))}
        </div>
      </div>
      {sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="main">
        {/* Header */}
        <header className="header">
          <button className="menu-btn" onClick={handleSidebarOpen}>☰</button>
          <div className="header-brand">
            <div className="logo">W</div>
            <div>
              <div className="brand-name">Weitredge Support</div>
              <div className="brand-sub">AI Assistant</div>
            </div>
          </div>
          <button className="new-chat-btn" onClick={newChat} title="New Chat">
            ✦ New
          </button>
        </header>

        {/* Session pill */}
        <div className="session-bar">
          <span className="session-label">Session:</span>
          <span className="session-chip">{sessionId.slice(0, 12)}…</span>
        </div>

        {/* Messages */}
        <div className="messages-container">
          {messages.length === 0 && !loading && (
            <div className="empty-state">
              <div className="empty-icon">◈</div>
              <h2>How can I help you?</h2>
              <p>Ask about password reset, refunds, subscriptions, and more.</p>
              <div className="suggestions">
                {['How do I reset my password?', 'What is your refund policy?', 'What plans do you offer?'].map(s => (
                  <button key={s} className="suggestion-chip" onClick={() => { setInput(s); inputRef.current?.focus(); }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`message-row ${msg.role}`}>
              <div className="avatar">{msg.role === 'user' ? '↑' : '◈'}</div>
              <div className="bubble">
                {msg.role === 'assistant'
                  ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                  : <p>{msg.content}</p>
                }
                <div className="msg-meta">
                  {formatTime(msg.created_at)}
                  {msg.tokensUsed && <span className="tokens"> · {msg.tokensUsed} tokens</span>}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="message-row assistant">
              <div className="avatar">◈</div>
              <div className="bubble typing">
                <span /><span /><span />
              </div>
            </div>
          )}

          {error && (
            <div className="error-banner">⚠ {error}</div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form className="input-area" onSubmit={sendMessage}>
          <input
            ref={inputRef}
            className="chat-input"
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask a question about our product…"
            disabled={loading}
            autoFocus
          />
          <button className="send-btn" type="submit" disabled={loading || !input.trim()}>
            {loading ? '…' : '↑'}
          </button>
        </form>
      </div>
    </div>
  );
}
