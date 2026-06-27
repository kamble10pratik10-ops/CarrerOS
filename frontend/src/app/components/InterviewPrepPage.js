'use client';
import { useState, useEffect, useRef } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function InterviewPrepPage() {
  const [applications, setApplications] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('jobs');

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
  const [prepResources, setPrepResources] = useState([]);

  // Question Generator State
  const [questions, setQuestions] = useState(null);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionError, setQuestionError] = useState('');
  const [selectedTypes, setSelectedTypes] = useState(['technical', 'behavioral', 'situational']);
  const [customSkills, setCustomSkills] = useState('');

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    interviewEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interviewMessages]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window && selectedJdId) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      let localFinal = '';
      rec.onstart = () => { setIsListening(true); localFinal = ''; setFinalTranscript(''); setInterimTranscript(''); };
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
            setFinalTranscript(''); setInterimTranscript(''); localFinal = '';
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

      const allResources = [];
      (appsData.applications || []).forEach(app => {
        if (app.learningResources) {
          const resources = typeof app.learningResources === 'string' ? JSON.parse(app.learningResources) : app.learningResources;
          if (Array.isArray(resources)) allResources.push(...resources.map(r => ({ ...r, company: app.company })));
        }
      });
      setPrepResources(allResources);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }

  const generateQuestions = async () => {
    setQuestionsLoading(true);
    setQuestionError('');
    setQuestions(null);
    try {
      const token = localStorage.getItem('careeros_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      const res = await fetch(`${BACKEND_URL}/api/generate-questions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          targetRole: profile?.targetRole || '',
          resumeText: profile?.resumeText || '',
          skills: customSkills,
          questionTypes: selectedTypes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to generate questions');
      if (data.success) setQuestions(data);
    } catch (err) {
      setQuestionError(err.message);
    } finally {
      setQuestionsLoading(false);
    }
  };

  const speakResponse = (text) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
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
          currentJdText: selectedApp?.rawJd || selectedApp?.jdText || ''
        })
      });
      const data = await res.json();
      if (data.success) {
        const reply = { role: 'assistant', content: data.reply };
        setInterviewMessages(prev => [...prev, reply]);
        speakResponse(data.reply);
      }
    } catch (err) {
      console.error('Interview chat error:', err);
      setInterviewMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setInterviewLoading(false);
    }
  };
  sendInterviewMessageRef.current = sendInterviewMessage;

  const toggleListening = () => {
    if (recognition) {
      if (isListening) { recognition.stop(); }
      else {
        setFinalTranscript(''); setInterimTranscript('');
        recognition.start();
      }
    } else {
      setInterviewMessages(prev => [...prev, { role: 'assistant', content: 'Voice recognition is not supported in this browser. Please type your responses.' }]);
    }
  };

  const startInterview = () => {
    if (!selectedJdId) return;
    setInterviewMessages([]);
    setInterviewResult(null);
    setAnalyticsTab('overview');
    setTimeout(() => sendInterviewMessage('Hello, I am ready for the interview.'), 500);
  };

  const endInterview = async () => {
    setIsEvaluating(true);
    try {
      const token = localStorage.getItem('careeros_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      const selectedApp = applications.find(a => a.id === selectedJdId);
      const res = await fetch(`${BACKEND_URL}/api/evaluate-interview`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          chatHistory: interviewMessages,
          currentJdText: selectedApp?.rawJd || selectedApp?.jdText || ''
        })
      });
      const data = await res.json();
      if (data.success) setInterviewResult(data.evaluation);
    } catch (err) {
      console.error('Evaluation error:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const selectedApp = applications.find(a => a.id === selectedJdId);

  const renderInterviewTab = () => (
    <div className="space-y-6">
      {!selectedJdId ? (
        <div className="card-static p-10 text-center">
          <span className="material-symbols-outlined text-5xl text-muted mb-4">mic</span>
          <h3 className="text-lg font-bold text-on-surface mb-2">Select a Job to Practice</h3>
          <p className="text-sm text-on-surface-variant mb-6 max-w-md mx-auto">
            Choose a job from your analyzed applications to start a mock interview with the AI Recruiter Simulator.
          </p>
          <button onClick={() => setActiveTab('jobs')} className="px-5 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold btn-hover shadow-md shadow-primary/20">
            Browse Jobs
          </button>
        </div>
      ) : interviewResult ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-on-surface">Interview Results</h2>
              <p className="text-sm text-on-surface-variant mt-0.5">{selectedApp?.company} — {selectedApp?.role}</p>
            </div>
            <button onClick={() => { setSelectedJdId(null); setInterviewMessages([]); setInterviewResult(null); }}
              className="px-4 py-2 bg-surface-container-highest border border-outline-variant/30 rounded-lg text-sm font-semibold text-on-surface btn-hover">
              Start New
            </button>
          </div>

          <div className="flex gap-2 mb-2">
            {['overview', 'transcript'].map(tab => (
              <button key={tab} onClick={() => setAnalyticsTab(tab)}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  analyticsTab === tab ? 'bg-primary text-on-primary shadow-md shadow-primary/20' : 'text-muted hover:text-on-surface bg-surface-container border border-outline-variant/20'
                }`}>
                {tab === 'overview' ? 'Overview' : 'Transcript'}
              </button>
            ))}
          </div>

          {analyticsTab === 'transcript' ? (
            <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
              {interviewMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] p-3.5 rounded-xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary/15 border border-primary/20 text-on-surface rounded-br-md'
                      : 'bg-surface-container border border-outline-variant/20 text-on-surface rounded-bl-md'
                  }`}>
                    <p className="font-semibold text-[10px] text-muted uppercase tracking-wider mb-1">{msg.role === 'user' ? 'You' : 'Recruiter'}</p>
                    <p className="leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              <div ref={interviewEndRef} />
            </div>
          ) : (
            <div className="card-static p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Overall Score', value: interviewResult.overallScore, unit: '/100', color: interviewResult.overallScore >= 70 ? 'text-success' : interviewResult.overallScore >= 40 ? 'text-warning' : 'text-error' },
                  { label: 'Confidence', value: interviewResult.confidenceScore, unit: '/100', color: interviewResult.confidenceScore >= 70 ? 'text-success' : interviewResult.confidenceScore >= 40 ? 'text-warning' : 'text-error' },
                  { label: 'Filler Words', value: interviewResult.fillerWords?.count ?? 0, unit: '', color: (interviewResult.fillerWords?.count ?? 0) <= 3 ? 'text-success' : (interviewResult.fillerWords?.count ?? 0) <= 8 ? 'text-warning' : 'text-error' },
                  { label: 'QA Items', value: interviewResult.qaReview?.length ?? 0, unit: '', color: 'text-primary' },
                ].map(stat => (
                  <div key={stat.label} className="text-center p-4 rounded-xl bg-surface-container border border-outline-variant/20">
                    <p className={`text-3xl font-extrabold ${stat.color}`}>{stat.value}<span className="text-sm font-semibold text-muted">{stat.unit}</span></p>
                    <p className="text-xs text-muted font-semibold mt-1.5 uppercase tracking-wide">{stat.label}</p>
                  </div>
                ))}
              </div>

              {interviewResult.toneAnalysis && (
                <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/20">
                  <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5">Tone Analysis</p>
                  <p className="text-sm text-on-surface leading-relaxed">{interviewResult.toneAnalysis}</p>
                </div>
              )}
              {interviewResult.technicalAccuracy && (
                <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/20">
                  <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5">Technical Accuracy</p>
                  <p className="text-sm text-on-surface leading-relaxed">{interviewResult.technicalAccuracy}</p>
                </div>
              )}

              {interviewResult.recommendations?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Recommendations</p>
                  <div className="space-y-2">
                    {interviewResult.recommendations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-container border border-outline-variant/20">
                        <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 text-xs font-bold text-primary">{i + 1}</span>
                        <p className="text-sm text-on-surface leading-relaxed">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {interviewResult.qaReview?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Q&A Review</p>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {interviewResult.qaReview.map((qa, i) => (
                      <div key={i} className="p-4 rounded-xl bg-surface-container border border-outline-variant/20 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-on-surface flex-1"><span className="text-primary">Q:</span> {qa.question}</p>
                          <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold border ${
                            qa.score >= 70 ? 'bg-success/10 text-success border-success/20' : qa.score >= 40 ? 'bg-warning/10 text-warning border-warning/20' : 'bg-error/10 text-error border-error/20'
                          }`}>{qa.score}/100</span>
                        </div>
                        <p className="text-sm text-on-surface-variant"><span className="text-secondary">A:</span> {qa.answer}</p>
                        {qa.feedback && <p className="text-xs text-muted border-t border-outline-variant/20 pt-2">{qa.feedback}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-on-surface">{selectedApp?.company || 'Interview Practice'}</h2>
              <p className="text-sm text-on-surface-variant mt-0.5">{selectedApp?.role}</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={toggleListening}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  isListening ? 'bg-error/15 text-error border border-error/30 shadow-lg shadow-error/10' : 'bg-surface-container-highest hover:bg-surface-container border border-outline-variant/30 text-on-surface'
                }`}>
                <span className="material-symbols-outlined text-lg">{isListening ? 'mic' : 'mic_none'}</span>
                {isListening ? 'Recording...' : 'Voice Input'}
              </button>
              {interviewMessages.length > 1 && !isEvaluating && (
                <button onClick={endInterview}
                  className="px-5 py-2.5 bg-gradient-to-r from-primary to-secondary text-on-primary rounded-lg text-xs font-bold btn-hover shadow-md shadow-primary/20">
                  End & Evaluate
                </button>
              )}
              {isEvaluating && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-container border border-outline-variant/20">
                  <div className="w-4 h-4 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                  <span className="text-xs font-semibold text-on-surface">Evaluating...</span>
                </div>
              )}
            </div>
          </div>

          {interviewMessages.length === 0 && (
            <div className="card-static p-10 text-center">
              <span className="material-symbols-outlined text-5xl text-primary mb-4">record_voice_over</span>
              <h3 className="text-lg font-bold text-on-surface mb-2">Ready to Practice?</h3>
              <p className="text-sm text-on-surface-variant mb-6 max-w-md mx-auto">
                The AI Recruiter will ask you questions based on the job description. Respond with voice or text.
              </p>
              <button onClick={startInterview}
                className="px-6 py-3 bg-gradient-to-r from-primary to-secondary text-on-primary rounded-xl text-sm font-bold btn-hover shadow-lg shadow-primary/20">
                Start Interview
              </button>
            </div>
          )}

          <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
            {interviewMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] p-3.5 rounded-xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary/15 border border-primary/20 text-on-surface rounded-br-md'
                    : 'bg-surface-container border border-outline-variant/20 text-on-surface rounded-bl-md'
                }`}>
                  <p className="font-semibold text-[10px] text-muted uppercase tracking-wider mb-1">{msg.role === 'user' ? 'You' : 'Recruiter'}</p>
                  <p className="leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}
            {interviewLoading && (
              <div className="flex justify-start">
                <div className="bg-surface-container border border-outline-variant/20 p-3.5 rounded-xl rounded-bl-md">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={interviewEndRef} />
          </div>

          {(finalTranscript || interimTranscript) && (
            <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/15 border-dashed">
              <p className="text-xs font-semibold text-muted mb-1 uppercase tracking-wider">Transcript</p>
              <p className="text-sm text-on-surface">{finalTranscript}<span className="text-muted">{interimTranscript}</span></p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderPrepTab = () => (
    <div className="space-y-6">
      {prepResources.length === 0 ? (
        <div className="card-static p-10 text-center">
          <span className="material-symbols-outlined text-5xl text-muted mb-4">school</span>
          <h3 className="text-lg font-bold text-on-surface mb-2">No Prep Resources Yet</h3>
          <p className="text-sm text-on-surface-variant max-w-md mx-auto">
            Analyze job descriptions to generate curated learning resources and interview prep materials.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-on-surface">Interview Prep Resources</h2>
              <p className="text-sm text-on-surface-variant mt-0.5">{prepResources.length} resources collected</p>
            </div>
            <div className="flex items-center gap-2">
              {['All', 'YouTube', 'Course', 'Documentation', 'Practice'].map(filter => (
                <button key={filter}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-surface-container border border-outline-variant/20 text-muted hover:text-on-surface">
                  {filter}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {prepResources.map((res, i) => (
              <div key={i} className="card p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                      <span className="material-symbols-outlined text-primary text-lg">
                        {res.platform?.toLowerCase().includes('youtube') ? 'play_circle' : res.platform?.toLowerCase().includes('course') ? 'book' : 'article'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">{res.title || 'Resource'}</p>
                      <p className="text-[10px] text-muted font-semibold uppercase tracking-wider">{res.platform || 'General'}</p>
                    </div>
                  </div>
                  {res.company && (
                    <span className="shrink-0 px-2 py-0.5 rounded bg-secondary/10 text-secondary text-[10px] font-bold border border-secondary/20">{res.company}</span>
                  )}
                </div>
                {res.description && <p className="text-xs text-on-surface-variant leading-relaxed mb-3">{res.description}</p>}
                {res.link && (
                  <a href={res.link} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline">
                    Open Resource
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const renderQuestionsTab = () => (
    <div className="space-y-6">
      <div className="card-static p-6">
        <h2 className="text-xs font-extrabold text-muted uppercase tracking-widest mb-4">Question Generator</h2>
        <p className="text-sm text-on-surface-variant mb-6">
          Generate tailored interview questions based on your target role, skills, and resume. Practice with questions that match what real interviewers ask.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Target Role</label>
            <div className="p-3 rounded-lg bg-surface-container border border-outline-variant/20 text-sm text-on-surface">
              {profile?.targetRole || (
                <span className="text-muted italic">Set your target role in Profile settings</span>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Skills (optional)</label>
            <input type="text" value={customSkills} onChange={e => setCustomSkills(e.target.value)}
              placeholder="e.g. Python, React, System Design, Leadership"
              className="premium-input" />
          </div>
        </div>

        <div className="space-y-2 mb-6">
          <label className="text-xs font-bold text-muted uppercase tracking-wider">Question Types</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'technical', label: 'Technical', icon: 'code' },
              { id: 'behavioral', label: 'Behavioral', icon: 'diversity_3' },
              { id: 'situational', label: 'Situational', icon: 'psychology' },
              { id: 'experience', label: 'Experience', icon: 'work_history' },
            ].map(type => (
              <button key={type.id} onClick={() => {
                setSelectedTypes(prev => prev.includes(type.id) ? prev.filter(t => t !== type.id) : [...prev, type.id]);
              }} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all border ${
                selectedTypes.includes(type.id)
                  ? 'bg-primary/10 text-primary border-primary/25 shadow-sm'
                  : 'bg-surface-container text-muted border-outline-variant/30 hover:text-on-surface hover:border-outline-variant/60'
              }`}>
                <span className="material-symbols-outlined text-sm">{type.icon}</span>
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <button onClick={generateQuestions} disabled={questionsLoading || !profile?.targetRole}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-secondary text-on-primary rounded-xl text-sm font-bold btn-hover shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed">
          {questionsLoading ? (
            <><div className="w-4 h-4 rounded-full border-2 border-on-primary/30 border-t-on-primary animate-spin" /> Generating...</>
          ) : (
            <><span className="material-symbols-outlined text-lg">auto_awesome</span> Generate Questions</>
          )}
        </button>
        {!profile?.targetRole && (
          <p className="text-xs text-warning font-semibold mt-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">info</span>
            Set your target role in Profile to get personalized questions
          </p>
        )}
      </div>

      {questionError && (
        <div className="p-4 rounded-xl bg-error/8 border border-error/20 flex items-center gap-2.5">
          <span className="material-symbols-outlined text-error text-sm">error</span>
          <p className="text-sm text-error font-medium">{questionError}</p>
        </div>
      )}

      {questions?.questions && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-muted uppercase tracking-widest">Generated Questions ({questions.questions.length})</h2>
            <div className="flex gap-1.5">
              {['all', 'technical', 'behavioral', 'situational', 'experience'].map(filter => (
                <button key={filter}
                  className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all bg-surface-container border border-outline-variant/20 text-muted hover:text-on-surface">
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {questions.questions.map((q, i) => {
              const categoryColors = {
                technical: { bg: 'bg-secondary/8', border: 'border-secondary/25', dot: 'bg-secondary', label: 'text-secondary' },
                behavioral: { bg: 'bg-primary/8', border: 'border-primary/25', dot: 'bg-primary', label: 'text-primary' },
                situational: { bg: 'bg-warning/8', border: 'border-warning/25', dot: 'bg-warning', label: 'text-warning' },
                experience: { bg: 'bg-tertiary/8', border: 'border-tertiary/25', dot: 'bg-tertiary', label: 'text-tertiary' },
              };
              const cc = categoryColors[q.category] || categoryColors.technical;
              const difficultyColors = {
                easy: 'text-success bg-success/10 border-success/20',
                medium: 'text-warning bg-warning/10 border-warning/20',
                hard: 'text-error bg-error/10 border-error/20',
              };
              const dc = difficultyColors[q.difficulty] || difficultyColors.medium;

              return (
                <div key={i} className={`p-5 rounded-xl ${cc.bg} border ${cc.border} transition-all hover:shadow-md`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-full ${cc.dot} flex items-center justify-center shrink-0 mt-0.5 text-white text-xs font-bold`}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${cc.label} bg-white/10 border ${cc.border}`}>{q.category}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${dc}`}>{q.difficulty}</span>
                      </div>
                      <p className="text-sm text-on-surface font-medium leading-relaxed">{q.question}</p>
                      {q.keyPoints && (
                        <div className="mt-2.5 p-3 rounded-lg bg-surface-container/60 border border-outline-variant/20">
                          <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Key Points</p>
                          <p className="text-xs text-on-surface-variant leading-relaxed">{q.keyPoints}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {questions.tips && (
            <div className="card-static p-5 border-l-4 border-l-primary">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="material-symbols-outlined text-primary text-lg">lightbulb</span>
                <h3 className="text-xs font-extrabold text-muted uppercase tracking-wider">Interview Tips</h3>
              </div>
              <p className="text-sm text-on-surface leading-relaxed">{questions.tips}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="page-transition p-8 space-y-6">
        <div className="skeleton h-10 w-72" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="page-transition p-8 max-w-5xl space-y-8 relative z-10">
      <div>
        <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">
          <span className="text-gradient-primary">Mock Interview & Prep</span>
        </h1>
        <p className="text-on-surface-variant text-sm mt-1.5 font-medium">
          Practice with the AI Recruiter Simulator and review prep resources from your analyses.
        </p>
      </div>

      <div className="flex gap-2 border-b border-outline-variant/20 pb-0">
        {[
          { id: 'jobs', label: 'Select Job', icon: 'work' },
          { id: 'interview', label: 'Mock Interview', icon: 'record_voice_over' },
          { id: 'prep', label: 'Prep Resources', icon: 'school' },
          { id: 'questions', label: 'Question Generator', icon: 'help' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all border-b-2 ${
              activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-on-surface hover:border-outline-variant/30'
            }`}>
            <span className="material-symbols-outlined text-lg">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'jobs' && (
        <div className="space-y-4">
          <h2 className="text-xs font-extrabold text-muted uppercase tracking-widest">Analyzed Applications</h2>
          {applications.length === 0 ? (
            <div className="card-static p-10 text-center">
              <span className="material-symbols-outlined text-5xl text-muted mb-4">work_off</span>
              <p className="text-sm text-on-surface-variant">No analyzed applications yet. Go to Job Mission to analyze a JD first.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {applications.map(app => (
                <div key={app.id}
                  onClick={() => { setSelectedJdId(app.id); setActiveTab('interview'); }}
                  className={`card p-5 cursor-pointer transition-all ${
                    selectedJdId === app.id ? 'ring-2 ring-primary border-primary/40' : ''
                  }`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="text-base font-bold text-on-surface">{app.company || 'Unknown Company'}</h3>
                      <p className="text-xs text-on-surface-variant font-medium mt-0.5">{app.role || 'Unknown Role'}</p>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded text-[10px] font-bold border ${
                      app.signalScore?.fitScore >= 70 ? 'bg-success/10 text-success border-success/20' :
                      app.signalScore?.fitScore >= 40 ? 'bg-warning/10 text-warning border-warning/20' :
                      'bg-surface-container-highest text-muted border-outline-variant/30'
                    }`}>
                      {app.signalScore?.fitScore ?? 'N/A'}{app.signalScore?.fitScore ? '/100' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm">calendar_today</span>
                    {app.dateApplied ? new Date(app.dateApplied).toLocaleDateString() : 'No date'}
                    <span className="mx-1.5 w-1 h-1 rounded-full bg-outline-variant/50" />
                    <span className={`font-semibold ${
                      app.status === 'Offer' ? 'text-success' : app.status === 'Interview' ? 'text-primary' : 'text-muted'
                    }`}>{app.status || 'Applied'}</span>
                  </div>
                  {app.learningResources && (
                    <p className="text-[10px] text-primary font-semibold mt-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">school</span>
                      Prep resources available
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'interview' && renderInterviewTab()}
      {activeTab === 'prep' && renderPrepTab()}
      {activeTab === 'questions' && renderQuestionsTab()}
    </div>
  );
}
