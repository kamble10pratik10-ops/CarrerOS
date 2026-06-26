'use client';
import { useState, useEffect, useRef } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function CareerTwinPage() {
  const [applications, setApplications] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('skills'); // skills | roadmap | mentor
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  
  // Simulator State
  const [selectedJdId, setSelectedJdId] = useState(null);
  const [interviewMessages, setInterviewMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const interviewEndRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const sendInterviewMessageRef = useRef(null);
  
  const [interviewResult, setInterviewResult] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [analyticsTab, setAnalyticsTab] = useState('overview');

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (selectedJdId && !interviewResult && !isEvaluating && interviewMessages.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [selectedJdId, interviewResult, isEvaluating, interviewMessages]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    interviewEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interviewMessages]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      
      let localFinal = '';
      rec.onstart = () => {
         setIsListening(true);
         localFinal = '';
         setFinalTranscript('');
         setInterimTranscript('');
      };
      rec.onend = () => setIsListening(false);
      rec.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            localFinal += event.results[i][0].transcript + ' ';
            setFinalTranscript(localFinal);
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setInterimTranscript(interim);
        
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
           const fullText = (localFinal + ' ' + interim).trim();
           if (fullText && sendInterviewMessageRef.current) {
              sendInterviewMessageRef.current(fullText);
              setFinalTranscript('');
              setInterimTranscript('');
              localFinal = '';
           }
           if (rec) rec.stop();
        }, 3000);
      };
      setRecognition(rec);
    }
  }, [selectedJdId]);

  async function loadData() {
    try {
      const token = localStorage.getItem('careeros_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const [appsRes, profileRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/analyze`, { headers }),
        fetch(`${BACKEND_URL}/api/profile`, { headers })
      ]);
      const appsData = await appsRes.json();
      const profileData = await profileRes.json();
      if (appsData.success) setApplications(appsData.applications || []);
      if (profileData.success) setProfile(profileData.profile);
    } catch (err) {
      console.error('Career Twin load error:', err);
    } finally {
      setLoading(false);
    }
  }

  // --- Aggregate skill gaps across all analyzed JDs ---
  const aggregateGaps = () => {
    const gapMap = {};
    applications.forEach(app => {
      const gaps = app.gaps || [];
      gaps.forEach(gap => {
        const key = gap.text?.toLowerCase().trim();
        if (!key) return;
        if (!gapMap[key]) {
          gapMap[key] = { text: gap.text, type: gap.type, count: 0, companies: [] };
        }
        gapMap[key].count += 1;
        if (app.company && !gapMap[key].companies.includes(app.company)) {
          gapMap[key].companies.push(app.company);
        }
      });
    });
    // Sort by frequency
    return Object.values(gapMap).sort((a, b) => b.count - a.count);
  };

  // --- Aggregate common keywords from skill gaps ---
  const getSkillFrequency = () => {
    const skillMap = {};
    applications.forEach(app => {
      const gaps = app.gaps || [];
      gaps.forEach(gap => {
        // Extract keywords (simple heuristic — split on common delimiters)
        const words = (gap.text || '').split(/[,;.\/\-]/).map(w => w.trim()).filter(w => w.length > 2);
        words.forEach(word => {
          const key = word.toLowerCase();
          if (!skillMap[key]) {
            skillMap[key] = { skill: word, count: 0, type: gap.type };
          }
          skillMap[key].count += 1;
        });
      });
    });
    return Object.values(skillMap).sort((a, b) => b.count - a.count).slice(0, 12);
  };

  // --- Chat with AI Mentor ---
  const sendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMsg = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const gapSummary = aggregateGaps()
        .slice(0, 5)
        .map(g => `"${g.text}" (seen in ${g.count} JD${g.count > 1 ? 's' : ''})`)
        .join(', ');

      const contextPrefix = `[Context: The user has analyzed ${applications.length} job descriptions. Top skill gaps: ${gapSummary || 'none yet'}. Target role: ${profile?.targetRole || 'not set'}] `;

      const token = localStorage.getItem('careeros_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      const res = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: contextPrefix + chatInput,
          chatHistory: chatMessages.slice(-10),
          resumeText: profile?.resumeText || '',
          currentJdText: ''
        })
      });
      const data = await res.json();
      if (data.success) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const speakResponse = (text) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      // Try to find a good voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Premium')) || voices[0];
      if (preferredVoice) utterance.voice = preferredVoice;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const sendInterviewMessage = async (text) => {
    if (!text.trim() || interviewLoading) return;
    
    const userMsg = { role: 'user', content: text };
    setInterviewMessages(prev => [...prev, userMsg]);
    setInterviewLoading(true);

    try {
      const selectedApp = applications.find(a => a.id === selectedJdId);
      const token = localStorage.getItem('careeros_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      
      const res = await fetch(`${BACKEND_URL}/api/interview-chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: text,
          chatHistory: interviewMessages.slice(-10),
          resumeText: profile?.resumeText || '',
          currentJdText: selectedApp?.jdText || ''
        })
      });
      const data = await res.json();
      if (data.success) {
        setInterviewMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
        speakResponse(data.reply);
      }
    } catch (err) {
      console.error('Interview chat error:', err);
      setInterviewMessages(prev => [...prev, { role: 'assistant', content: 'Connection issue. Please repeat.' }]);
    } finally {
      setInterviewLoading(false);
    }
  };

  useEffect(() => {
    sendInterviewMessageRef.current = sendInterviewMessage;
  }, [sendInterviewMessage]);

  const toggleListening = () => {
    if (!recognition) {
       alert("Speech Recognition API is not supported in this browser.");
       return;
    }
    if (isListening) {
      recognition.stop();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      const fullText = (finalTranscript + ' ' + interimTranscript).trim();
      if (fullText) {
         sendInterviewMessage(fullText);
      }
      setFinalTranscript('');
      setInterimTranscript('');
    } else {
      // If synthesis is speaking, stop it so we can listen
      if (isSpeaking && window.speechSynthesis) {
         window.speechSynthesis.cancel();
         setIsSpeaking(false);
      }
      setFinalTranscript('');
      setInterimTranscript('');
      recognition.start();
    }
  };

  const handleExitInterview = () => {
    if (selectedJdId && !interviewResult && interviewMessages.length > 0) {
      if (!window.confirm("Are you sure you want to exit? Your interview progress will be lost.")) return;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (recognition) recognition.stop();
    setSelectedJdId(null);
    setInterviewResult(null);
    setInterviewMessages([]);
  };

  const handleTabChange = (tabId) => {
    if (activeTab === 'simulator' && selectedJdId && !interviewResult && interviewMessages.length > 0) {
       if (!window.confirm("Are you sure you want to exit? Your interview progress will be lost.")) return;
       if (window.speechSynthesis) window.speechSynthesis.cancel();
       if (recognition) recognition.stop();
    }
    setActiveTab(tabId);
  };

  const endInterview = async () => {
    if (recognition) recognition.stop();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsEvaluating(true);
    
    try {
      const selectedApp = applications.find(a => a.id === selectedJdId);
      const token = localStorage.getItem('careeros_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      
      const res = await fetch(`${BACKEND_URL}/api/evaluate-interview`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          chatHistory: interviewMessages,
          currentJdText: selectedApp?.jdText || ''
        })
      });
      const data = await res.json();
      if (data.success) {
        setInterviewResult(data.evaluation);
      }
    } catch (err) {
      console.error('Interview evaluation error:', err);
      alert('Failed to evaluate interview. Please try again.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const allGaps = aggregateGaps();
  const skillFreqs = getSkillFrequency();
  const totalJDs = applications.length;

  if (loading) {
    return (
      <div className="page-transition p-8 max-w-5xl space-y-6">
        <div className="skeleton h-10 w-64" />
        <div className="skeleton h-6 w-96" />
        <div className="flex gap-2">
          {[1,2,3].map(i => <div key={i} className="skeleton h-10 w-28 rounded-lg" />)}
        </div>
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="page-transition p-8 max-w-5xl space-y-6 relative z-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">Career Twin</h1>
        <p className="text-on-surface-variant text-sm mt-1.5 font-medium">
          Aggregate insights from all your analyzed JDs to guide long-term growth.
          {totalJDs > 0 && ` Compiled from ${totalJDs} analyzed job description${totalJDs !== 1 ? 's' : ''}.`}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 bg-surface-container-low/60 border border-outline-variant/30 rounded-xl p-1.5 self-start max-w-md">
        {[
          { id: 'skills', label: 'Skill Gap Map', icon: 'psychology' },
          { id: 'roadmap', label: 'Career Roadmap', icon: 'route' },
          { id: 'mentor', label: 'AI Mentor', icon: 'smart_toy' },
          { id: 'simulator', label: 'AI Recruiter Simulator', icon: 'mic' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-primary text-on-primary shadow-sm shadow-primary/10'
                : 'text-on-surface-variant hover:bg-surface-container-high/40 hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {totalJDs === 0 && (
        <div className="card-static p-16 flex flex-col items-center gap-4 text-center max-w-xl mx-auto mt-8 border-dashed">
          <div className="w-14 h-14 rounded-2xl bg-surface-container-high border border-outline-variant/30 flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined text-muted text-4xl">psychology</span>
          </div>
          <h2 className="text-lg font-bold text-on-surface mt-2">No twin compiled yet</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed max-w-sm font-medium">
            Analyze Job Descriptions in the Job Mission page to build your Career Twin. The more JDs you analyze, the smarter your insights become.
          </p>
        </div>
      )}

      {/* SKILL GAP MAP */}
      {activeTab === 'skills' && totalJDs > 0 && (
        <div className="page-transition space-y-6">
          {/* Summary Card */}
          <div className="card-static p-5 border-l-4 border-l-primary bg-primary/2">
            <div className="flex items-start gap-3.5">
              <span className="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5">insights</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-on-surface">
                  Twin analysis based on <strong>{totalJDs}</strong> analyzed JD{totalJDs !== 1 ? 's' : ''}
                  {profile?.targetRole ? ` for "${profile.targetRole}"` : ''}
                </p>
                <p className="text-xs text-on-surface-variant mt-1.5 font-medium">
                  We found {allGaps.length} unique skill gap{allGaps.length !== 1 ? 's' : ''}.
                  {allGaps.length > 0 && ` The most common gap appeared in ${allGaps[0]?.count} JDs.`}
                </p>
              </div>
            </div>
          </div>

          {/* Gap List */}
          {allGaps.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted uppercase tracking-widest">Recurring Gaps</h3>
              {allGaps.map((gap, i) => (
                <div key={i} className="card-static p-4 flex items-center gap-4 border-outline-variant/30">
                  {/* Frequency indicator */}
                  <div className="flex flex-col items-center min-w-[55px] text-center border-r border-outline-variant/20 pr-4">
                    <span className={`text-xl font-extrabold tracking-tight ${
                      gap.count >= 3 ? 'text-error' : gap.count >= 2 ? 'text-warning' : 'text-primary'
                    }`}>
                      {gap.count}x
                    </span>
                    <span className="text-[9px] text-muted font-bold mt-0.5 uppercase tracking-wide">
                      {Math.round((gap.count / totalJDs) * 100)}% JDs
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${
                        gap.type === 'MISSING KEYWORD' ? 'bg-error/10 text-error border-error/20' :
                        gap.type === 'SKILL MISMATCH' ? 'bg-warning/10 text-warning border-warning/20' :
                        'bg-primary/10 text-primary border-primary/20'
                      }`}>
                        {gap.type}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-on-surface">{gap.text}</p>
                    {gap.companies.length > 0 && (
                      <p className="text-[10px] text-muted font-semibold mt-1">
                        Seen in: {gap.companies.join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Priority bar */}
                  <div className="hidden sm:block w-20 h-2 bg-surface-container-high rounded-full overflow-hidden shrink-0 border border-white/5">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min((gap.count / totalJDs) * 100, 100)}%`,
                        background: gap.count >= 3 ? 'linear-gradient(90deg, #F43F5E, #E11D48)' :
                                     gap.count >= 2 ? 'linear-gradient(90deg, #F59E0B, #D97706)' : 'linear-gradient(90deg, #2DD4BF, #06B6D4)'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CAREER ROADMAP */}
      {activeTab === 'roadmap' && totalJDs > 0 && (
        <div className="page-transition space-y-6">
          <div className="card-static p-5 border-l-4 border-l-secondary bg-secondary/2">
            <div className="flex items-start gap-3.5">
              <span className="material-symbols-outlined text-secondary text-xl shrink-0 mt-0.5">route</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-on-surface">
                  Your personalized career roadmap.
                </p>
                <p className="text-xs text-on-surface-variant mt-1.5 font-medium leading-relaxed">
                  Focus on critical gaps first (occurring in 3+ JDs). They represent the highest-yield learning targets for your profile.
                </p>
              </div>
            </div>
          </div>

          {allGaps.length === 0 ? (
            <div className="card-static p-8 text-center border-dashed">
              <p className="text-sm text-on-surface-variant font-medium">Analyze more JDs to generate priority tiers.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Priority Tiers */}
              {[
                { label: '🔴 Critical Priority Target', filter: g => g.count >= 3, desc: 'Appeared in 3+ analyzed JDs — essential missing skills for your target role.', borderClass: 'border-l-4 border-l-error' },
                { label: '🟡 High Priority Target', filter: g => g.count === 2, desc: 'Appeared in 2 analyzed JDs — strong skill signal worth pursuing.', borderClass: 'border-l-4 border-l-warning' },
                { label: '🟢 General Improvement Target', filter: g => g.count === 1, desc: 'Appeared in 1 analyzed JD — nice-to-have items to differentiate yourself.', borderClass: 'border-l-4 border-l-success' },
              ].map(tier => {
                const gaps = allGaps.filter(tier.filter);
                if (gaps.length === 0) return null;
                return (
                  <div key={tier.label} className={`card-static p-5 space-y-3.5 border-outline-variant/30 ${tier.borderClass}`}>
                    <div>
                      <h3 className="text-sm font-bold text-on-surface">{tier.label}</h3>
                      <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">{tier.desc}</p>
                    </div>
                    <div className="space-y-2.5">
                      {gaps.map((gap, i) => (
                        <div key={i} className="flex items-start gap-3 py-2.5 border-b border-outline-variant/15 last:border-0">
                          <span className="material-symbols-outlined text-muted text-sm mt-0.5">check_box_outline_blank</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-on-surface leading-relaxed">{gap.text}</p>
                            <p className="text-[10px] text-muted font-bold mt-1 uppercase tracking-wider">
                              {gap.type} • {gap.count} JD{gap.count > 1 ? 's' : ''} • {gap.companies.join(', ')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Actionable Suggestion */}
              <div className="card-static p-5 bg-primary/3 border border-primary/15">
                <div className="flex items-start gap-3.5">
                  <span className="material-symbols-outlined text-primary text-lg mt-0.5">lightbulb</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-on-surface">Recommended Next Action</p>
                    <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed font-semibold">
                      {allGaps[0]
                        ? `Start a learning plan for "${allGaps[0].text}" (appeared in ${allGaps[0].count} of your ${totalJDs} JDs). Switch to the AI Mentor tab to request a projects blueprint.`
                        : 'Continue analyzing job descriptions to map target priorities.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI MENTOR CHAT */}
      {activeTab === 'mentor' && (
        <div className="page-transition flex flex-col space-y-4" style={{ height: 'calc(100vh - 280px)' }}>
          {/* Chat Context Banner */}
          <div className="card-static p-4 flex items-center gap-3.5 border-outline-variant/30 bg-surface-container/20">
            <span className="material-symbols-outlined text-secondary text-xl shrink-0">smart_toy</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-on-surface">AI Mentor CommandCenter</p>
              <p className="text-[10px] text-muted font-semibold mt-0.5">
                Aware of resume specs, {totalJDs} audited jobs, and {allGaps.length} logged gaps.
              </p>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pb-4 pr-1">
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-4">
                <span className="material-symbols-outlined text-muted text-4xl">forum</span>
                <div>
                  <p className="text-sm font-bold text-on-surface">Consult your AI Career Mentor</p>
                  <p className="text-xs text-on-surface-variant font-medium mt-1">Tap a prompt below to request instant blueprints:</p>
                </div>
                <div className="grid grid-cols-1 gap-2 w-full max-w-lg">
                  {[
                    'What project should I build to learn my top missing skill?',
                    'How should I prepare for my next interview?',
                    'What are the most common skills in my target roles?',
                    'Help me write a cold email for my dream company.',
                  ].map((q, i) => (
                    <button
                      key={i}
                      onClick={() => { setChatInput(q); }}
                      className="card-static p-3 text-left text-xs font-bold text-on-surface-variant hover:border-primary/30 hover:text-on-surface hover:bg-surface-container/30 transition-all btn-hover"
                    >
                      "{q}"
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] rounded-xl px-4 py-3 shadow-md ${
                  msg.role === 'user'
                    ? 'bg-primary/10 text-on-surface border border-primary/20'
                    : 'card-static text-on-surface border border-outline-variant/30 bg-surface-container/40'
                }`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed font-semibold">{msg.content}</p>
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex justify-start">
                <div className="card-static px-4 py-3 flex items-center gap-2.5 border-outline-variant/30 bg-surface-container/20">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                  <span className="text-xs text-muted font-bold uppercase tracking-wider">Generating plan...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="border-t border-outline-variant/20 pt-4 flex gap-3">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Ask your AI mentor a question..."
              className="flex-1 premium-input"
            />
            <button
              onClick={sendMessage}
              disabled={chatLoading || !chatInput.trim()}
              className="px-5 py-3 bg-gradient-to-r from-primary to-secondary text-on-primary rounded-lg text-sm font-bold shadow-lg shadow-primary/20 btn-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm font-bold">send</span>
              Send
            </button>
          </div>
        </div>
      )}

      {/* RECRUITER SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="page-transition flex flex-col space-y-4" style={{ height: 'calc(100vh - 280px)' }}>
          {!selectedJdId ? (
             <div className="space-y-4">
                <h3 className="text-sm font-bold text-on-surface">Select a Job for the Mock Interview</h3>
                {applications.length === 0 && (
                  <p className="text-xs text-on-surface-variant font-medium">No job applications analyzed yet.</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {applications.map(app => (
                    <button 
                      key={app.id} 
                      onClick={() => { setSelectedJdId(app.id); setInterviewMessages([]); }}
                      className="card-static p-4 text-left border-outline-variant/30 hover:border-primary/50 transition-all btn-hover"
                    >
                       <p className="text-sm font-bold text-on-surface">{app.role}</p>
                       <p className="text-xs text-on-surface-variant font-medium">{app.company}</p>
                    </button>
                  ))}
                </div>
             </div>
          ) : interviewResult ? (
             <div className="flex flex-col h-full space-y-4 overflow-y-auto custom-scrollbar pr-2">
                <div className="card-static p-4 flex items-center justify-between border-outline-variant/30 bg-surface-container/20">
                   <div className="flex items-center gap-3">
                     <span className="material-symbols-outlined text-primary text-xl shrink-0">analytics</span>
                     <div>
                       <p className="text-xs font-bold text-on-surface">Interview Analytics: {applications.find(a => a.id === selectedJdId)?.role}</p>
                       <p className="text-[10px] text-muted font-semibold mt-0.5">Evaluation complete.</p>
                     </div>
                   </div>
                   <button onClick={() => { setSelectedJdId(null); setInterviewResult(null); setInterviewMessages([]); }} className="text-xs font-bold text-primary hover:underline">New Interview</button>
                </div>
                
                {/* Analytics Tabs */}
                <div className="flex gap-2">
                  <button onClick={() => setAnalyticsTab('overview')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${analyticsTab === 'overview' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high'}`}>Overview</button>
                  <button onClick={() => setAnalyticsTab('transcript')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${analyticsTab === 'transcript' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high'}`}>Transcript Review</button>
                </div>

                {analyticsTab === 'overview' && (
                  <div className="space-y-4 pb-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="card-static p-4 border-outline-variant/30 text-center">
                        <p className="text-3xl font-black text-primary">{interviewResult.overallScore}/100</p>
                        <p className="text-xs font-bold text-muted mt-1 uppercase tracking-wider">Overall Score</p>
                      </div>
                      <div className="card-static p-4 border-outline-variant/30 text-center">
                        <p className="text-3xl font-black text-secondary">{interviewResult.confidenceScore}/100</p>
                        <p className="text-xs font-bold text-muted mt-1 uppercase tracking-wider">Confidence</p>
                      </div>
                      <div className="card-static p-4 border-outline-variant/30 text-center">
                        <p className="text-3xl font-black text-error">{interviewResult.fillerWords?.count || 0}</p>
                        <p className="text-xs font-bold text-muted mt-1 uppercase tracking-wider">Filler Words</p>
                        {interviewResult.fillerWords?.words?.length > 0 && (
                           <p className="text-[10px] text-muted mt-1">({interviewResult.fillerWords.words.join(', ')})</p>
                        )}
                      </div>
                    </div>
                    
                    {interviewResult.toneAnalysis && (
                      <div className="card-static p-4 border-outline-variant/30">
                        <h4 className="text-sm font-bold text-on-surface mb-2 flex items-center gap-2"><span className="material-symbols-outlined text-primary text-[18px]">psychology_alt</span> Behavioral & Tone Analysis</h4>
                        <p className="text-xs text-on-surface-variant font-medium leading-relaxed">{interviewResult.toneAnalysis}</p>
                      </div>
                    )}
                    
                    {interviewResult.technicalAccuracy && (
                      <div className="card-static p-4 border-outline-variant/30">
                        <h4 className="text-sm font-bold text-on-surface mb-2 flex items-center gap-2"><span className="material-symbols-outlined text-primary text-[18px]">verified</span> Technical Accuracy</h4>
                        <p className="text-xs text-on-surface-variant font-medium leading-relaxed">{interviewResult.technicalAccuracy}</p>
                      </div>
                    )}
                    
                    <div className="card-static p-4 border-outline-variant/30">
                      <h4 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2"><span className="material-symbols-outlined text-primary text-[18px]">lightbulb</span> Recommendations</h4>
                      <ul className="space-y-2">
                        {interviewResult.recommendations?.map((rec, idx) => (
                          <li key={idx} className="flex gap-2 text-xs font-medium text-on-surface-variant">
                            <span className="text-primary mt-0.5">•</span> <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {analyticsTab === 'transcript' && (
                  <div className="space-y-4 pb-4">
                    {interviewResult.qaReview?.map((qa, idx) => (
                      <div key={idx} className="card-static p-4 border-outline-variant/30 space-y-3">
                        <div className="flex justify-between items-start gap-4">
                          <p className="text-xs font-bold text-on-surface flex-1"><span className="text-primary">Q:</span> {qa.question}</p>
                          <span className="text-[10px] font-bold px-2 py-1 bg-primary/10 text-primary rounded-full shrink-0">Score: {qa.score}/100</span>
                        </div>
                        <div className="bg-surface-container/30 p-3 rounded-lg border border-outline-variant/20">
                          <p className="text-xs font-medium text-on-surface-variant italic"><span className="text-secondary font-bold not-italic">You:</span> "{qa.answer}"</p>
                        </div>
                        <div className="flex gap-2 items-start mt-2 bg-secondary/10 p-3 rounded-lg">
                          <span className="material-symbols-outlined text-secondary text-[16px] shrink-0 mt-0.5">feedback</span>
                          <p className="text-xs font-medium text-on-surface-variant leading-relaxed text-secondary-dark">{qa.feedback}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
          ) : isEvaluating ? (
             <div className="flex flex-col items-center justify-center h-full gap-4">
               <span className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
               <p className="text-sm font-bold text-on-surface animate-pulse">Evaluating your performance...</p>
               <p className="text-xs text-muted font-medium text-center max-w-sm">We're analyzing your answers, confidence, and extracting actionable feedback. This usually takes 10-15 seconds.</p>
             </div>
          ) : (
             <div className="flex flex-col h-full space-y-4">
                <div className="card-static p-4 flex items-center justify-between border-outline-variant/30 bg-surface-container/20">
                   <div className="flex items-center gap-3">
                     <span className="material-symbols-outlined text-secondary text-xl shrink-0">mic</span>
                     <div>
                       <p className="text-xs font-bold text-on-surface">Live Interview: {applications.find(a => a.id === selectedJdId)?.role}</p>
                       <p className="text-[10px] text-muted font-semibold mt-0.5">Please ensure your microphone is enabled.</p>
                     </div>
                   </div>
                   <button onClick={handleExitInterview} className="text-xs font-bold text-primary hover:underline">Exit Interview</button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pb-4 pr-1">
                  {interviewMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-4">
                       <span className="material-symbols-outlined text-muted text-4xl">record_voice_over</span>
                       <p className="text-sm font-bold text-on-surface">Ready when you are.</p>
                       <p className="text-xs text-on-surface-variant font-medium mt-1">Tap the microphone below and say "Hi, I'm ready to start the interview."</p>
                    </div>
                  )}

                  {interviewMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-xl px-4 py-3 shadow-md ${
                        msg.role === 'user'
                          ? 'bg-primary/10 text-on-surface border border-primary/20'
                          : 'card-static text-on-surface border border-outline-variant/30 bg-surface-container/40'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed font-semibold">{msg.content}</p>
                      </div>
                    </div>
                  ))}

                  {interviewLoading && (
                    <div className="flex justify-start">
                      <div className="card-static px-4 py-3 flex items-center gap-2.5 border-outline-variant/30 bg-surface-container/20">
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                        <span className="text-xs text-muted font-bold uppercase tracking-wider">Recruiter is thinking...</span>
                      </div>
                    </div>
                  )}
                  {isSpeaking && !interviewLoading && (
                    <div className="flex justify-start">
                      <div className="card-static px-4 py-3 flex items-center gap-2.5 border-outline-variant/30 bg-surface-container/20">
                        <span className="material-symbols-outlined text-xs text-primary animate-pulse">graphic_eq</span>
                        <span className="text-xs text-muted font-bold uppercase tracking-wider">Recruiter is speaking...</span>
                      </div>
                    </div>
                  )}
                  {(interimTranscript || finalTranscript) && (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] rounded-xl px-4 py-3 shadow-md bg-primary/10 text-on-surface border border-primary/20 opacity-70">
                        <p className="text-sm whitespace-pre-wrap leading-relaxed font-semibold italic">
                          {finalTranscript} {interimTranscript}
                          <span className="animate-pulse ml-1 inline-block w-1.5 h-4 bg-primary align-middle"></span>
                        </p>
                      </div>
                    </div>
                  )}
                  <div ref={interviewEndRef} />
                </div>

                <div className="pt-4 flex justify-center gap-4 pb-4 items-center">
                   <button
                     onClick={toggleListening}
                     disabled={interviewLoading || isSpeaking}
                     className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 shrink-0 ${
                       isListening 
                         ? 'bg-error text-white shadow-error/30 animate-pulse scale-110' 
                         : 'bg-primary text-white shadow-primary/30 hover:scale-105'
                     } disabled:opacity-50 disabled:cursor-not-allowed`}
                   >
                     <span className="material-symbols-outlined text-3xl">{isListening ? 'mic_off' : 'mic'}</span>
                   </button>
                   
                   {interviewMessages.length > 0 && (
                     <button
                       onClick={endInterview}
                       disabled={interviewLoading || isSpeaking || isListening}
                       className="h-12 px-6 rounded-full bg-surface-container border border-error/50 text-error text-xs font-bold shadow-sm hover:bg-error/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                     >
                       <span className="material-symbols-outlined text-[18px]">stop_circle</span>
                       End & Evaluate
                     </button>
                   )}
                </div>
             </div>
          )}
        </div>
      )}
    </div>
  );
}
