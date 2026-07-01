'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

// ─── Problem Bank ───────────────────────────────────────────────────────────


const TOPICS = ['Arrays', 'Strings', 'Linked Lists', 'Trees', 'Graphs', 'Dynamic Programming', 'Sorting & Searching', 'Stacks & Queues'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const LANGUAGES = ['python', 'javascript', 'java', 'cpp'];
const LANG_LABELS = { python: 'Python', javascript: 'JavaScript', java: 'Java', cpp: 'C++' };
const DIFF_COLORS = { Easy: '#10B981', Medium: '#F59E0B', Hard: '#F43F5E' };

// ─── Main Component ─────────────────────────────────────────────────────────
export default function CodingMentorPage() {
  // View state
  const [view, setView] = useState('selector'); // selector | workspace | analytics

  // Selector state
  const [selLanguage, setSelLanguage] = useState('python');
  const [selDifficulty, setSelDifficulty] = useState('All');
  const [selTopic, setSelTopic] = useState('All');

  const [problems, setProblems] = useState([]);
  const [isLoadingProblems, setIsLoadingProblems] = useState(true);

  useEffect(() => {
    const fetchProblems = async () => {
      setIsLoadingProblems(true);
      try {
        const queryParams = new URLSearchParams();
        if (selDifficulty !== 'All') queryParams.append('difficulty', selDifficulty);
        if (selTopic !== 'All') queryParams.append('topic', selTopic);
        
        const res = await fetch(`${BACKEND_URL}/api/codelab/questions?${queryParams.toString()}`);
        const data = await res.json();
        if (data.success) {
          setProblems(data.questions);
        }
      } catch (err) {
        console.error("Failed to fetch problems", err);
      } finally {
        setIsLoadingProblems(false);
      }
    };
    fetchProblems();
  }, [selDifficulty, selTopic]);


  // Workspace state
  const [problem, setProblem] = useState(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [interviewMode, setInterviewMode] = useState(false);

  // Editor
  const [monacoLoaded, setMonacoLoaded] = useState(false);
  const editorRef = useRef(null);

  // Timer
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef(null);

  // Console / execution
  const [consoleOutput, setConsoleOutput] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [customTestInput, setCustomTestInput] = useState('');

  // Mentor chat
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [isMentorExpanded, setIsMentorExpanded] = useState(true);
  const chatEndRef = useRef(null);

  // Reflection
  const [showReflection, setShowReflection] = useState(false);
  const [reflectionData, setReflectionData] = useState(null);

  // Analytics
  const [progress, setProgress] = useState(null);
  const [userLevel, setUserLevel] = useState('Beginner');

  // Panel sizes
  const [leftPanelWidth, setLeftPanelWidth] = useState(30);
  const [rightPanelWidth, setRightPanelWidth] = useState(25);

  // Load Monaco dynamically
  useEffect(() => {
    if (view === 'workspace' && !monacoLoaded) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js';
      script.onload = () => {
        window.require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }});
        window.require(['vs/editor/editor.main'], () => { setMonacoLoaded(true); });
      };
      document.body.appendChild(script);
    }
  }, [view, monacoLoaded]);

  // Initialize Monaco editor
  useEffect(() => {
    if (monacoLoaded && view === 'workspace' && editorRef.current && !editorRef.current._editor) {
      const monacoLang = language === 'cpp' ? 'cpp' : language === 'python' ? 'python' : language === 'java' ? 'java' : 'javascript';
      const editor = window.monaco.editor.create(editorRef.current, {
        value: code,
        language: monacoLang,
        theme: 'vs-dark',
        fontSize: 14,
        fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', Consolas, monospace",
        minimap: { enabled: false },
        automaticLayout: true,
        padding: { top: 16 },
        scrollBeyondLastLine: false,
        lineNumbers: 'on',
        roundedSelection: true,
        cursorBlinking: 'smooth',
        smoothScrolling: true,
        bracketPairColorization: { enabled: true },
        wordWrap: 'on',
      });
      editor.onDidChangeModelContent(() => {
        setCode(editor.getValue());
      });
      editorRef.current._editor = editor;
    }
    return () => {
      if (editorRef.current?._editor) {
        editorRef.current._editor.dispose();
        editorRef.current._editor = null;
      }
    };
  }, [monacoLoaded, view]);

  // Update editor language
  useEffect(() => {
    if (editorRef.current?._editor) {
      const model = editorRef.current._editor.getModel();
      if (model) {
        const monacoLang = language === 'cpp' ? 'cpp' : language === 'python' ? 'python' : language === 'java' ? 'java' : 'javascript';
        window.monaco.editor.setModelLanguage(model, monacoLang);
      }
    }
  }, [language]);

  // Timer
  useEffect(() => {
    if (view === 'workspace') {
      timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [view]);

  // Scroll chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const getHeaders = () => {
    const token = localStorage.getItem('careeros_token');
    return { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
  };

  // ─── Problem Selection ─────────────────────────────────────────
  const selectProblem = (p) => {
    setProblem(p);
    setLanguage(selLanguage);
    setCode(p.starterCode[selLanguage] || '');
    setTimerSeconds(0);
    setHintLevel(0);
    setChatMessages([{ role: 'assistant', content: `👋 Hi! I'm your AI coding mentor. I'll help you solve **"${p.title}"**.\n\nStart coding whenever you're ready. You can ask me for hints, code reviews, debugging help, or just chat about your approach!\n\n${interviewMode ? '🎯 **Interview Mode is ON** — I\'ll act as a strict interviewer.' : '💡 Click **Get Hint** if you need a nudge.'}` }]);
    setConsoleOutput([]);
    setShowReflection(false);
    setReflectionData(null);
    setView('workspace');
  };

  const filteredProblems = problems;

  // ─── Run Code ──────────────────────────────────────────────────
  const handleRun = async () => {
    setIsRunning(true);
    setConsoleOutput([{ type: 'info', text: '⏳ Running test cases...' }]);
    try {
      const tc = customTestInput.trim() ? [{ input: customTestInput, expected: '(custom)' }] : problem.testCases;
      const res = await fetch(`${BACKEND_URL}/api/coding-mentor/run`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ code, language, testCases: tc }) });
      const data = await res.json();
      if (data.success) {
        const d = data.data;
        const out = [];
        if (!d.compiles) { out.push({ type: 'error', text: `❌ Compilation Error:\n${d.compileError}` }); }
        else {
          (d.results || []).forEach((r, i) => {
            out.push({ type: r.passed ? 'success' : 'error', text: `${r.passed ? '✅' : '❌'} Test ${i + 1}: Input: ${r.input}\n   Expected: ${r.expected}\n   Got: ${r.actual}${r.error ? '\n   Error: ' + r.error : ''}` });
          });
          out.push({ type: 'info', text: d.summary || '' });
        }
        setConsoleOutput(out);
      }
    } catch (err) { setConsoleOutput([{ type: 'error', text: `Error: ${err.message}` }]); }
    setIsRunning(false);
  };

  // ─── Submit Code ───────────────────────────────────────────────
  const handleSubmit = async () => {
    setIsRunning(true);
    setConsoleOutput([{ type: 'info', text: '⏳ Submitting solution...' }]);
    try {
      const res = await fetch(`${BACKEND_URL}/api/coding-mentor/submit`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ problem, code, language, testCases: problem.testCases, hintsUsed: hintLevel, timeSpent: timerSeconds, userLevel }) });
      const data = await res.json();
      if (data.success) {
        const d = data.execution;
        const out = [];
        if (!d.compiles) { out.push({ type: 'error', text: `❌ Compilation Error:\n${d.compileError}` }); }
        else {
          (d.results || []).forEach((r, i) => { out.push({ type: r.passed ? 'success' : 'error', text: `${r.passed ? '✅' : '❌'} Test ${i + 1}: ${r.passed ? 'Passed' : 'Failed'}` }); });
          out.push({ type: 'info', text: d.summary || '' });
        }
        setConsoleOutput(out);
        setReflectionData(data.reflection);
        setShowReflection(true);
      }
    } catch (err) { setConsoleOutput([{ type: 'error', text: `Error: ${err.message}` }]); }
    setIsRunning(false);
  };

  // ─── Mentor Actions ────────────────────────────────────────────
  const getHint = async () => {
    const nextLevel = Math.min(hintLevel + 1, 5);
    setHintLevel(nextLevel);
    setChatLoading(true);
    setChatMessages(m => [...m, { role: 'user', content: `💡 Hint please (Level ${nextLevel}/5)` }]);
    try {
      const res = await fetch(`${BACKEND_URL}/api/coding-mentor/hint`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ problem, code, language, hintLevel: nextLevel, chatHistory: chatMessages, userLevel }) });
      const data = await res.json();
      if (data.success) {
        setChatMessages(m => [...m, { role: 'assistant', content: `**Hint ${nextLevel}/5:** ${data.data.hint}\n\n_${data.data.encouragement}_` }]);
      }
    } catch (err) { setChatMessages(m => [...m, { role: 'assistant', content: `Error getting hint: ${err.message}` }]); }
    setChatLoading(false);
  };

  const reviewCode = async () => {
    setChatLoading(true);
    setChatMessages(m => [...m, { role: 'user', content: '🔍 Review my code' }]);
    try {
      const res = await fetch(`${BACKEND_URL}/api/coding-mentor/review`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ problem, code, language, userLevel }) });
      const data = await res.json();
      if (data.success) {
        const d = data.data;
        let msg = `**Code Review — Score: ${d.overallScore}/100**\n\n${d.summary}\n\n`;
        if (d.issues?.length) { msg += '**Issues Found:**\n'; d.issues.forEach(i => { msg += `- **[${i.severity}] ${i.category}:** ${i.description}\n  *${i.suggestion}*\n`; }); }
        if (d.strengths?.length) { msg += '\n**Strengths:** ' + d.strengths.join(', '); }
        msg += `\n\n📊 Time: ${d.timeComplexity} | Space: ${d.spaceComplexity}`;
        setChatMessages(m => [...m, { role: 'assistant', content: msg }]);
      }
    } catch (err) { setChatMessages(m => [...m, { role: 'assistant', content: `Error: ${err.message}` }]); }
    setChatLoading(false);
  };

  const debugCode = async () => {
    const errors = consoleOutput.filter(o => o.type === 'error').map(o => o.text).join('\n');
    if (!errors) { setChatMessages(m => [...m, { role: 'assistant', content: '✅ No errors detected in the console. Run your code first to see if there are any issues!' }]); return; }
    setChatLoading(true);
    setChatMessages(m => [...m, { role: 'user', content: '🐛 Help me debug' }]);
    try {
      const res = await fetch(`${BACKEND_URL}/api/coding-mentor/debug`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ problem, code, language, errorOutput: errors, errorType: 'runtime' }) });
      const data = await res.json();
      if (data.success) {
        const d = data.data;
        let msg = `**🐛 Debug Analysis**\n\n**Error:** ${d.errorExplanation}\n\n**Root Cause:** ${d.rootCause}\n\n**Location:** ${d.lineHint}\n\n**Fix:**\n${d.fix}\n\n**Prevention:** ${d.prevention}\n\n📚 **Concept to review:** ${d.concept}`;
        setChatMessages(m => [...m, { role: 'assistant', content: msg }]);
      }
    } catch (err) { setChatMessages(m => [...m, { role: 'assistant', content: `Error: ${err.message}` }]); }
    setChatLoading(false);
  };

  const analyzeComplexity = async () => {
    setChatLoading(true);
    setChatMessages(m => [...m, { role: 'user', content: '📊 Analyze complexity' }]);
    try {
      const res = await fetch(`${BACKEND_URL}/api/coding-mentor/complexity`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ problem, code, language }) });
      const data = await res.json();
      if (data.success) {
        const d = data.data;
        let msg = `**📊 Complexity Analysis**\n\n**Time Complexity:**\n- Best: ${d.timeComplexity?.best}\n- Average: ${d.timeComplexity?.average}\n- Worst: ${d.timeComplexity?.worst}\n- ${d.timeComplexity?.explanation}\n\n**Space Complexity:**\n- Total: ${d.spaceComplexity?.total}\n- Auxiliary: ${d.spaceComplexity?.auxiliary}\n- ${d.spaceComplexity?.explanation}`;
        if (d.optimizations?.length) { msg += '\n\n**Optimizations:**'; d.optimizations.forEach(o => { msg += `\n- ${o.description} → ${o.newComplexity} (${o.tradeoff})`; }); }
        if (d.alternativeAlgorithms?.length) { msg += '\n\n**Alternatives:**'; d.alternativeAlgorithms.forEach(a => { msg += `\n- **${a.name}** (${a.complexity}): ${a.when}`; }); }
        setChatMessages(m => [...m, { role: 'assistant', content: msg }]);
      }
    } catch (err) { setChatMessages(m => [...m, { role: 'assistant', content: `Error: ${err.message}` }]); }
    setChatLoading(false);
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput('');
    setChatMessages(m => [...m, { role: 'user', content: msg }]);
    setChatLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/coding-mentor/chat`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ problem, code, language, message: msg, chatHistory: chatMessages, userLevel, interviewMode }) });
      const data = await res.json();
      if (data.success) { setChatMessages(m => [...m, { role: 'assistant', content: data.reply }]); }
    } catch (err) { setChatMessages(m => [...m, { role: 'assistant', content: `Error: ${err.message}` }]); }
    setChatLoading(false);
  };

  // ─── RENDER: Problem Selector ─────────────────────────────────
  if (view === 'selector') {
    return (
      <div className="page-transition p-4 md:p-8 max-w-7xl mx-auto space-y-8 relative z-10">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl p-8 md:p-10" style={{ background: 'linear-gradient(135deg, rgba(45,212,191,0.08) 0%, rgba(129,140,248,0.08) 50%, rgba(236,72,153,0.06) 100%)' }}>
          <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 20% 50%, rgba(45,212,191,0.15), transparent 50%), radial-gradient(circle at 80% 50%, rgba(129,140,248,0.15), transparent 50%)' }} />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20">
                <span className="material-symbols-outlined text-white text-xl">code</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-on-surface tracking-tight">
                Code Lab
              </h1>
            </div>
            <p className="text-on-surface-variant text-sm md:text-base font-medium max-w-xl leading-relaxed">AI-powered coding workspace — practice DSA, get real-time mentorship, and ace your technical interviews.</p>
            <div className="flex items-center gap-4 mt-5">
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="font-semibold">{problems.length} Problems</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="material-symbols-outlined text-sm text-primary">smart_toy</span>
                <span className="font-semibold">AI Mentor Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-outline-variant/30 bg-surface/80 backdrop-blur-sm p-5 md:p-6 space-y-5 shadow-sm">
          <div className="flex flex-wrap gap-4 items-start">
            <div className="space-y-2">
              <span className="text-[10px] text-muted font-bold uppercase tracking-widest">Language</span>
              <div className="flex gap-1.5">{LANGUAGES.map(l => (
                <button key={l} onClick={() => setSelLanguage(l)} className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${selLanguage === l ? 'bg-primary text-on-primary shadow-md shadow-primary/25 scale-105' : 'bg-surface-container/60 text-on-surface-variant border border-outline-variant/20 hover:bg-surface-container-high/60 hover:border-outline-variant/40'}`}>{LANG_LABELS[l]}</button>
              ))}</div>
            </div>
            <div className="space-y-2">
              <span className="text-[10px] text-muted font-bold uppercase tracking-widest">Difficulty</span>
              <div className="flex gap-1.5">
                <button onClick={() => setSelDifficulty('All')} className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${selDifficulty === 'All' ? 'bg-on-surface text-surface shadow-md scale-105' : 'bg-surface-container/60 text-on-surface-variant border border-outline-variant/20 hover:bg-surface-container-high/60'}`}>All</button>
                {DIFFICULTIES.map(d => (
                  <button key={d} onClick={() => setSelDifficulty(d)} className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200" style={selDifficulty === d ? { background: DIFF_COLORS[d], color: '#fff', boxShadow: `0 4px 12px ${DIFF_COLORS[d]}40`, transform: 'scale(1.05)' } : { background: 'var(--theme-surface-container)', color: 'var(--theme-on-surface-variant)', border: '1px solid var(--theme-outline-variant)' }}>{d}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <span className="text-[10px] text-muted font-bold uppercase tracking-widest">Topic</span>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setSelTopic('All')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${selTopic === 'All' ? 'bg-secondary text-white shadow-md shadow-secondary/25' : 'bg-surface-container/60 text-on-surface-variant border border-outline-variant/20 hover:bg-surface-container-high/60'}`}>All Topics</button>
              {TOPICS.map(t => (
                <button key={t} onClick={() => setSelTopic(t)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${selTopic === t ? 'bg-secondary text-white shadow-md shadow-secondary/25' : 'bg-surface-container/60 text-on-surface-variant border border-outline-variant/20 hover:bg-surface-container-high/60'}`}>{t}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 pt-4 border-t border-outline-variant/20">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div className={`w-10 h-5 rounded-full transition-all duration-200 relative ${interviewMode ? 'bg-warning' : 'bg-surface-container-high'}`} onClick={() => setInterviewMode(!interviewMode)}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${interviewMode ? 'left-5.5' : 'left-0.5'}`} style={{ left: interviewMode ? '22px' : '2px' }} />
              </div>
              <span className={`text-xs font-bold transition-colors ${interviewMode ? 'text-warning' : 'text-muted'}`}>🎯 Interview Mode</span>
            </label>
            <span className="text-[10px] text-muted">Strict timer, no direct answers, follow-up questions</span>
          </div>
        </div>

        {/* Problem Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProblems.map(p => (
            <button key={p.id} onClick={() => selectProblem(p)} className="text-left group cursor-pointer rounded-2xl border border-outline-variant/25 bg-surface hover:bg-surface-container-low/60 p-5 md:p-6 space-y-4 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 hover:border-primary/30 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 rounded-t-2xl transition-all duration-300 opacity-0 group-hover:opacity-100" style={{ background: `linear-gradient(90deg, ${DIFF_COLORS[p.difficulty]}, transparent)` }} />
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors duration-200">{p.title}</h3>
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0" style={{ background: `${DIFF_COLORS[p.difficulty]}15`, color: DIFF_COLORS[p.difficulty], border: `1px solid ${DIFF_COLORS[p.difficulty]}25` }}>{p.difficulty}</span>
              </div>
              <p className="text-xs text-muted line-clamp-2 leading-relaxed">{p.description.split('\n')[0]}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-secondary/10 text-secondary border border-secondary/15">{p.topic}</span>
                {p.tags.slice(0, 2).map(t => <span key={t} className="px-2 py-1 rounded-lg text-[10px] font-medium bg-surface-container-high/40 text-muted">{t}</span>)}
              </div>
            </button>
          ))}
        </div>

        {filteredProblems.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-surface-container/50 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl text-muted">search_off</span>
            </div>
            <p className="text-muted font-medium">No problems found for the selected filters.</p>
            <p className="text-xs text-muted mt-1">Try adjusting your filters above.</p>
          </div>
        )}
      </div>
    );
  }

  // ─── RENDER: Workspace ────────────────────────────────────────
  if (view === 'workspace' && problem) {
    return (
      <div className="page-transition flex flex-col h-full relative z-10 bg-surface" style={{ height: 'calc(100vh - 52px)' }}>
        {/* Top Bar */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-outline-variant/30 bg-surface shadow-sm z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => { setView('selector'); if (timerRef.current) clearInterval(timerRef.current); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-on-surface hover:bg-surface-container transition-all">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div className="h-4 w-px bg-outline-variant/50" />
            <h2 className="text-[15px] font-extrabold text-on-surface tracking-tight truncate max-w-[250px]">{problem.title}</h2>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider" style={{ background: `${DIFF_COLORS[problem.difficulty]}15`, color: DIFF_COLORS[problem.difficulty], border: `1px solid ${DIFF_COLORS[problem.difficulty]}25` }}>{problem.difficulty}</span>
            {interviewMode && <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-warning/15 text-warning border border-warning/25 shadow-[0_0_8px_rgba(245,158,11,0.2)] animate-pulse">🎯 Interview</span>}
          </div>
          <div className="flex items-center gap-5">
            <div className="relative group">
              <select value={language} onChange={e => { setLanguage(e.target.value); setCode(problem.starterCode[e.target.value] || ''); if (editorRef.current?._editor) editorRef.current._editor.setValue(problem.starterCode[e.target.value] || ''); }} className="appearance-none text-xs font-bold bg-surface-container/50 hover:bg-surface-container text-on-surface border border-outline-variant/30 rounded-lg pl-3 pr-8 py-1.5 cursor-pointer outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/20 shadow-sm">
                {LANGUAGES.map(l => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none text-[16px] group-hover:text-on-surface transition-colors">expand_more</span>
            </div>
            <div className="h-4 w-px bg-outline-variant/50" />
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-mono font-medium bg-surface-container/30 px-3 py-1.5 rounded-lg border border-outline-variant/20 shadow-inner">
              <span className="material-symbols-outlined text-[16px] text-primary">timer</span>
              {formatTime(timerSeconds)}
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-sm">
              Hints: {hintLevel}/5
            </div>
            <div className="h-4 w-px bg-outline-variant/50" />
            <button onClick={() => setIsMentorExpanded(!isMentorExpanded)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm ${isMentorExpanded ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20' : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-high'}`}>
              <span className="text-[14px]">🤖</span>
              {isMentorExpanded ? 'Hide Mentor' : 'Ask Mentor'}
            </button>
          </div>
        </div>

        {/* Main Panels */}
        <div className="flex flex-1 overflow-hidden bg-surface-container-lowest">
          {/* Left: Problem Panel */}
          <div className="border-r border-outline-variant/30 overflow-y-auto custom-scrollbar bg-surface shadow-[inset_-8px_0_24px_rgba(0,0,0,0.01)]" style={{ width: `${leftPanelWidth}%`, minWidth: '300px' }}>
            <div className="p-6 md:p-8 space-y-7">
              <div className="flex flex-wrap gap-2 mb-3">
                {problem.tags.map(t => <span key={t} className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-surface-container-high/50 text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-high transition-colors">{t}</span>)}
              </div>
              
              <div className="prose prose-sm max-w-none text-on-surface leading-relaxed text-[15px]">
                {/* Simplified markdown rendering */}
                <div style={{ whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: problem.description.replace(/`([^`]+)`/g, '<code class="bg-surface-container px-1.5 py-0.5 rounded text-[13px] font-mono text-primary border border-outline-variant/20">$1</code>') }} />
              </div>

              {problem.examples?.length > 0 && (
                <div className="space-y-4 pt-2">
                  {problem.examples.map((ex, i) => (
                    <div key={i} className="rounded-xl bg-surface-container/30 border border-outline-variant/30 overflow-hidden group">
                      <div className="bg-surface-container-low px-4 py-2 border-b border-outline-variant/20 flex items-center">
                        <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Example {i + 1}</p>
                      </div>
                      <div className="p-4 space-y-2.5 bg-surface-container-lowest/50">
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-black text-muted uppercase tracking-wider">Input</span>
                          <code className="text-[13px] font-mono text-on-surface">{ex.input}</code>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-black text-muted uppercase tracking-wider">Output</span>
                          <code className="text-[13px] font-mono text-success font-bold">{ex.output}</code>
                        </div>
                        {ex.explanation && (
                          <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-outline-variant/20">
                            <span className="text-[11px] font-black text-muted uppercase tracking-wider">Explanation</span>
                            <span className="text-[13px] text-on-surface-variant italic leading-relaxed">{ex.explanation}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {problem.constraints?.length > 0 && (
                <div className="pt-4 border-t border-outline-variant/20">
                  <p className="text-[11px] font-black text-on-surface uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-warning">warning</span>
                    Constraints
                  </p>
                  <ul className="space-y-2 bg-surface-container/20 p-4 rounded-xl border border-outline-variant/20">
                    {problem.constraints.map((c, i) => (
                      <li key={i} className="text-[13px] text-on-surface-variant font-mono flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span dangerouslySetInnerHTML={{ __html: c.replace(/`([^`]+)`/g, '<code class="bg-surface-container px-1 py-0.5 rounded text-[11px] font-mono text-on-surface border border-outline-variant/20">$1</code>') }} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Center: Editor + Console */}
          <div className="flex flex-col flex-1 min-w-0 bg-[#0d1117] relative shadow-2xl z-10 border-r border-[#30363d]">
            {/* Editor */}
            <div ref={editorRef} className="flex-1 min-h-0 pt-3" style={{ minHeight: '200px' }} />

            {/* Action buttons */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-t border-[#30363d] bg-[#161b22] shadow-[0_-4px_12px_rgba(0,0,0,0.2)] z-10">
              <button onClick={handleRun} disabled={isRunning} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] border border-[#30363d] transition-all duration-200 disabled:opacity-50 flex items-center gap-2 hover:shadow-md">
                <span className="material-symbols-outlined text-[18px]">{isRunning ? 'hourglass_empty' : 'play_arrow'}</span>
                {isRunning ? 'Running...' : 'Run Code'}
              </button>
              <button onClick={handleSubmit} disabled={isRunning} className="px-6 py-2.5 rounded-xl text-sm font-bold bg-primary text-on-primary hover:bg-primary/90 hover:shadow-[0_0_16px_rgba(13,148,136,0.4)] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:transform-none border border-primary/20 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
                Submit
              </button>
              <div className="flex-1" />
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e] text-[16px]">keyboard</span>
                <input value={customTestInput} onChange={e => setCustomTestInput(e.target.value)} placeholder="Custom test input..." className="text-[13px] bg-[#0d1117] text-[#c9d1d9] border border-[#30363d] focus:border-primary/50 focus:ring-1 focus:ring-primary/50 focus:outline-none rounded-xl pl-9 pr-4 py-2 w-64 shadow-inner transition-all placeholder:text-[#484f58]" />
              </div>
            </div>

            {/* Console */}
            <div className="border-t border-[#30363d] overflow-y-auto custom-scrollbar bg-[#0d1117]" style={{ minHeight: '140px', maxHeight: '220px' }}>
              <div className="p-5 space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[16px] text-[#8b949e]">terminal</span>
                  <p className="text-[11px] font-black text-[#8b949e] uppercase tracking-widest">Console</p>
                </div>
                {consoleOutput.length === 0 && (
                  <div className="flex items-center gap-2 text-[#484f58] mt-4">
                    <span className="material-symbols-outlined text-[18px]">info</span>
                    <p className="text-[13px] italic">Run your code to see results here...</p>
                  </div>
                )}
                {consoleOutput.map((line, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${line.type === 'success' ? 'bg-[#238636]/10 border-[#238636]/20' : line.type === 'error' ? 'bg-[#f85149]/10 border-[#f85149]/20' : 'bg-[#21262d] border-[#30363d]'}`}>
                    <pre className={`text-[13px] font-mono whitespace-pre-wrap leading-relaxed ${line.type === 'success' ? 'text-[#3fb950]' : line.type === 'error' ? 'text-[#ff7b72]' : 'text-[#c9d1d9]'}`}>{line.text}</pre>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Mentor Chat */}
          {isMentorExpanded && (
            <div className="border-l border-outline-variant/30 flex flex-col bg-surface-container-lowest shadow-[-8px_0_16px_rgba(0,0,0,0.02)] z-10 animate-in slide-in-from-right-4 duration-300" style={{ width: `${rightPanelWidth}%`, minWidth: '320px' }}>
              <div className="px-5 py-3.5 border-b border-outline-variant/20 flex items-center justify-between bg-surface/80 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-md shadow-primary/20">
                      <span className="text-white text-[18px]">🤖</span>
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-surface" />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-extrabold text-on-surface tracking-tight leading-none">AI Mentor</h3>
                    <span className="text-[10px] font-medium text-success/90 uppercase tracking-widest mt-1 block">Online</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface border border-outline-variant/30 shadow-inner tracking-wider">{userLevel}</span>
                  <button onClick={() => setIsMentorExpanded(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-on-surface hover:bg-surface-container transition-colors">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              </div>

              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 bg-[url('/grid-pattern.svg')] bg-[length:24px_24px]">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary shrink-0 mr-2 mt-auto mb-1 flex items-center justify-center text-[10px] text-white shadow-sm">🤖</div>
                    )}
                    <div className={`max-w-[85%] rounded-2xl p-3.5 text-[13px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-primary text-on-primary rounded-br-sm' : 'bg-surface text-on-surface border border-outline-variant/30 rounded-bl-sm'}`}>
                      <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert prose-p:text-on-primary prose-strong:text-on-primary' : 'prose-p:text-on-surface-variant prose-headings:text-on-surface prose-strong:text-on-surface'} prose-pre:bg-surface-container prose-pre:border prose-pre:border-outline-variant/20 prose-code:text-primary`}>
                        {/* Note: ReactMarkdown is not imported, just rendering plain text with simple styling. In a real app we'd use react-markdown here */}
                        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary shrink-0 mr-2 mt-auto mb-1 flex items-center justify-center text-[10px] text-white shadow-sm">🤖</div>
                    <div className="bg-surface rounded-2xl rounded-bl-sm px-4 py-3.5 border border-outline-variant/30 shadow-sm flex items-center">
                      <div className="flex gap-1.5 items-center">
                        <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{animationDelay:'0s'}}/>
                        <span className="w-1.5 h-1.5 bg-primary/80 rounded-full animate-bounce" style={{animationDelay:'0.15s'}}/>
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{animationDelay:'0.3s'}}/>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Quick actions & Chat input */}
              <div className="bg-surface border-t border-outline-variant/30 p-3 space-y-3 shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
                {/* Quick actions */}
                <div className="flex flex-wrap gap-2">
                  <button onClick={getHint} disabled={chatLoading || hintLevel >= 5} className="flex-1 min-w-[70px] py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5 hover:shadow-sm">💡 Hint</button>
                  <button onClick={reviewCode} disabled={chatLoading} className="flex-1 min-w-[70px] py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-secondary/10 text-secondary border border-secondary/20 hover:bg-secondary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5 hover:shadow-sm">🔍 Review</button>
                  <button onClick={debugCode} disabled={chatLoading} className="flex-1 min-w-[70px] py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-error/10 text-error border border-error/20 hover:bg-error/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5 hover:shadow-sm">🐛 Debug</button>
                  <button onClick={analyzeComplexity} disabled={chatLoading} className="flex-1 min-w-[70px] py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5 hover:shadow-sm">📊 O(N)</button>
                </div>

                {/* Chat input */}
                <div className="flex gap-2 relative">
                  <textarea 
                    value={chatInput} 
                    onChange={e => setChatInput(e.target.value)} 
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }}} 
                    placeholder="Ask your mentor anything..." 
                    className="flex-1 text-[13px] bg-surface-container-lowest text-on-surface border border-outline-variant/40 rounded-xl pl-3 pr-10 py-2.5 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all resize-none min-h-[44px] max-h-[120px] custom-scrollbar shadow-inner" 
                    disabled={chatLoading}
                    rows={1}
                  />
                  <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} className="absolute right-1.5 bottom-1.5 w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm hover:shadow-md hover:-translate-y-0.5">
                    <span className="material-symbols-outlined text-[18px]">send</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Reflection Modal */}
        {showReflection && reflectionData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowReflection(false)} />
            <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl bg-surface border border-outline-variant/30 shadow-[0_24px_60px_rgba(0,0,0,0.3)] animate-in zoom-in-95 duration-200 overflow-hidden">
              
              <div className="px-6 py-5 border-b border-outline-variant/20 bg-surface-container-low/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-inner">
                    <span className="text-[20px]">📝</span>
                  </div>
                  <h2 className="text-[18px] font-black text-on-surface tracking-tight">Solution Reflection</h2>
                </div>
                <button onClick={() => setShowReflection(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-on-surface hover:bg-surface-container transition-colors">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-8">
                {reflectionData.overallGrade && (
                  <div className="flex items-start gap-4 p-5 rounded-2xl bg-gradient-to-br from-primary/5 to-secondary/5 border border-primary/10">
                    <div className="w-16 h-16 shrink-0 rounded-2xl bg-surface border border-primary/20 flex flex-col items-center justify-center shadow-sm">
                      <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Grade</span>
                      <span className="text-2xl font-black text-primary leading-none mt-1">{reflectionData.overallGrade}</span>
                    </div>
                    <div className="pt-1">
                      <p className="text-[15px] font-medium text-on-surface leading-relaxed">{reflectionData.encouragement}</p>
                    </div>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                  {reflectionData.didWell?.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center text-success"><span className="material-symbols-outlined text-[14px]">check</span></span>
                        <h3 className="text-[13px] font-black text-on-surface uppercase tracking-widest">What You Did Well</h3>
                      </div>
                      <ul className="space-y-2.5">
                        {reflectionData.didWell.map((d, i) => (
                          <li key={i} className="text-[14px] text-on-surface-variant flex items-start gap-2">
                            <span className="text-success mt-1 text-[10px]">●</span>
                            <span className="leading-relaxed">{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {reflectionData.mistakes?.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-warning/20 flex items-center justify-center text-warning"><span className="material-symbols-outlined text-[14px]">priority_high</span></span>
                        <h3 className="text-[13px] font-black text-on-surface uppercase tracking-widest">Areas for Improvement</h3>
                      </div>
                      <ul className="space-y-2.5">
                        {reflectionData.mistakes.map((d, i) => (
                          <li key={i} className="text-[14px] text-on-surface-variant flex items-start gap-2">
                            <span className="text-warning mt-1 text-[10px]">●</span>
                            <span className="leading-relaxed">{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {reflectionData.interviewerPerspective && (
                  <div className="rounded-2xl bg-surface-container/50 border border-outline-variant/30 p-5 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-secondary" />
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-[18px] text-secondary">person_search</span>
                      <h3 className="text-[12px] font-black text-secondary uppercase tracking-widest">Interviewer's View</h3>
                    </div>
                    <p className="text-[14px] text-on-surface-variant leading-relaxed pl-1">{reflectionData.interviewerPerspective}</p>
                  </div>
                )}

                {reflectionData.conceptsToRevise?.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-[12px] font-black text-on-surface uppercase tracking-widest flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-primary">menu_book</span>
                      Review These Concepts
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {reflectionData.conceptsToRevise.map((c, i) => (
                        <span key={i} className="px-3 py-1.5 rounded-lg text-[12px] font-bold bg-surface-container-high/60 text-on-surface border border-outline-variant/30 hover:bg-surface-container-high transition-colors">{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                {reflectionData.recommendedProblems?.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-[12px] font-black text-on-surface uppercase tracking-widest flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-muted">target</span>
                      Try Next
                    </h3>
                    <div className="grid gap-3">
                      {reflectionData.recommendedProblems.map((p, i) => (
                        <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest/50 hover:bg-surface-container-low transition-colors group cursor-pointer" onClick={() => { setShowReflection(false); setView('selector'); }}>
                          <div className="flex items-center gap-3">
                            <span className="px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider shrink-0" style={{ background: `${DIFF_COLORS[p.difficulty] || '#64748B'}15`, color: DIFF_COLORS[p.difficulty] || '#64748B' }}>{p.difficulty}</span>
                            <span className="font-bold text-[14px] text-on-surface group-hover:text-primary transition-colors">{p.title}</span>
                          </div>
                          <span className="text-[12px] text-muted italic line-clamp-1 sm:text-right">{p.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-5 border-t border-outline-variant/20 bg-surface">
                <button onClick={() => { setShowReflection(false); setView('selector'); }} className="w-full py-3.5 rounded-xl text-[14px] font-black text-white bg-primary hover:bg-primary/90 shadow-[0_4px_12px_rgba(13,148,136,0.25)] hover:shadow-[0_6px_16px_rgba(13,148,136,0.35)] transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2">
                  Choose Next Problem
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
