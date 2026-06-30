'use client';
import { useState, useEffect, useRef } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function AiMentorPage() {
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attachments, setAttachments] = useState([]);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const token = localStorage.getItem('careeros_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`${BACKEND_URL}/api/profile`, { headers });
      const data = await res.json();
      if (data.success) setProfile(data.profile);
    } catch (err) {
      console.error('Profile load error:', err);
    } finally {
      setLoading(false);
    }
  }

  function dataURLtoBase64(dataUrl) {
    const comma = dataUrl.indexOf(',');
    return dataUrl.slice(comma + 1);
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        const mimeType = file.type || 'application/octet-stream';
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const isImage = mimeType.startsWith('image/');
        setAttachments(prev => [...prev, {
          id: Date.now() + Math.random(),
          name: file.name,
          mimeType,
          dataUrl,
          base64: dataURLtoBase64(dataUrl),
          isImage
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  function removeAttachment(id) {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }

  const sendMessage = async () => {
    if ((!chatInput.trim() && attachments.length === 0) || chatLoading) return;
    const userMsg = { role: 'user', content: chatInput || '(attachment)', attachments: [...attachments] };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const token = localStorage.getItem('careeros_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      const bodyAttachments = attachments.map(a => ({
        mime_type: a.mimeType,
        data: a.base64,
        file_name: a.name
      }));
      const res = await fetch(`${BACKEND_URL}/api/mentor/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: chatInput || '(attachment)',
          chatHistory: chatMessages.slice(-10),
          resumeText: profile?.resumeText || '',
          profile: {
            targetRole: profile?.targetRole || '',
            skills: profile?.skills || ''
          },
          attachments: bodyAttachments
        })
      });
      setAttachments([]);
      const data = await res.json();
      if (data.success) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.detail || 'Sorry, the mentor could not respond. Make sure API keys are configured in the backend.' }]);
      }
    } catch (err) {
      console.error('Mentor chat error:', err);
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Could not reach the backend. Make sure the server is running.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-transition p-4 md:p-8 max-w-4xl space-y-6">
        <div className="skeleton h-10 w-64" />
        <div className="skeleton h-6 w-96" />
        <div className="skeleton h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="page-transition p-4 md:p-8 max-w-4xl space-y-6 relative z-10 flex flex-col" style={{ height: '100%' }}>
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">AI Mentor</h1>
        <p className="text-on-surface-variant text-sm mt-1.5 font-medium">
          Get personalized career advice — skill recommendations, company suggestions, domain switching, salary guidance, and more.
        </p>
      </div>

      {/* Chat Container */}
      <div className="flex-1 flex flex-col space-y-4 min-h-0">
        {/* Chat Context Banner */}
        <div className="card-static p-4 flex items-center gap-3.5 border-outline-variant/30 bg-surface-container/20 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary/20 to-secondary/20 border border-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-xl">school</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-on-surface">Career Mentor</p>
            <p className="text-[10px] text-muted font-semibold mt-0.5">
              Aware of your profile{profile?.targetRole ? ` — targeting "${profile.targetRole}"` : ''}
            </p>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pb-4 pr-1">
          {chatMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-4">
              <div className="w-16 h-16 rounded-2xl bg-surface-container-high border border-outline-variant/30 flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-muted text-4xl">psychology</span>
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface">What would you like to discuss?</p>
                <p className="text-xs text-on-surface-variant font-medium mt-1">Choose a topic or type your own question</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                {[
                  { q: 'Which skill should I learn next for my target role?', icon: 'tips_and_updates' },
                  { q: 'Which companies are best for my career growth?', icon: 'business' },
                  { q: 'Should I switch domains? Give me a roadmap', icon: 'swap_horiz' },
                  { q: 'How should I negotiate my salary?', icon: 'attach_money' },
                  { q: 'What career path should I follow long-term?', icon: 'route' },
                  { q: 'How do I build a strong portfolio?', icon: 'folder' },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => setChatInput(item.q)}
                    className="card-static p-3.5 text-left text-xs font-bold text-on-surface-variant hover:border-primary/30 hover:text-on-surface hover:bg-surface-container/30 transition-all btn-hover border-outline-variant/30 flex items-center gap-2.5"
                  >
                    <span className="material-symbols-outlined text-primary text-base shrink-0">{item.icon}</span>
                    <span>{item.q}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-4 py-3 shadow-md ${
                msg.role === 'user'
                  ? 'bg-primary/10 text-on-surface border border-primary/20'
                  : 'card-static text-on-surface border border-outline-variant/30 bg-surface-container/40'
              }`}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary text-sm">school</span>
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">AI Mentor</span>
                  </div>
                )}
                {msg.attachments?.map((att, j) => (
                  att.isImage ? (
                    <img key={j} src={att.dataUrl} alt={att.name} className="max-w-full rounded-lg mb-2 max-h-60 object-contain border border-outline-variant/20" />
                  ) : (
                    <div key={j} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container/60 border border-outline-variant/20 mb-2 text-xs font-semibold text-on-surface-variant">
                      <span className="material-symbols-outlined text-base">description</span>
                      <span className="truncate">{att.name}</span>
                    </div>
                  )
                ))}
                <p className="text-sm whitespace-pre-wrap leading-relaxed font-semibold">{msg.content}</p>
              </div>
            </div>
          ))}

          {chatLoading && (
            <div className="flex justify-start">
              <div className="card-static px-4 py-3 flex items-center gap-2.5 border-outline-variant/30 bg-surface-container/20">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                <span className="text-xs text-muted font-bold uppercase tracking-wider">Mentor is thinking...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="flex gap-2 flex-wrap shrink-0 pb-1">
            {attachments.map(att => (
              <div key={att.id} className="relative group">
                {att.isImage ? (
                  <div className="relative w-16 h-16 rounded-lg border border-outline-variant/30 overflow-hidden">
                    <img src={att.dataUrl} alt={att.name} className="w-full h-full object-cover" />
                    <button onClick={() => removeAttachment(att.id)} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"><span className="material-symbols-outlined text-xs">close</span></button>
                  </div>
                ) : (
                  <div className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-outline-variant/30 bg-surface-container/40 text-xs font-semibold max-w-[180px]">
                    <span className="material-symbols-outlined text-base shrink-0">description</span>
                    <span className="truncate">{att.name}</span>
                    <button onClick={() => removeAttachment(att.id)} className="w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-xs shrink-0 ml-1"><span className="material-symbols-outlined text-[10px]">close</span></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Chat Input */}
        <div className="border-t border-outline-variant/20 pt-4 flex gap-3 shrink-0">
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask your AI Mentor anything..."
            className="flex-1 premium-input"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-3 rounded-lg border border-outline-variant/30 text-on-surface-variant hover:border-primary/40 hover:text-primary transition-all btn-hover flex items-center"
            title="Attach file or image"
          >
            <span className="material-symbols-outlined text-sm">attach_file</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.txt,.csv,.md"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={sendMessage}
            disabled={chatLoading || (!chatInput.trim() && attachments.length === 0)}
            className="px-5 py-3 bg-gradient-to-r from-primary to-secondary text-on-primary rounded-lg text-sm font-bold shadow-lg shadow-primary/20 btn-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm font-bold">send</span>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
