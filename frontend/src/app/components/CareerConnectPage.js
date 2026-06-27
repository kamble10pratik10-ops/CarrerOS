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

export default function CareerConnectPage({ onNavigate }) {
  const [tab, setTab] = useState('peers');

  return (
    <div className="page-transition p-8 max-w-6xl space-y-6 relative z-10">
      <div>
        <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">
          <span className="text-gradient-primary">Career Connect</span>
        </h1>
        <p className="text-on-surface-variant text-sm mt-1.5 font-medium">
          Find peers, chat, and discover companies hiring.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-surface-container/50 border border-outline-variant/20 w-fit">
        {[
          { id: 'peers', label: 'Peers', icon: 'group' },
          { id: 'messages', label: 'Messages', icon: 'chat' },
          { id: 'companies', label: 'Companies', icon: 'business' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === t.id ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-sm">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'peers' && <PeersTab onNavigate={onNavigate} />}
      {tab === 'messages' && <MessagesTab />}
      {tab === 'companies' && <CompaniesTab />}
    </div>
  );
}

// ─── PEERS TAB ────────────────────────────────────────

function PeersTab({ onNavigate }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [introLoading, setIntroLoading] = useState({});
  const [intros, setIntros] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [currentUserFollowing, setCurrentUserFollowing] = useState([]);
  const [profile, setProfile] = useState(null);

  useEffect(() => { loadMatches(); loadCurrentUserProfile(); }, []);

  async function loadCurrentUserProfile() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/profile`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success && data.profile) {
        setProfile(data.profile);
        setCurrentUserFollowing(data.profile.following || []);
      }
    } catch (e) { console.error(e); }
  }

  async function loadMatches() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/network/matches`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        if (data.message) setError(data.message);
        else setMatches(data.matches || []);
      } else setError(data.detail || 'Failed to load matches');
    } catch (err) {
      console.error(err);
      setError('Failed to fetch network matches.');
    } finally { setLoading(false); }
  }

  const generateIntro = async (targetEmail) => {
    setIntroLoading(prev => ({ ...prev, [targetEmail]: true }));
    try {
      const res = await fetch(`${BACKEND_URL}/api/network/intro`, {
        method: 'POST', headers: postHeaders(),
        body: JSON.stringify({ targetEmail })
      });
      const data = await res.json();
      if (data.success) setIntros(prev => ({ ...prev, [targetEmail]: data.intro }));
    } catch (err) { console.error(err); }
    finally { setIntroLoading(prev => ({ ...prev, [targetEmail]: false })); }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/network/search?q=${encodeURIComponent(searchQuery)}`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) setSearchResults(data.profiles || []);
    } catch (err) { console.error(err); }
    finally { setSearching(false); }
  };

  const toggleFollow = async (targetEmail) => {
    const isFollowing = currentUserFollowing.includes(targetEmail.toLowerCase());
    const endpoint = isFollowing ? '/api/network/unfollow' : '/api/network/follow';
    if (isFollowing) setCurrentUserFollowing(prev => prev.filter(e => e !== targetEmail.toLowerCase()));
    else setCurrentUserFollowing(prev => [...prev, targetEmail.toLowerCase()]);
    try {
      await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST', headers: postHeaders(),
        body: JSON.stringify({ targetEmail })
      });
    } catch (e) { console.error(e); }
  };

  const copyIntro = (targetEmail) => {
    const text = intros[targetEmail];
    if (text) navigator.clipboard.writeText(text);
  };

  const startChat = (email) => {
    // Navigate to messages tab with this user pre-selected
  };

  const renderUserCard = (user, isMatch = false) => {
    const isFollowing = currentUserFollowing.includes(user.email.toLowerCase());
    return (
      <div key={user.email} className="card-static flex flex-col border-outline-variant/30 overflow-hidden hover:border-primary/40 transition-colors">
        <div className="p-5 border-b border-outline-variant/15 flex items-center justify-between bg-surface-container-low/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-on-primary font-bold shadow-inner shrink-0">
              {user.photoUrl ? (
                <img src={user.photoUrl.startsWith('http') ? user.photoUrl : `${BACKEND_URL}${user.photoUrl}`} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-base">{user.name ? user.name.charAt(0).toUpperCase() : '?'}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-on-surface truncate">{user.name || user.email}</p>
              <p className="text-[11px] text-primary font-bold uppercase tracking-wider truncate">{user.targetRole || user.role || 'Peer'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isMatch && (
              <div className="flex flex-col items-end mr-1">
                <span className="text-lg font-extrabold text-on-surface tracking-tighter">{user.score}%</span>
                <span className="text-[8px] text-muted font-bold uppercase tracking-widest">Match</span>
              </div>
            )}
            <button onClick={() => toggleFollow(user.email)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                isFollowing ? 'bg-surface-container text-on-surface border border-outline-variant/30' : 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'
              }`}>
              {isFollowing ? 'Following' : 'Add Friend'}
            </button>
          </div>
        </div>

        {isMatch && (
          <div className="p-5 flex-1 flex flex-col space-y-4">
            <div>
              <h4 className="text-[10px] font-extrabold text-muted uppercase tracking-widest mb-2">Why you match</h4>
              <ul className="space-y-1.5">
                {user.reasons?.map((reason, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-success text-[14px] mt-0.5">check_circle</span>
                    <span className="text-xs text-on-surface-variant font-medium leading-relaxed">{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={() => toggleFollow(user.email)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
              currentUserFollowing.includes(user.email.toLowerCase()) ? 'bg-surface-container text-on-surface border border-outline-variant/30' : 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'
            }`}>
            {currentUserFollowing.includes(user.email.toLowerCase()) ? 'Following' : 'Add Friend'}
          </button>
          <button onClick={() => {/* navigate to messages */}}
            className="flex-1 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant/30 text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
            <span className="material-symbols-outlined text-sm">chat</span> Message
          </button>
          {!intros[user.email] ? (
            <button onClick={() => generateIntro(user.email)} disabled={introLoading[user.email]}
              className="flex-1 py-2 rounded-lg bg-secondary/10 text-secondary hover:bg-secondary/20 border border-secondary/20 text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
              {introLoading[user.email] ? (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-secondary/30 border-t-secondary animate-spin" />
              ) : (
                <><span className="material-symbols-outlined text-sm">auto_awesome</span> AI Intro</>
              )}
            </button>
          ) : (
            <div className="flex-1 relative">
              <div className="p-2 bg-surface-container-high rounded-lg border border-outline-variant/20 text-[10px] text-on-surface leading-relaxed line-clamp-3">{intros[user.email]}</div>
              <div className="flex gap-1 mt-1">
                <button onClick={() => copyIntro(user.email)} className="flex-1 py-1 rounded bg-surface-container hover:bg-surface-container-highest text-xs text-on-surface-variant transition-colors"><span className="material-symbols-outlined text-[12px]">content_copy</span></button>
                <a href={`mailto:${user.email}?subject=CareerOS Connection&body=${encodeURIComponent(intros[user.email])}`} className="flex-1 py-1 rounded bg-surface-container hover:bg-surface-container-highest text-xs text-on-surface-variant transition-colors text-center"><span className="material-symbols-outlined text-[12px]">mail</span></a>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-64" />
        <div className="skeleton h-6 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-48 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-4">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-muted">search</span>
          <input type="text" placeholder="Search for peers by name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-surface-container/50 border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:outline-none focus:border-primary/50 focus:bg-surface-container transition-all" />
        </div>
        <button type="submit" disabled={searching} className="px-6 py-3 bg-primary text-on-primary rounded-xl text-sm font-bold shadow-lg shadow-primary/25 btn-hover disabled:opacity-50 flex items-center gap-2">
          {searching ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : 'Search'}
        </button>
      </form>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-extrabold text-on-surface">Search Results</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {searchResults.map(user => renderUserCard(user, false))}
          </div>
        </div>
      )}

      {/* AI Matches */}
      {error ? (
        <div className="card-static p-12 flex flex-col items-center gap-4 text-center border-dashed">
          <span className="material-symbols-outlined text-muted text-5xl">visibility_off</span>
          <h2 className="text-lg font-bold text-on-surface mt-2">Opt-in Required</h2>
          <p className="text-sm text-on-surface-variant font-medium max-w-md">{error}</p>
          <button onClick={() => onNavigate?.('profile')} className="mt-4 px-6 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold shadow-lg shadow-primary/25 btn-hover">Update Profile Settings</button>
        </div>
      ) : matches.length === 0 ? (
        <div className="card-static p-12 flex flex-col items-center gap-4 text-center border-dashed">
          <span className="material-symbols-outlined text-muted text-5xl">group_off</span>
          <h2 className="text-lg font-bold text-on-surface mt-2">No Matches Found</h2>
          <p className="text-sm text-on-surface-variant font-medium max-w-md">We couldn't find any peers that match your current profile criteria. Try updating your goals, skills, and hackathons to cast a wider net!</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card-static p-5 border-l-4 border-l-secondary bg-secondary/2">
            <div className="flex items-start gap-3.5">
              <span className="material-symbols-outlined text-secondary text-xl shrink-0 mt-0.5">auto_awesome</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-on-surface">AI Matchmaking Active</p>
                <p className="text-xs text-on-surface-variant mt-1.5 font-medium">We scanned other discoverable users and found {matches.length} strong peers for you based on complementary skills and shared goals.</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {matches.map(match => renderUserCard(match, true))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MESSAGES TAB ─────────────────────────────────────

function MessagesTab() {
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [profiles, setProfiles] = useState({});
  const chatEndRef = useRef(null);

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function loadConversations() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/conversations`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        setConversations(data.conversations || []);
        const profileMap = {};
        (data.conversations || []).forEach(c => { profileMap[c.email] = { name: c.name, photoUrl: c.photoUrl }; });
        setProfiles(profileMap);
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

  async function sendMessage() {
    if (!input.trim() || !activeChat || sending) return;
    setSending(true);
    const text = input;
    setInput('');
    const optimisticMsg = { id: `opt_${Date.now()}`, sender: 'you', text, timestamp: Date.now() };
    setMessages(prev => [...prev, optimisticMsg]);
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
    finally { setSending(false); }
  }

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="grid grid-cols-[280px_1fr] gap-4 h-[60vh]">
        <div className="skeleton h-full rounded-xl" />
        <div className="skeleton h-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[280px_1fr] gap-4 h-[60vh] min-h-[400px] border border-outline-variant/20 rounded-xl overflow-hidden bg-surface-container/20">
      {/* Conversation List */}
      <div className="border-r border-outline-variant/15 overflow-y-auto custom-scrollbar bg-surface-container-low/20">
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <span className="material-symbols-outlined text-muted text-3xl mb-2">chat_bubble</span>
            <p className="text-xs text-on-surface-variant font-semibold">No conversations yet</p>
            <p className="text-[10px] text-muted mt-1">Start by adding friends in the Peers tab!</p>
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
                {conv.sender === 'you' ? 'You: ' : ''}{conv.lastMessage}
              </p>
            </div>
            <span className="text-[9px] text-muted font-semibold shrink-0">{formatTime(conv.timestamp)}</span>
          </button>
        ))}
      </div>

      {/* Chat Area */}
      <div className="flex flex-col">
        {!activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <span className="material-symbols-outlined text-muted text-5xl mb-3">chat</span>
            <p className="text-sm font-bold text-on-surface">Select a conversation</p>
            <p className="text-xs text-on-surface-variant mt-1 font-medium">Choose a peer from the list to start chatting.</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-3.5 border-b border-outline-variant/15 flex items-center gap-3 bg-surface-container-low/30">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-on-primary text-xs font-bold shrink-0">
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
                const isMe = msg.sender === 'you' || msg.sender === localStorage.getItem('careeros_email')?.toLowerCase();
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
  );
}

// ─── COMPANIES TAB ─────────────────────────────────────

function CompaniesTab() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [interested, setInterested] = useState({});

  useEffect(() => { loadCompanies(); }, []);

  async function loadCompanies(q) {
    setLoading(true);
    try {
      const url = q ? `${BACKEND_URL}/api/companies?q=${encodeURIComponent(q)}` : `${BACKEND_URL}/api/companies`;
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        setCompanies(data.companies || []);
        const intMap = {};
        (data.companies || []).forEach(c => { intMap[c.id] = !!c.interested; });
        setInterested(intMap);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function handleSearch(e) {
    e.preventDefault();
    loadCompanies(search);
  }

  async function toggleInterest(companyId) {
    const was = interested[companyId];
    setInterested(prev => ({ ...prev, [companyId]: !was }));
    try {
      await fetch(`${BACKEND_URL}/api/companies/connect`, {
        method: 'POST', headers: postHeaders(),
        body: JSON.stringify({ targetEmail: companyId })
      });
    } catch (e) { console.error(e); }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton h-40 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="flex gap-4">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-muted">search</span>
          <input type="text" placeholder="Search companies by name, industry, or location..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-surface-container/50 border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:outline-none focus:border-primary/50 focus:bg-surface-container transition-all" />
        </div>
        <button type="submit" className="px-6 py-3 bg-primary text-on-primary rounded-xl text-sm font-bold shadow-lg shadow-primary/25 btn-hover">Search</button>
      </form>

      {companies.length === 0 ? (
        <div className="card-static p-12 flex flex-col items-center gap-4 text-center border-dashed">
          <span className="material-symbols-outlined text-muted text-5xl">business_off</span>
          <h2 className="text-lg font-bold text-on-surface mt-2">No Companies Found</h2>
          <p className="text-sm text-on-surface-variant font-medium max-w-md">Try a different search term.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map(c => (
            <div key={c.id} className={`card-static p-5 border-outline-variant/30 hover:border-primary/40 transition-all flex flex-col ${
              interested[c.id] ? 'border-l-4 border-l-secondary' : ''
            }`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-outline-variant/30 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-lg">business</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-on-surface truncate">{c.name}</p>
                    <p className="text-[10px] text-primary font-bold uppercase tracking-wider truncate">{c.industry}</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-on-surface-variant font-medium leading-relaxed mb-3 flex-1">{c.description}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted font-semibold mb-3">
                <span className="material-symbols-outlined text-[12px]">location_on</span>
                <span className="truncate">{c.location}</span>
              </div>
              <div className="flex gap-2 mt-auto">
                <a href={c.website} target="_blank" rel="noopener noreferrer"
                  className="flex-1 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant/30 text-xs font-bold transition-colors text-center flex items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-sm">open_in_new</span> Careers
                </a>
                <button onClick={() => toggleInterest(c.id)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                    interested[c.id] ? 'bg-secondary/10 text-secondary border border-secondary/20' : 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'
                  }`}>
                  <span className="material-symbols-outlined text-sm">{interested[c.id] ? 'check' : 'add'}</span>
                  {interested[c.id] ? 'Interested' : 'Interested'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
