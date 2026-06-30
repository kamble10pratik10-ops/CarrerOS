'use client';
import { useState, useEffect, useRef } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function JobMissionPage() {
  // State
  const [jdText, setJdText] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [resumeName, setResumeName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState(0); // 0=input, 1=intel, 2=resume, 3=outreach, 4=prep
  const [outreachTone, setOutreachTone] = useState('confident');
  const [addedToPipeline, setAddedToPipeline] = useState(false);
  const [downloadingResume, setDownloadingResume] = useState(false);
  const [mentorMessages, setMentorMessages] = useState([]);
  const [mentorInput, setMentorInput] = useState('');
  const [mentorLoading, setMentorLoading] = useState(false);
  const mentorEndRef = useRef(null);
  const resultsRef = useRef(null);

  // Auto-fetch resume from profile on mount
  useEffect(() => {
    async function fetchProfile() {
      try {
        const token = localStorage.getItem('careeros_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch(`${BACKEND_URL}/api/profile`, { headers });
        const data = await res.json();
        if (data.success && data.profile) {
          setResumeText(data.profile.resumeText || '');
          setResumeName(data.profile.resumeName || '');
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      }
    }
    fetchProfile();
  }, []);

  // Run analysis
  const handleAnalyze = async () => {
    if (!jdText.trim()) return;
    if (!resumeText) {
      setError('Please upload your resume in the Profile page first.');
      return;
    }

    setAnalyzing(true);
    setError('');
    setResult(null);
    setActiveStep(0);
    setAddedToPipeline(false);

    try {
      const token = localStorage.getItem('careeros_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      const res = await fetch(`${BACKEND_URL}/api/analyze`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jdText, resumeText })
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.detail || 'Analysis failed');

      setResult(data.application);
      setActiveStep(1);

      // Scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message || 'Failed to analyze. Check your API keys.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Parse tailored bullets safely
  const getTailoredBullets = () => {
    if (!result?.tailoredBullets) return [];
    try {
      return typeof result.tailoredBullets === 'string'
        ? JSON.parse(result.tailoredBullets)
        : result.tailoredBullets;
    } catch { return []; }
  };

  const handleDownloadResume = async () => {
    if (!result?.id) return;
    setDownloadingResume(true);
    try {
      const token = localStorage.getItem('careeros_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`${BACKEND_URL}/api/applications/${result.id}/download-resume`, { headers });
      
      if (!res.ok) throw new Error('Failed to download resume');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Tailored_Resume_${result.company}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download the tailored resume. Please try again.');
    } finally {
      setDownloadingResume(false);
    }
  };

  useEffect(() => {
    mentorEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mentorMessages]);

  const sendMentorMessage = async () => {
    if (!mentorInput.trim() || mentorLoading) return;
    const userMsg = { role: 'user', content: mentorInput };
    setMentorMessages(prev => [...prev, userMsg]);
    setMentorInput('');
    setMentorLoading(true);

    try {
      const token = localStorage.getItem('careeros_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      const res = await fetch(`${BACKEND_URL}/api/mentor/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: mentorInput,
          chatHistory: mentorMessages.slice(-10),
          resumeText: resumeText || '',
          profile: {
            targetRole: result?.role || '',
            skills: ''
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        setMentorMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setMentorMessages(prev => [...prev, { role: 'assistant', content: data.detail || 'Mentor unavailable. Check API keys.' }]);
      }
    } catch (err) {
      console.error('Mentor error:', err);
      setMentorMessages(prev => [...prev, { role: 'assistant', content: 'Could not reach the backend.' }]);
    } finally {
      setMentorLoading(false);
    }
  };

  const steps = [
    { id: 1, label: 'Intelligence', icon: 'search_insights' },
    { id: 2, label: 'Prep', icon: 'school' },
    { id: 3, label: 'Mentor', icon: 'school' },
  ];

  return (
    <div className="page-transition flex flex-col md:flex-row h-full relative z-10">
      {/* Left Panel — JD Input */}
      <div className="w-full md:w-[35%] border-r border-outline-variant/20 flex flex-col p-4 md:p-6 space-y-6 bg-surface-container-low/25 backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-extrabold text-on-surface tracking-tight">Job Mission</h1>
          <p className="text-on-surface-variant text-xs mt-1.5 font-medium">
            Analyze target job descriptions against your resume instantly.
          </p>
        </div>

        {/* Resume Status */}
        <div className="card-static p-4.5 flex items-center gap-3.5 border-outline-variant/30">
          <span className={`material-symbols-outlined text-xl ${resumeText ? 'text-success' : 'text-warning'}`}>
            {resumeText ? 'check_circle' : 'warning'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-on-surface truncate">
              {resumeName || 'No resume uploaded'}
            </p>
            <p className="text-[10px] text-muted font-semibold mt-0.5">
              {resumeText ? 'Auto-loaded from Profile' : 'Go to Profile page to upload'}
            </p>
          </div>
        </div>

        {/* JD Input */}
        <div className="flex-1 flex flex-col space-y-2">
          <label className="text-xs font-bold text-muted uppercase tracking-widest">
            Job Description
          </label>
          <textarea
            value={jdText}
            onChange={e => setJdText(e.target.value)}
            placeholder="Paste the full job description here..."
            className="premium-input flex-1 min-h-[280px] resize-none custom-scrollbar"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="card-static p-3.5 border-error/20 bg-error/8 flex items-center gap-2">
            <span className="material-symbols-outlined text-error text-sm">error</span>
            <p className="text-xs text-error font-medium">{error}</p>
          </div>
        )}

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          disabled={analyzing || !jdText.trim()}
          className="w-full py-3 bg-gradient-to-r from-primary to-secondary text-on-primary rounded-lg text-sm font-bold shadow-lg shadow-primary/20 btn-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {analyzing ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-on-primary/20 border-t-on-primary animate-spin" />
              Running AI Audit...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[16px] font-bold">bolt</span>
              Analyze Job Description
            </>
          )}
        </button>
      </div>

      {/* Right Panel — Results */}
      <div className="w-full md:w-[65%] overflow-y-auto custom-scrollbar bg-surface-dim/30" ref={resultsRef}>
        {!result && !analyzing ? (
          /* Empty State */
          <div className="flex items-center justify-center h-full p-8">
            <div className="text-center space-y-4 max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-surface-container-high border border-outline-variant/30 flex items-center justify-center mx-auto shadow-md">
                <span className="material-symbols-outlined text-muted text-4xl">target</span>
              </div>
              <h2 className="text-lg font-bold text-on-surface">Audit report is ready to compile</h2>
              <p className="text-sm text-on-surface-variant max-w-sm mx-auto leading-relaxed">
                Paste the JD, run the audit, and we will reveal fit analysis, resume keyword enhancements, recruiter letters, and prep questions.
              </p>
            </div>
          </div>
        ) : analyzing ? (
          /* Skeleton Loading */
          <div className="p-6 space-y-6">
            <div className="flex gap-2.5 mb-6">
              {[1,2,3,4].map(i => <div key={i} className="skeleton h-10 w-28 rounded-xl" />)}
            </div>
            <div className="skeleton h-7 w-64 mb-4" />
            <div className="skeleton h-32 rounded-xl mb-4" />
            <div className="skeleton h-6 w-48 mb-4" />
            <div className="skeleton h-24 rounded-xl mb-2" />
            <div className="skeleton h-24 rounded-xl" />
          </div>
        ) : (
          /* Results */
          <div className="p-6 space-y-6">
            {/* Step Tabs */}
            <div className="flex gap-1.5 bg-surface-container-low/60 border border-outline-variant/30 rounded-xl p-1.5">
              {steps.map(step => (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(step.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                    activeStep === step.id
                      ? 'bg-primary text-on-primary shadow-sm shadow-primary/10'
                      : 'text-on-surface-variant hover:bg-surface-container-high/40 hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{step.icon}</span>
                  {step.label}
                </button>
              ))}
            </div>

            {/* Step 1: Intelligence & Match */}
            {activeStep === 1 && (
              <div className="page-transition space-y-5">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-on-surface">Intelligence & Match Report</h2>
                </div>

                {/* Company & Role */}
                <div className="card-static p-5 flex items-center gap-6 border-outline-variant/30">
                  <div className="flex-1">
                    <p className="text-[10px] text-muted font-bold uppercase tracking-wider">Company</p>
                    <p className="text-base font-bold text-on-surface mt-1 truncate">{result.company}</p>
                  </div>
                  <div className="w-px h-10 bg-outline-variant/30" />
                  <div className="flex-1">
                    <p className="text-[10px] text-muted font-bold uppercase tracking-wider">Role</p>
                    <p className="text-base font-bold text-on-surface mt-1 truncate">{result.role}</p>
                  </div>
                  <div className="w-px h-10 bg-outline-variant/30" />
                  <div className="flex-1">
                    <p className="text-[10px] text-muted font-bold uppercase tracking-wider">Effort Required</p>
                    <span className="inline-block px-2.5 py-1 rounded bg-secondary/10 text-secondary text-xs font-bold border border-secondary/20 mt-1 uppercase tracking-wide">
                      {result.effort}
                    </span>
                  </div>
                </div>

                {/* Signal Score + Flag */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="card-static p-5 border-outline-variant/30">
                    <p className="text-[10px] text-muted font-bold uppercase tracking-wider mb-2">Resume Fit Score</p>
                    <div className="flex items-end gap-1.5">
                      <span className="text-4xl font-extrabold text-primary tracking-tight">{result.matchScore}</span>
                      <span className="text-sm text-on-surface-variant font-medium mb-1">/100</span>
                    </div>
                    <div className="mt-4 w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${result.matchScore}%`,
                          background: result.matchScore >= 70 ? '#10B981' : result.matchScore >= 40 ? '#F59E0B' : '#F43F5E'
                        }}
                      />
                    </div>
                  </div>
                  <div className={`card-static p-5 border-outline-variant/30 ${
                    result.flag === 'Red' ? 'border-l-4 border-l-error' : result.flag === 'Yellow' ? 'border-l-4 border-l-warning' : 'border-l-4 border-l-success'
                  }`}>
                    <p className="text-[10px] text-muted font-bold uppercase tracking-wider mb-2.5">Opportunity Risk Assessment</p>
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-xl ${
                        result.flag === 'Red' ? 'text-error' : result.flag === 'Yellow' ? 'text-warning' : 'text-success'
                      }`}>
                        {result.flag === 'Red' ? 'flag' : result.flag === 'Yellow' ? 'warning' : 'verified'}
                      </span>
                      <span className="text-sm font-bold text-on-surface">{result.flag} Assessment</span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-2 leading-relaxed font-medium">{result.flagReason}</p>
                  </div>
                </div>

                {/* Skill Gaps */}
                <div>
                  <h3 className="text-xs font-bold text-muted uppercase tracking-widest mb-3">Identified Skill Gaps ({result.gaps?.length || 0})</h3>
                  <div className="space-y-2.5">
                    {(result.gaps || []).map((gap, i) => (
                      <div key={i} className={`card-static p-4 flex items-start gap-4 border-outline-variant/30 ${
                        gap.type === 'MISSING KEYWORD' ? 'border-l-4 border-l-error bg-error/2' :
                        gap.type === 'SKILL MISMATCH' ? 'border-l-4 border-l-warning bg-warning/2' :
                        'border-l-4 border-l-primary bg-primary/2'
                      }`}>
                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                          gap.type === 'MISSING KEYWORD' ? 'bg-error/10 text-error border-error/20' :
                          gap.type === 'SKILL MISMATCH' ? 'bg-warning/10 text-warning border-warning/20' :
                          'bg-primary/10 text-primary border-primary/20'
                        }`}>
                          {gap.type}
                        </span>
                        <p className="text-xs text-on-surface font-semibold flex-1 leading-relaxed mt-0.5">{gap.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resume Optimization appended inside Intelligence */}
                <div className="pt-4 mt-6 border-t border-outline-variant/20 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-on-surface">Resume Optimization</h3>
                      <p className="text-xs text-on-surface-variant font-medium mt-1">AI-tailored recommendations based on the core job description gaps.</p>
                    </div>
                    <button
                      onClick={handleDownloadResume}
                      disabled={downloadingResume}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold text-primary bg-primary/10 border border-primary/20 btn-hover disabled:opacity-50"
                    >
                      {downloadingResume ? (
                        <span className="w-4 h-4 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                      ) : (
                        <span className="material-symbols-outlined text-sm font-bold">download</span>
                      )}
                      Get Tailored Resume
                    </button>
                  </div>

                  <div className="space-y-4">
                    {getTailoredBullets().map((bullet, i) => (
                      <div key={i} className="card-static p-5 space-y-3.5 border-outline-variant/30">
                        <div>
                          <p className="text-[10px] font-extrabold text-muted uppercase tracking-wider mb-1">Current Bullet Point</p>
                          <p className="text-xs text-on-surface-variant font-medium leading-relaxed">{bullet.original}</p>
                        </div>
                        <div className="w-full h-px bg-outline-variant/30" />
                        <div>
                          <p className="text-[10px] font-extrabold text-primary uppercase tracking-wider mb-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px] font-bold">bolt</span>
                            Tailored Suggestion
                          </p>
                          <p className="text-sm font-bold text-on-surface leading-relaxed">{bullet.tailored}</p>
                        </div>
                        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary/4 border border-primary/10">
                          <span className="material-symbols-outlined text-primary text-base shrink-0 mt-0.5">lightbulb</span>
                          <p className="text-[11px] text-on-surface-variant font-semibold leading-relaxed">{bullet.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Interview Prep (Learning Resources) */}
            {activeStep === 2 && (
              <div className="page-transition space-y-5">
                <h2 className="text-xl font-bold text-on-surface">Learning & Prep Resources</h2>
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed">High-quality, free resources tailored to help you master the skills needed for this role.</p>

                <div className="space-y-4">
                  {(result.learningResources || []).map((resource, i) => (
                    <div key={i} className="card-static p-5 space-y-3.5 border-outline-variant/30 border-l-4 border-l-secondary flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2.5">
                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                            resource.platform.toLowerCase().includes('youtube') ? 'bg-error/10 text-error border-error/20' :
                            resource.platform.toLowerCase().includes('github') ? 'bg-surface-container-high text-on-surface border-outline-variant/50' :
                            'bg-success/10 text-success border-success/20'
                          }`}>
                            {resource.platform}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-on-surface leading-relaxed">{resource.title}</p>
                        <p className="text-[11px] text-on-surface-variant font-semibold leading-relaxed">{resource.description}</p>
                      </div>
                      <a
                        href={resource.link.startsWith('http') ? resource.link : `https://www.google.com/search?q=${encodeURIComponent(resource.link)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-secondary bg-secondary/10 border border-secondary/20 hover:bg-secondary/20 transition-all"
                      >
                        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                        Open Resource
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: AI Mentor */}
            {activeStep === 3 && (
              <div className="flex flex-col space-y-4" style={{ height: '500px' }}>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">school</span>
                  <h2 className="text-lg font-bold text-on-surface">AI Mentor — {result.company}</h2>
                </div>
                <p className="text-xs text-on-surface-variant font-medium -mt-2">
                  Ask personalized questions about this role, resume improvements, and career strategy.
                </p>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pb-4 pr-1">
                  {mentorMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-4">
                      <span className="material-symbols-outlined text-muted text-3xl">forum</span>
                      <p className="text-xs text-on-surface-variant font-medium">Ask the mentor about this job or your resume</p>
                      <div className="grid grid-cols-1 gap-2 w-full max-w-md">
                        {[
                          'How can I tailor my resume better for this role?',
                          'What skills should I highlight for this job?',
                          'How does this role align with my career growth?',
                          'What companies should I target with my profile?',
                        ].map((q, i) => (
                          <button key={i} onClick={() => setMentorInput(q)}
                            className="card-static p-2.5 text-left text-xs font-bold text-on-surface-variant hover:border-primary/30 hover:text-on-surface transition-all btn-hover border-outline-variant/30">
                            "{q}"
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {mentorMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-xl px-4 py-3 shadow-md ${
                        msg.role === 'user'
                          ? 'bg-primary/10 text-on-surface border border-primary/20'
                          : 'card-static text-on-surface border border-outline-variant/30 bg-surface-container/40'
                      }`}>
                        {msg.role === 'assistant' && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-primary text-sm">school</span>
                            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Mentor</span>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap leading-relaxed font-semibold">{msg.content}</p>
                      </div>
                    </div>
                  ))}

                  {mentorLoading && (
                    <div className="flex justify-start">
                      <div className="card-static px-4 py-3 flex items-center gap-2.5 border-outline-variant/30 bg-surface-container/20">
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                        <span className="text-xs text-muted font-bold uppercase tracking-wider">Mentor is thinking...</span>
                      </div>
                    </div>
                  )}
                  <div ref={mentorEndRef} />
                </div>

                {/* Chat Input */}
                <div className="border-t border-outline-variant/20 pt-4 flex gap-3 shrink-0">
                  <input value={mentorInput} onChange={e => setMentorInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMentorMessage()}
                    placeholder="Ask about this role or your resume..."
                    className="flex-1 premium-input" />
                  <button onClick={sendMentorMessage} disabled={mentorLoading || !mentorInput.trim()}
                    className="px-5 py-3 bg-gradient-to-r from-primary to-secondary text-on-primary rounded-lg text-sm font-bold shadow-lg shadow-primary/20 btn-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm font-bold">send</span>
                    Send
                  </button>
                </div>
              </div>
            )}
            {/* Add to Pipeline CTA — always visible when results exist */}
            {result && activeStep > 0 && (
              <div className="border-t border-outline-variant/20 pt-5 mt-6 flex items-center gap-4">
                {addedToPipeline ? (
                  <div className="flex items-center gap-2 text-success text-sm font-bold">
                    <span className="material-symbols-outlined text-xl">check_circle</span>
                    Added to Pipeline — {result.company}, {result.role}
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setAddedToPipeline(true)}
                      className="px-5 py-2.5 bg-gradient-to-r from-primary to-secondary text-on-primary rounded-lg text-sm font-bold shadow-lg shadow-primary/25 btn-hover flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">add</span>
                      Add To Pipeline
                    </button>
                    <button
                      onClick={() => {
                        setResult(null);
                        setJdText('');
                        setActiveStep(0);
                      }}
                      className="px-5 py-2.5 rounded-lg text-sm font-bold text-on-surface-variant border border-outline-variant/30 bg-surface-container-high/40 hover:bg-surface-container-high/70 btn-hover"
                    >
                      Apply Later
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
