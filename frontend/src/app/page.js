'use client';

import { useState, useEffect, useRef } from 'react';

export default function CareerCommandCenter() {
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

  // Tab Navigation State
  const [activeTab, setActiveTab] = useState('analysis'); // 'analysis' | 'diff' | 'outreach' | 'prep' | 'pipeline'
  const [outreachTone, setOutreachTone] = useState('confident'); // 'confident' | 'curious' | 'concise'

  // Application Data & Pipeline States
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [weeklyVelocity, setWeeklyVelocity] = useState(0);
  const [activeNudges, setActiveNudges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  // Resume & Chat States
  const [resumeText, setResumeText] = useState('');
  const [resumeName, setResumeName] = useState('');
  const [chatHistory, setChatHistory] = useState([
    {
      role: 'assistant',
      content: 'Welcome back, Alex. I am your Career Concierge. To get started, drag and drop your resume (PDF or TXT) in the upload zone below, then paste a job description or drop a screenshot of a job posting!'
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // File Upload State
  const [dragActive, setDragActive] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch applications and profile on mount
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/analyze`);
        const data = await res.json();
        if (data.success) {
          setApplications(data.applications || []);
          setWeeklyVelocity(data.weeklyVelocity || 0);
          setActiveNudges(data.activeNudges || []);
          
          // Select the most recent application by default if exists
          if (data.applications && data.applications.length > 0) {
            setSelectedApp(data.applications[data.applications.length - 1]);
          }
        }
        
        // Fetch profile
        const profileRes = await fetch(`${BACKEND_URL}/api/applications`); // will just trigger GET if we implemented it, or fallback
        // Fetch current resume text from datastore if we have applications
        const storedResumeText = localStorage.getItem('career_command_resume') || '';
        const storedResumeName = localStorage.getItem('career_command_resume_name') || '';
        setResumeText(storedResumeText);
        setResumeName(storedResumeName);
        if (storedResumeText) {
          setChatHistory(prev => [
            ...prev,
            {
              role: 'assistant',
              content: `Loaded resume: **${storedResumeName || 'resume.pdf'}**. Drop a job link, paste JD text, or upload a screenshot to generate your tailored workspace!`
            }
          ]);
        }
      } catch (err) {
        console.error('Error loading applications:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatLoading]);

  // Drag and Drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await handleFileUpload(e.target.files[0]);
    }
  };

  // Upload and parse file (PDF resume, or PNG screenshot)
  const handleFileUpload = async (file) => {
    setParsingFile(true);
    setChatHistory(prev => [
      ...prev,
      { role: 'user', content: `Uploaded file: ${file.name}` },
      { role: 'assistant', content: `Analyzing file **${file.name}**...` }
    ]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${BACKEND_URL}/api/parse-file`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to parse file');
      }

      const extractedText = data.text;
      const isScreenshot = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';

      if (isPdf && !resumeText) {
        // Treat as Candidate's Resume
        setResumeText(extractedText);
        setResumeName(file.name);
        localStorage.setItem('career_command_resume', extractedText);
        localStorage.setItem('career_command_resume_name', file.name);
        
        // Sync with mock DB profile
        await fetch(`${BACKEND_URL}/api/applications`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile: { resume: extractedText, name: file.name } })
        });

        setChatHistory(prev => [
          ...prev.slice(0, -1),
          {
            role: 'assistant',
            content: `Successfully parsed and cached your resume: **${file.name}**.\n\nNow, paste a job description or drop a screenshot of a job posting to run the Signal Score fit analysis!`
          }
        ]);
      } else {
        // Treat as Job Description / Posting
        setChatHistory(prev => [
          ...prev.slice(0, -1),
          {
            role: 'assistant',
            content: `Extracted Job Description text from **${file.name}**.\n\nRunning analysis and resume alignment... This will take a few seconds.`
          }
        ]);
        await runAnalysisWorkflow(extractedText);
      }
    } catch (err) {
      console.error('File processing error:', err);
      setChatHistory(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: `❌ Error: ${err.message || 'Could not extract text. Make sure the file format is supported.'}` }
      ]);
    } finally {
      setParsingFile(false);
    }
  };

  // Run the core Agentic workflow (JD + Resume -> Analysis)
  const runAnalysisWorkflow = async (jdContent) => {
    if (!resumeText) {
      setChatHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '⚠️ Please upload your resume first (PDF or TXT) before analyzing a job description.'
        }
      ]);
      return;
    }

    setAnalyzing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jdText: jdContent,
          resumeText: resumeText
        })
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to process workflow');
      }

      setApplications(data.allApps || []);
      setWeeklyVelocity(data.weeklyVelocity || 0);
      setActiveNudges(data.activeNudges || []);
      setSelectedApp(data.application);
      setActiveTab('analysis'); // Automatically switch to analysis tab

      setChatHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `✅ Analysis complete! Added **${data.application.role}** at **${data.application.company}** to your pipeline.\n\n*   **Signal Score:** ${data.application.matchScore}%\n*   **Effort Required:** ${data.application.effort}\n*   **Flag Status:** ${data.application.flag}\n\nCheck the workspace tabs on the right to view your Tailored Resume, Outreach Drafts, and Interview Prep Pack!`
        }
      ]);
    } catch (err) {
      console.error('Analysis workflow error:', err);
      setChatHistory(prev => [
        ...prev,
        { role: 'assistant', content: `❌ Error running analysis: ${err.message || 'API request failed.'}` }
      ]);
    } finally {
      setAnalyzing(false);
    }
  };

  // Chat conversational agent
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setChatInput('');
    setChatLoading(true);

    const updatedHistory = [...chatHistory, { role: 'user', content: userMessage }];
    setChatHistory(updatedHistory);

    try {
      const res = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          chatHistory: updatedHistory.slice(-6), // keep last 6 turns context
          resumeText,
          currentJdText: selectedApp ? selectedApp.jdText : ''
        })
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate response');
      }

      setChatHistory(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      console.error('Chat error:', err);
      setChatHistory(prev => [
        ...prev,
        { role: 'assistant', content: `⚠️ Career Concierge is currently offline: ${err.message || 'API connection failed.'}` }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Kanban Drag & Drop Column move handler
  const handleColumnMove = async (appId, newStatus) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/applications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: appId,
          updates: { status: newStatus }
        })
      });
      const data = await res.json();

      if (data.success) {
        setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
        if (selectedApp && selectedApp.id === appId) {
          setSelectedApp(prev => ({ ...prev, status: newStatus }));
        }
        // Refresh nudges and velocity
        const refreshRes = await fetch(`${BACKEND_URL}/api/analyze`);
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          setWeeklyVelocity(refreshData.weeklyVelocity);
          setActiveNudges(refreshData.activeNudges);
        }
      }
    } catch (err) {
      console.error('Error moving Kanban card:', err);
    }
  };

  // Dismiss follow up nudge handler
  const handleDismissNudge = async (nudgeId, appId, nudgeType) => {
    try {
      const field = nudgeType.includes('3') ? 'nudge3Dismissed' : 'nudge7Dismissed';
      const res = await fetch(`${BACKEND_URL}/api/applications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: appId,
          updates: { [field]: true }
        })
      });
      const data = await res.json();
      if (data.success) {
        setActiveNudges(prev => prev.filter(n => n.id !== nudgeId));
      }
    } catch (err) {
      console.error('Error dismissing nudge:', err);
    }
  };

  // Delete application handler
  const handleDeleteApp = async (appId) => {
    if (!confirm('Are you sure you want to delete this application?')) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/applications?id=${appId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        const remaining = applications.filter(a => a.id !== appId);
        setApplications(remaining);
        if (selectedApp && selectedApp.id === appId) {
          setSelectedApp(remaining.length > 0 ? remaining[remaining.length - 1] : null);
        }
        // Update velocity
        const refreshRes = await fetch(`${BACKEND_URL}/api/analyze`);
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          setWeeklyVelocity(refreshData.weeklyVelocity);
          setActiveNudges(refreshData.activeNudges);
        }
      }
    } catch (err) {
      console.error('Error deleting application:', err);
    }
  };

  // Safe parse tailored bullets
  const getTailoredBulletsList = () => {
    if (!selectedApp || !selectedApp.tailoredBullets) return [];
    try {
      return JSON.parse(selectedApp.tailoredBullets);
    } catch (e) {
      // Fallback
      return [];
    }
  };

  const filteredApps = searchQuery
    ? applications.filter(
        a =>
          a.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.role.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : applications;

  // 3D card tilt effect ref & logic
  const cardRef = useRef(null);
  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -8; // degrees max
    const rotateY = ((x - centerX) / centerX) * 8;
    
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* SideNavBar (Stitch aesthetics) */}
      <nav className="fixed h-screen w-[260px] left-0 top-0 flex flex-col py-6 bg-surface/40 backdrop-blur-xl border-r border-white/10 z-50 justify-between">
        <div>
          <div className="px-6 mb-8">
            <h1 className="font-sans text-xl font-extrabold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">terminal</span>
              Career Command
            </h1>
            <p className="text-on-surface-variant font-mono text-[9px] tracking-widest mt-1 uppercase">AI-Driven Strategy</p>
          </div>

          <div className="flex-1 space-y-1">
            <button
              onClick={() => setActiveTab('analysis')}
              className={`w-full flex items-center gap-4 px-6 py-3 transition-all text-left font-bold ${
                activeTab === 'analysis' ? 'text-secondary border-r-2 border-secondary bg-white/5' : 'text-on-surface-variant hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined">analytics</span>
              <span className="font-mono text-xs uppercase tracking-wide">Analysis</span>
            </button>
            <button
              onClick={() => setActiveTab('diff')}
              className={`w-full flex items-center gap-4 px-6 py-3 transition-all text-left font-bold ${
                activeTab === 'diff' ? 'text-secondary border-r-2 border-secondary bg-white/5' : 'text-on-surface-variant hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined">compare</span>
              <span className="font-mono text-xs uppercase tracking-wide">Resume Diff</span>
            </button>
            <button
              onClick={() => setActiveTab('outreach')}
              className={`w-full flex items-center gap-4 px-6 py-3 transition-all text-left font-bold ${
                activeTab === 'outreach' ? 'text-secondary border-r-2 border-secondary bg-white/5' : 'text-on-surface-variant hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined">send</span>
              <span className="font-mono text-xs uppercase tracking-wide">Outreach</span>
            </button>
            <button
              onClick={() => setActiveTab('prep')}
              className={`w-full flex items-center gap-4 px-6 py-3 transition-all text-left font-bold ${
                activeTab === 'prep' ? 'text-secondary border-r-2 border-secondary bg-white/5' : 'text-on-surface-variant hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined">assignment</span>
              <span className="font-mono text-xs uppercase tracking-wide">Prep Pack</span>
            </button>
            <button
              onClick={() => setActiveTab('pipeline')}
              className={`w-full flex items-center gap-4 px-6 py-3 transition-all text-left font-bold ${
                activeTab === 'pipeline' ? 'text-secondary border-r-2 border-secondary bg-white/5' : 'text-on-surface-variant hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined">view_kanban</span>
              <span className="font-mono text-xs uppercase tracking-wide">Pipeline</span>
            </button>
          </div>
        </div>

        {/* User Info / Profile footer */}
        <div className="px-6 pt-4 border-t border-white/10 space-y-4">
          <div className="flex items-center gap-2 text-xs font-mono text-on-surface-variant">
            <span className="material-symbols-outlined text-sm">trending_up</span>
            VELOCITY: {weeklyVelocity} / WEEK
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center border border-white/10 overflow-hidden">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">account_circle</span>
            </div>
            <div>
              <p className="font-mono text-[11px] font-bold text-on-surface leading-none">Arjun Patel</p>
              <span className="text-[9px] font-mono text-secondary">HACKATHON BUILD</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Workspace */}
      <main className="ml-[260px] min-h-screen flex flex-col w-[calc(100%-260px)]">
        {/* Top Header */}
        <header className="h-16 flex justify-between items-center px-8 bg-surface/40 backdrop-blur-xl border-b border-white/10 fixed top-0 right-0 w-[calc(100%-260px)] z-40">
          <div className="flex items-center gap-6">
            <div className="flex gap-4 items-center">
              {applications.length > 0 && (
                <select
                  value={selectedApp ? selectedApp.id : ''}
                  onChange={(e) => {
                    const app = applications.find(a => a.id === e.target.value);
                    if (app) setSelectedApp(app);
                  }}
                  className="bg-surface-container border border-white/10 rounded-xl px-3 py-1.5 text-xs text-on-surface focus:outline-none"
                >
                  {applications.map(app => (
                    <option key={app.id} value={app.id}>
                      {app.company} — {app.role}
                    </option>
                  ))}
                </select>
              )}
              {selectedApp && (
                <button
                  onClick={() => handleDeleteApp(selectedApp.id)}
                  className="text-error hover:brightness-110 flex items-center gap-1 text-[11px] font-mono"
                >
                  <span className="material-symbols-outlined text-xs">delete</span> DELETE
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                type="text"
                placeholder="Search pipeline..."
                className="bg-surface-container-low border border-white/10 rounded-full py-1.5 px-4 text-xs w-56 focus:outline-none focus:ring-1 focus:ring-primary/20"
              />
              <span className="material-symbols-outlined absolute right-3 top-2 text-on-surface-variant text-base">search</span>
            </div>
            <button className="bg-primary text-on-primary px-4 py-1.5 rounded-lg font-mono text-[10px] font-bold hover:brightness-110 transition-all uppercase">
              HACKATHON v1.0
            </button>
          </div>
        </header>

        {/* Dashboard Grid Workspace */}
        <div className="flex-1 mt-16 flex overflow-hidden">
          
          {/* Left Column: AI Chat & Drag-Drop Zone (40%) */}
          <section className="w-[38%] border-r border-white/10 flex flex-col bg-surface-container-lowest/50">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-surface-container-low/20">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse"></div>
                <h2 className="font-sans font-bold text-on-surface text-sm">Career Concierge</h2>
              </div>
              <span className="font-mono text-[9px] text-on-surface-variant px-2 py-1 rounded bg-white/5">GROQ: LLAMA-3.3</span>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {chatHistory.map((chat, idx) => (
                <div key={idx} className={`flex gap-3 ${chat.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {chat.role !== 'user' && (
                    <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-primary text-sm">smart_toy</span>
                    </div>
                  )}
                  <div
                    className={`glass-card p-4 rounded-xl max-w-[85%] ${
                      chat.role === 'user' ? 'bg-primary/10 border-primary/20 rounded-tr-none' : 'rounded-tl-none'
                    }`}
                  >
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{chat.content}</p>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center shrink-0 animate-spin">
                    <span className="material-symbols-outlined text-primary text-sm">autorenew</span>
                  </div>
                  <div className="glass-card p-4 rounded-xl rounded-tl-none max-w-[85%]">
                    <p className="text-xs font-mono animate-pulse">Generating reply...</p>
                  </div>
                </div>
              )}
              {analyzing && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded bg-secondary/20 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-secondary text-sm animate-bounce">rocket_launch</span>
                  </div>
                  <div className="glass-card p-4 rounded-xl rounded-tl-none max-w-[85%] border-secondary/20 bg-secondary/5">
                    <p className="text-xs font-mono">Running core workflow: Parsing, Scoring, Tailoring bullet points, Drafting outreaches...</p>
                    <div className="w-full bg-white/5 h-1 rounded overflow-hidden mt-3 relative">
                      <div className="absolute top-0 left-0 bg-secondary h-full animate-infinite w-1/3 rounded"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef}></div>
            </div>

            {/* Drag & Drop File Zone */}
            <div className="px-6 pb-6">
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`glass-panel border-dashed border-2 rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  dragActive ? 'border-secondary/60 bg-secondary/5' : 'border-white/10 hover:border-primary/40'
                } mb-4 relative overflow-hidden`}
              >
                {parsingFile && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                    <span className="material-symbols-outlined text-3xl text-secondary animate-bounce">pageview</span>
                    <p className="text-[11px] font-mono mt-2 text-secondary">Gemini File Scanner OCR Processing...</p>
                  </div>
                )}
                <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-1">cloud_upload</span>
                <p className="font-mono text-[10px] font-bold">
                  {resumeName ? `Cached Resume: ${resumeName}` : 'Drop Resume PDF or Screenshot JDs'}
                </p>
                <p className="text-[10px] text-on-surface-variant mt-1">Supports PDF, PNG, JPG, TXT</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="application/pdf,image/*,text/plain"
                />
              </div>

              {/* Chat Input Console */}
              <form onSubmit={handleChatSubmit} className="relative">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleChatSubmit(e);
                    }
                  }}
                  placeholder="Ask Career Concierge or paste JD text..."
                  className="w-full glass-card rounded-2xl p-4 pr-12 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none min-h-[90px] active-glow"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="absolute right-4 bottom-4 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-on-primary hover:scale-110 transition-transform disabled:opacity-50 disabled:scale-100"
                >
                  <span className="material-symbols-outlined text-lg">arrow_upward</span>
                </button>
              </form>
            </div>

          </section>

          {/* Right Column: Tabbed Workspace Dashboards (62%) */}
          <section className="w-[62%] flex flex-col bg-surface-container-lowest overflow-hidden">
            
            {/* Notifications / Nudge Bar */}
            {activeNudges.length > 0 && (
              <div className="bg-tertiary/10 border-b border-tertiary/20 px-8 py-3 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-tertiary animate-pulse">campaign</span>
                  <p className="text-xs text-on-surface font-semibold">
                    <span className="text-tertiary uppercase font-mono font-bold">Follow-Up Nudge:</span> {activeNudges[0].message}
                  </p>
                </div>
                <button
                  onClick={() => handleDismissNudge(activeNudges[0].id, activeNudges[0].appId, activeNudges[0].type)}
                  className="text-on-surface-variant hover:text-white font-mono text-[10px] uppercase border border-white/10 rounded px-2.5 py-1"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Tab Headers */}
            <div className="flex border-b border-white/10 px-8 bg-surface/20">
              <button
                onClick={() => setActiveTab('analysis')}
                className={`px-4 py-4 font-mono text-[10px] tracking-wider uppercase transition-all ${
                  activeTab === 'analysis' ? 'border-b-2 border-secondary text-secondary font-bold' : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                Analysis
              </button>
              <button
                onClick={() => setActiveTab('diff')}
                className={`px-4 py-4 font-mono text-[10px] tracking-wider uppercase transition-all ${
                  activeTab === 'diff' ? 'border-b-2 border-secondary text-secondary font-bold' : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                Resume Diff
              </button>
              <button
                onClick={() => setActiveTab('outreach')}
                className={`px-4 py-4 font-mono text-[10px] tracking-wider uppercase transition-all ${
                  activeTab === 'outreach' ? 'border-b-2 border-secondary text-secondary font-bold' : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                Outreach Drafts
              </button>
              <button
                onClick={() => setActiveTab('prep')}
                className={`px-4 py-4 font-mono text-[10px] tracking-wider uppercase transition-all ${
                  activeTab === 'prep' ? 'border-b-2 border-secondary text-secondary font-bold' : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                Prep Pack
              </button>
              <button
                onClick={() => setActiveTab('pipeline')}
                className={`px-4 py-4 font-mono text-[10px] tracking-wider uppercase transition-all ${
                  activeTab === 'pipeline' ? 'border-b-2 border-secondary text-secondary font-bold' : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                Pipeline Board
              </button>
            </div>

            {/* Workspace Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              
              {/* TAB 1: Analysis */}
              {activeTab === 'analysis' && (
                <div className="space-y-6">
                  {selectedApp ? (
                    <>
                      <div className="grid grid-cols-2 gap-6">
                        {/* 3D Tilted Glass Score Circular Ring */}
                        <div
                          ref={cardRef}
                          onMouseMove={handleMouseMove}
                          onMouseLeave={handleMouseLeave}
                          style={{ transition: 'transform 0.1s ease-out' }}
                          className="glass-card p-8 rounded-2xl flex flex-col items-center justify-center border border-white/10 select-none active-glow"
                        >
                          <div className="relative w-36 h-36">
                            <svg className="w-full h-full transform -rotate-90">
                              <circle className="text-surface-container-highest" cx="72" cy="72" fill="transparent" r="62" stroke="currentColor" strokeWidth="8"></circle>
                              <circle
                                className="text-secondary transition-all duration-1000"
                                cx="72"
                                cy="72"
                                fill="transparent"
                                r="62"
                                stroke="currentColor"
                                strokeDasharray={2 * Math.PI * 62}
                                strokeDashoffset={2 * Math.PI * 62 * (1 - selectedApp.matchScore / 100)}
                                strokeWidth="8"
                              ></circle>
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="font-sans text-4xl font-extrabold text-secondary">{selectedApp.matchScore}</span>
                              <span className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest">Signal Fit</span>
                            </div>
                          </div>
                          <div className="mt-5 text-center">
                            <p className="font-mono text-xs font-bold">{selectedApp.company}</p>
                            <p className="text-[11px] text-on-surface-variant mt-1">{selectedApp.role}</p>
                            <span className="mt-3 inline-block px-3 py-1 rounded-full bg-secondary/10 border border-secondary text-secondary font-mono text-[9px] uppercase tracking-wide">
                              {selectedApp.matchScore >= 80 ? 'HIGH MATCH' : selectedApp.matchScore >= 60 ? 'MEDIUM MATCH' : 'LOW MATCH'}
                            </span>
                          </div>
                        </div>

                        {/* Effort & Flag Signals */}
                        <div className="space-y-4">
                          <h3 className="font-mono text-on-surface-variant uppercase tracking-widest text-[11px]">Triage Verdict</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="glass-card p-4 rounded-xl border border-white/5">
                              <p className="font-mono text-[9px] text-on-surface-variant">EFFORT-TO-WIN</p>
                              <p className={`text-base font-extrabold mt-1 uppercase ${
                                selectedApp.effort === 'Easy' ? 'text-secondary' : selectedApp.effort === 'Medium' ? 'text-tertiary' : 'text-error'
                              }`}>{selectedApp.effort}</p>
                            </div>
                            <div className={`glass-card p-4 rounded-xl border-l-4 ${
                              selectedApp.flag === 'Green' ? 'border-secondary' : selectedApp.flag === 'Yellow' ? 'border-tertiary' : 'border-error'
                            }`}>
                              <p className="font-mono text-[9px] text-on-surface-variant">POSTING SIGNAL</p>
                              <p className={`text-base font-extrabold mt-1 uppercase ${
                                selectedApp.flag === 'Green' ? 'text-secondary' : selectedApp.flag === 'Yellow' ? 'text-tertiary' : 'text-error'
                              }`}>{selectedApp.flag} FLAG</p>
                            </div>
                          </div>
                          {selectedApp.flagReason && (
                            <div className="glass-card p-4 rounded-xl border border-white/5">
                              <p className="font-mono text-[9px] text-on-surface-variant uppercase">AI Signal Log</p>
                              <p className="text-[11px] text-on-surface mt-1 leading-relaxed">{selectedApp.flagReason}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Gaps List */}
                      <div className="space-y-3">
                        <h3 className="font-mono text-on-surface-variant uppercase tracking-widest text-[11px]">Resume Mismatch & Gaps</h3>
                        <div className="grid grid-cols-3 gap-4">
                          {(selectedApp.gaps || []).map((gap, i) => (
                            <div
                              key={i}
                              className={`glass-card p-4 rounded-xl border-l-4 ${
                                gap.type === 'MISSING KEYWORD'
                                  ? 'border-tertiary'
                                  : gap.type === 'SKILL MISMATCH'
                                  ? 'border-error'
                                  : 'border-primary'
                              }`}
                            >
                              <p
                                className={`font-mono text-[9px] ${
                                  gap.type === 'MISSING KEYWORD'
                                    ? 'text-tertiary'
                                    : gap.type === 'SKILL MISMATCH'
                                    ? 'text-error'
                                    : 'text-primary'
                                }`}
                              >
                                {gap.type}
                              </p>
                              <p className="text-[11px] text-on-surface mt-1 leading-snug">{gap.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Industry Benchmark */}
                      <div className="glass-card p-6 rounded-2xl">
                        <h3 className="font-mono text-on-surface-variant uppercase mb-4 text-[11px]">Skill Match Distribution</h3>
                        <div className="h-28 flex items-end justify-between gap-6 px-4">
                          <div className="flex-1 flex flex-col items-center gap-1.5">
                            <div className="w-full bg-surface-container-highest rounded-t h-[40%]"></div>
                            <span className="font-mono text-[9px] text-on-surface-variant">Junior</span>
                          </div>
                          <div className="flex-1 flex flex-col items-center gap-1.5">
                            <div className="w-full bg-surface-container-highest rounded-t h-[65%]"></div>
                            <span className="font-mono text-[9px] text-on-surface-variant">Mid-Level</span>
                          </div>
                          <div className="flex-1 flex flex-col items-center gap-1.5">
                            <div className="w-full bg-primary/40 rounded-t h-[85%] border-t-2 border-primary active-glow"></div>
                            <span className="font-mono text-[9px] text-primary font-bold">YOUR FIT</span>
                          </div>
                          <div className="flex-1 flex flex-col items-center gap-1.5">
                            <div className="w-full bg-surface-container-highest rounded-t h-[75%]"></div>
                            <span className="font-mono text-[9px] text-on-surface-variant">Senior</span>
                          </div>
                          <div className="flex-1 flex flex-col items-center gap-1.5">
                            <div className="w-full bg-surface-container-highest rounded-t h-[50%]"></div>
                            <span className="font-mono text-[9px] text-on-surface-variant">Lead/Staff</span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-[400px] flex flex-col items-center justify-center text-center">
                      <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-3">analytics</span>
                      <p className="font-mono text-sm text-on-surface-variant">No job analyzed yet.</p>
                      <p className="text-xs text-on-surface-variant/60 mt-1">Paste a job description or drop a file to see the analysis.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Resume Diff */}
              {activeTab === 'diff' && (
                <div className="h-full space-y-6">
                  {selectedApp && selectedApp.tailoredBullets ? (
                    <div className="grid grid-cols-2 gap-6 h-full">
                      {/* Left: Original Bullets */}
                      <div className="flex flex-col">
                        <h4 className="font-mono text-on-surface-variant mb-3 uppercase text-[10px]">Your Original Resume Experience</h4>
                        <div className="glass-panel rounded-2xl p-5 flex-1 font-mono text-[11px] text-on-surface-variant border-white/5 space-y-4 overflow-y-auto max-h-[450px] custom-scrollbar">
                          <p className="font-sans font-bold text-on-surface border-b border-white/5 pb-2 text-xs">Work Experience Details</p>
                          <ul className="list-disc pl-4 space-y-3 opacity-80 leading-relaxed">
                            {getTailoredBulletsList().map((bullet, idx) => (
                              <li key={idx} className="pb-3 border-b border-white/5 last:border-0">
                                {bullet.original || bullet}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      
                      {/* Right: AI Tailored Bullets (Side by side Diff) */}
                      <div className="flex flex-col">
                        <h4 className="font-mono text-secondary mb-3 uppercase text-[10px] flex justify-between">
                          AI Optimized Experience
                          <span className="text-[9px] text-on-surface-variant font-normal">TAILORED FOR FIT</span>
                        </h4>
                        <div className="glass-panel rounded-2xl p-5 flex-1 font-mono text-[11px] border-secondary/20 bg-secondary/5 space-y-4 overflow-y-auto max-h-[450px] custom-scrollbar active-glow">
                          <p className="font-sans font-bold text-on-surface border-b border-white/5 pb-2 text-xs">Optimized Work Experience</p>
                          <ul className="list-disc pl-4 space-y-3 leading-relaxed">
                            {getTailoredBulletsList().map((bullet, idx) => (
                              <li key={idx} className="pb-3 border-b border-white/5 last:border-0">
                                {bullet.tailored ? (
                                  <>
                                    <p className="text-secondary font-semibold">{bullet.tailored}</p>
                                    <span className="text-[9px] text-on-surface-variant block mt-1 italic font-sans">
                                      ℹ️ {bullet.reason || 'Sharpened metrics & impact terminology.'}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-on-surface">{bullet}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[400px] flex flex-col items-center justify-center text-center">
                      <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-3">compare</span>
                      <p className="font-mono text-sm text-on-surface-variant">No resume optimizations generated yet.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Outreach Drafts */}
              {activeTab === 'outreach' && (
                <div className="space-y-6">
                  {selectedApp && selectedApp.outreachMessages ? (
                    <>
                      {/* Sub tab selectors for tone */}
                      <div className="flex gap-2 p-1 bg-surface-container-high rounded-lg w-fit">
                        <button
                          onClick={() => setOutreachTone('confident')}
                          className={`px-4 py-1.5 rounded-md font-mono text-[9px] transition-all uppercase ${
                            outreachTone === 'confident' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant hover:bg-white/5'
                          }`}
                        >
                          Confident
                        </button>
                        <button
                          onClick={() => setOutreachTone('curious')}
                          className={`px-4 py-1.5 rounded-md font-mono text-[9px] transition-all uppercase ${
                            outreachTone === 'curious' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant hover:bg-white/5'
                          }`}
                        >
                          Curious
                        </button>
                        <button
                          onClick={() => setOutreachTone('concise')}
                          className={`px-4 py-1.5 rounded-md font-mono text-[9px] transition-all uppercase ${
                            outreachTone === 'concise' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant hover:bg-white/5'
                          }`}
                        >
                          Concise
                        </button>
                      </div>

                      {/* Outreach text area */}
                      <div className="glass-card rounded-2xl p-8 relative active-glow">
                        <div className="absolute top-4 right-4">
                          <button
                            onClick={() => {
                              const text = selectedApp.outreachMessages[outreachTone] || '';
                              navigator.clipboard.writeText(text);
                              alert('Draft copied to clipboard!');
                            }}
                            className="flex items-center gap-1.5 font-mono text-[9px] text-primary hover:scale-105 transition-transform"
                          >
                            <span className="material-symbols-outlined text-xs">content_copy</span>
                            COPY DRAFT
                          </button>
                        </div>
                        <div className="space-y-4 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                          {selectedApp.outreachMessages[outreachTone] || 'Generating draft...'}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-[400px] flex flex-col items-center justify-center text-center">
                      <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-3">send</span>
                      <p className="font-mono text-sm text-on-surface-variant">No outreach drafts available.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Prep Pack */}
              {activeTab === 'prep' && (
                <div className="space-y-6">
                  {selectedApp && selectedApp.interviewQuestions ? (
                    <>
                      <div className="flex justify-between items-end border-b border-white/5 pb-3">
                        <div>
                          <h3 className="font-sans font-bold text-on-surface text-base">Interview Prep Pack</h3>
                          <p className="font-mono text-[10px] text-on-surface-variant mt-1 uppercase tracking-wide">
                            Custom Briefing for {selectedApp.company} interview style
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setChatHistory(prev => [
                              ...prev,
                              { role: 'user', content: `Start mock interview session for ${selectedApp.company}` },
                              { role: 'assistant', content: `Awesome! Let's start the mock interview session for the **${selectedApp.role}** role at **${selectedApp.company}**.\n\nHere is your first question:\n\n**"${selectedApp.interviewQuestions[0]?.question}"**\n\nTake a moment to formulate your response or reply here, and I will critique it!` }
                            ]);
                          }}
                          className="font-mono text-[9px] border border-primary/40 text-primary px-4 py-2 rounded-xl hover:bg-primary/10 transition-colors uppercase font-bold"
                        >
                          Start Live Mock Session
                        </button>
                      </div>

                      <div className="space-y-4">
                        {(selectedApp.interviewQuestions || []).map((q, idx) => (
                          <div key={idx} className="glass-card p-5 rounded-2xl group hover:border-primary/40 transition-all">
                            <div className="flex justify-between items-center mb-2">
                              <span className="px-2.5 py-0.5 bg-tertiary/10 text-tertiary rounded font-mono text-[9px] border border-tertiary/20 uppercase tracking-wide">
                                {q.type}
                              </span>
                              <span className="font-mono text-[9px] text-on-surface-variant uppercase">{q.duration || '10 MINS'}</span>
                            </div>
                            <h4 className="font-sans font-semibold text-xs leading-normal text-on-surface group-hover:text-primary transition-colors">
                              "{q.question}"
                            </h4>
                            <div className="mt-4 p-4 bg-surface-container-highest/50 rounded-xl hidden group-hover:block transition-all border border-white/5">
                              <p className="font-mono text-[9px] text-primary uppercase font-bold tracking-widest mb-1.5">AI Suggestion</p>
                              <p className="font-mono text-[10px] text-on-surface leading-relaxed whitespace-pre-wrap">{q.suggestion}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="h-[400px] flex flex-col items-center justify-center text-center">
                      <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-3">assignment</span>
                      <p className="font-mono text-sm text-on-surface-variant">No interview prep pack generated.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: Pipeline Kanban Board */}
              {activeTab === 'pipeline' && (
                <div className="h-full flex flex-col">
                  <div className="flex gap-6 overflow-x-auto pb-4 kanban-scroll h-full">
                    {/* Columns mapping */}
                    {['Applied', 'Screening', 'Interview', 'Offer', 'Rejected'].map(col => {
                      const colApps = filteredApps.filter(a => a.status === col);
                      return (
                        <div key={col} className="w-[280px] shrink-0 flex flex-col gap-4 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                          <div className="flex justify-between items-center px-1 border-b border-white/5 pb-2">
                            <h5 className="font-mono text-[10px] text-on-surface-variant uppercase font-bold tracking-wide">
                              {col} ({colApps.length})
                            </h5>
                          </div>

                          <div className="flex-1 space-y-3 overflow-y-auto max-h-[400px] custom-scrollbar">
                            {colApps.map(app => (
                              <div
                                key={app.id}
                                onClick={() => setSelectedApp(app)}
                                className={`glass-card p-4 rounded-xl space-y-3 cursor-pointer border ${
                                  selectedApp && selectedApp.id === app.id ? 'border-primary bg-primary/5 active-glow' : 'border-white/5'
                                }`}
                              >
                                <div className="flex justify-between">
                                  <p className="font-sans font-bold text-xs text-on-surface leading-none">{app.company}</p>
                                  <span className="font-mono text-[8px] text-on-surface-variant uppercase">
                                    {new Date(app.dateApplied).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                                <p className="text-[10px] text-on-surface-variant leading-none">{app.role}</p>
                                
                                <div className="flex justify-between items-center">
                                  <div className="flex gap-1.5 items-center">
                                    <span className={`w-1.5 h-1.5 rounded-full ${app.matchScore >= 80 ? 'bg-secondary' : 'bg-tertiary'}`}></span>
                                    <span className="font-mono text-[9px] text-on-surface-variant">{app.matchScore}% FIT</span>
                                  </div>
                                  <div className="flex gap-1">
                                    {/* Action buttons to change columns directly */}
                                    {col !== 'Applied' && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const statuses = ['Applied', 'Screening', 'Interview', 'Offer', 'Rejected'];
                                          const prevIndex = statuses.indexOf(col) - 1;
                                          handleColumnMove(app.id, statuses[prevIndex]);
                                        }}
                                        className="w-5 h-5 bg-white/5 hover:bg-white/10 rounded flex items-center justify-center text-xs text-on-surface-variant hover:text-white"
                                      >
                                        ◀
                                      </button>
                                    )}
                                    {col !== 'Rejected' && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const statuses = ['Applied', 'Screening', 'Interview', 'Offer', 'Rejected'];
                                          const nextIndex = statuses.indexOf(col) + 1;
                                          handleColumnMove(app.id, statuses[nextIndex]);
                                        }}
                                        className="w-5 h-5 bg-white/5 hover:bg-white/10 rounded flex items-center justify-center text-xs text-on-surface-variant hover:text-white"
                                      >
                                        ▶
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                            {colApps.length === 0 && (
                              <div className="h-20 flex items-center justify-center border border-dashed border-white/5 rounded-xl text-center text-on-surface-variant/40 text-[10px]">
                                Empty Column
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
