'use client';

import { useState, useEffect, useRef } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

function getHeaders() {
  const token = localStorage.getItem('careeros_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function postHeaders() {
  return { 'Content-Type': 'application/json', ...getHeaders() };
}

export default function MessagesPage({ initialUser, onUserSelect }) {
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [profiles, setProfiles] = useState({});
  const [connected, setConnected] = useState(false);
  const chatEndRef = useRef(null);
  const wsRef = useRef(null);
  const myEmail = localStorage.getItem('careeros_email')?.toLowerCase();
  const initialHandledRef = useRef(false);

  // Load conversations and connect WebSocket on mount
  useEffect(() => {
    loadConversations();
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Direct effect for initialUser — immediately opens the chat
  useEffect(() => {
    if (initialUser?.email && !activeChat && !initialHandledRef.current) {
      initialHandledRef.current = true;
      startNewChat(initialUser);
    }
  }, [initialUser]);

  // Refresh conversation list every 3s as fallback when WebSocket disconnected
  useEffect(() => {
    if (connected) return;
    const interval = setInterval(loadConversations, 3000);
    return () => clearInterval(interval);
  }, [connected]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function connectWebSocket() {
    const token = localStorage.getItem('careeros_token');
    if (!token) return;

    const wsUrl = `${BACKEND_URL.replace('http://', 'ws://')}/ws?token=${token}`;
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
      };

      ws.onerror = () => {
        setConnected(false);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'message') {
            const msg = data.message;
            setMessages(prev => {
              const optimisticIdx = prev.findIndex(
                m => m.id?.startsWith('opt_') && m.text === msg.text && m.sender === msg.sender
              );
              if (optimisticIdx >= 0) {
                const updated = [...prev];
                updated[optimisticIdx] = msg;
                return updated;
              }
              const exists = prev.some(m => m.id === msg.id);
              if (exists) return prev;
              if (msg.sender === myEmail || msg.receiver === myEmail) {
                return [...prev, msg];
              }
              return prev;
            });
            loadConversations();
          }
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };
    } catch (e) {
      console.error('WS connection error:', e);
    }
  }

  async function loadConversations() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/conversations`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        setConversations(data.conversations || []);
        const profileMap = {};
        (data.conversations || []).forEach(c => {
          profileMap[c.email] = { name: c.name, photoUrl: c.photoUrl };
        });
        setProfiles(prev => ({ ...prev, ...profileMap }));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function loadChatHistory(otherEmail) {
    setActiveChat(otherEmail);
    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/history?user2=${encodeURIComponent(otherEmail)}`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) setMessages(data.messages || []);
    } catch (e) { console.error(e); }
  }

  function startNewChat(user) {
    if (!user?.email) return;
    setActiveChat(user.email);
    onUserSelect?.(user);
    setMessages([]);
    setProfiles(prev => ({
      ...prev,
      [user.email]: { name: user.name, photoUrl: user.photoUrl }
    }));
  }

  async function sendMessage() {
    if (!input.trim() || !activeChat || sending) return;
    setSending(true);
    const text = input;
    setInput('');
    const optimisticMsg = {
      id: `opt_${Date.now()}`,
      sender: myEmail,
      receiver: activeChat,
      text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, optimisticMsg]);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'send_message', receiver: activeChat, text }));
    } else {
      try {
        const res = await fetch(`${BACKEND_URL}/api/chat/send`, {
          method: 'POST', headers: postHeaders(),
          body: JSON.stringify({ receiver: activeChat, text })
        });
        const data = await res.json();
        if (data.success) {
          setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? data.message : m));
          loadConversations();
        }
      } catch (e) { console.error(e); }
    }
    setSending(false);
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return formatTime(ts);
    if (diff < 172800000) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col glass-panel">
        <div className="flex items-center justify-between p-4 border-b border-outline-variant/20">
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-3xl text-on-surface">chat</span>
            <div>
              <h1 className="text-xl font-bold text-on-surface">Messages</h1>
              <p className="text-sm text-on-surface-variant">Connect with recruiters & peers</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex overflow-hidden">
          <div className="w-full md:w-80 border-r border-outline-variant/20 skeleton h-full" />
          <div className="flex-1 skeleton h-full hidden md:block" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col glass-panel">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-outline-variant/20">
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-3xl text-on-surface">chat</span>
          <div>
            <h1 className="text-xl font-bold text-on-surface">Messages</h1>
            <p className="text-sm text-on-surface-variant">Connect with recruiters & peers</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-success' : 'bg-muted'} transition-colors`} />
            <span className="text-[10px] text-on-surface-variant font-medium">{connected ? 'Connected' : 'Offline'}</span>
          </div>
          <button onClick={() => {
            initialHandledRef.current = false;
            setActiveChat(null);
          }} className="btn-primary text-sm">
            <span className="material-symbols-outlined mr-2">add</span>
            New Chat
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Conversation List - drawer on mobile, sidebar on desktop */}
        <aside className={`${activeChat ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col overflow-hidden border-r border-outline-variant/20`}>
          <div className="flex items-center justify-between p-3 border-b border-outline-variant/20 md:hidden">
            <span className="text-sm font-bold text-on-surface">Conversations</span>
            <button onClick={() => {
              initialHandledRef.current = false;
              setActiveChat(null);
            }} className="btn-primary text-sm">
              <span className="material-symbols-outlined mr-2">add</span>
              New Chat
            </button>
          </div>
          <div className="p-3 border-b border-outline-variant/20">
            <input
              type="text"
              placeholder="Search messages..."
              className="w-full px-4 py-2 rounded-lg bg-surface-container-highest border border-outline-variant/20 text-on-surface placeholder-on-surface-variant text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 && !activeChat && (
              <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <span className="material-symbols-outlined text-muted text-3xl mb-2">chat_bubble</span>
                <p className="text-xs text-on-surface-variant font-semibold">No conversations yet</p>
                <p className="text-[10px] text-muted mt-1">Start by messaging someone from Peers tab!</p>
              </div>
            )}
            {conversations.map(conv => (
              <button key={conv.email} onClick={() => loadChatHistory(conv.email)}
                className={`w-full p-3.5 text-left transition-colors hover:bg-surface-container/60 border-b border-outline-variant/10 flex items-center gap-3 ${
                  activeChat === conv.email ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                }`}>
                <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-on-primary text-sm font-bold shrink-0">
                  {profiles[conv.email]?.photoUrl ? (
                    <img src={profiles[conv.email].photoUrl.startsWith('http') ? profiles[conv.email].photoUrl : `${BACKEND_URL}${profiles[conv.email].photoUrl}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (profiles[conv.email]?.name || conv.email).charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-on-surface truncate">{profiles[conv.email]?.name || conv.email}</p>
                  <p className="text-[10px] text-muted font-medium truncate mt-0.5">
                    {conv.sender === myEmail ? 'You: ' : ''}{conv.lastMessage}
                  </p>
                </div>
                <span className="text-[9px] text-muted font-semibold shrink-0">{formatDate(conv.timestamp)}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Chat Area */}
        <div className={`${!activeChat ? 'hidden md:flex' : 'flex'} flex-1 flex-col overflow-hidden`}>
          {!activeChat ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <span className="material-symbols-outlined text-muted text-5xl mb-3">chat</span>
              <p className="text-sm font-bold text-on-surface">Select a conversation</p>
              <p className="text-xs text-on-surface-variant mt-1 font-medium">Choose a peer from the list or start a new chat.</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 p-4 border-b border-outline-variant/20">
                <button onClick={() => setActiveChat(null)} className="p-1 -ml-1 rounded-lg hover:bg-surface-container/60 text-on-surface-variant md:hidden" aria-label="Back to conversations">
                  <span className="material-symbols-outlined text-xl">arrow_back</span>
                </button>
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-on-primary text-xs font-bold shrink-0">
                  {profiles[activeChat]?.photoUrl ? (
                    <img src={profiles[activeChat].photoUrl.startsWith('http') ? profiles[activeChat].photoUrl : `${BACKEND_URL}${profiles[activeChat].photoUrl}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (profiles[activeChat]?.name || activeChat).charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-on-surface truncate">{profiles[activeChat]?.name || activeChat}</p>
                  <p className="text-[10px] text-muted font-medium">{activeChat}</p>
                </div>
                <div className="flex-1" />
                <span className={`flex items-center gap-1 text-[10px] ${connected ? 'text-success' : 'text-muted'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-success' : 'bg-muted'}`} />
                  {connected ? 'Online' : 'Offline'}
                </span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <span className="material-symbols-outlined text-muted text-3xl mb-2">sms</span>
                    <p className="text-xs text-on-surface-variant font-semibold">No messages yet</p>
                    <p className="text-[10px] text-muted mt-1">Say hello to start the conversation!</p>
                  </div>
                )}
                {messages.map((msg, i) => {
                  const isMe = msg.sender === myEmail;
                  return (
                    <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-xl px-3.5 py-2.5 shadow-sm ${
                        isMe ? 'bg-primary/10 border border-primary/20' : 'bg-surface-container-high border border-outline-variant/20'
                      }`}>
                        <p className="text-xs whitespace-pre-wrap leading-relaxed font-semibold">{msg.text}</p>
                        <p className={`text-[9px] mt-1 font-semibold ${isMe ? 'text-primary/60 text-right' : 'text-muted'}`}>
                          {formatTime(msg.timestamp || msg.id?.replace('opt_', ''))}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="p-3.5 border-t border-outline-variant/15 flex gap-2 bg-surface-container-low/20">
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Type a message..." className="flex-1 premium-input text-sm" />
                <button onClick={sendMessage} disabled={!input.trim() || sending}
                  className="px-4 py-2.5 bg-gradient-to-r from-primary to-secondary text-on-primary rounded-lg text-xs font-bold shadow-lg shadow-primary/20 btn-hover disabled:opacity-40 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">send</span>
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}