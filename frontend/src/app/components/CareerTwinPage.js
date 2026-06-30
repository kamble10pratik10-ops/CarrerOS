'use client';
import { useState, useEffect } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function CareerTwinPage() {
  const [profile, setProfile] = useState(null);
  const [twinData, setTwinData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const token = localStorage.getItem('careeros_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      
      const profileRes = await fetch(`${BACKEND_URL}/api/profile`, { headers });
      const profileData = await profileRes.json();
      
      if (profileData.success) {
        setProfile(profileData.profile);
      }

      // Check for cached twin data
      const cachedTwin = localStorage.getItem('careeros_twin_data');
      if (cachedTwin) {
        setTwinData(JSON.parse(cachedTwin));
      }
    } catch (err) {
      console.error('Career Twin load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateTwin() {
    if (!profile) return;
    setIsGenerating(true);
    try {
      const token = localStorage.getItem('careeros_token');
      const headers = { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const payload = {
        resumeText: profile.resumeText || '',
        targetRole: profile.targetRole || '',
        skills: profile.goals || '', // mapped from goals for now
        projects: profile.projects || '',
        experience: '', // The AI will extract this from the resume
        education: ''
      };

      const res = await fetch(`${BACKEND_URL}/api/career-twin/analyze`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.success && data.data) {
        setTwinData(data.data);
        localStorage.setItem('careeros_twin_data', JSON.stringify(data.data));
      }
    } catch (err) {
      console.error('Failed to generate career twin', err);
      alert('Failed to generate career twin. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="page-transition p-4 md:p-8 max-w-5xl space-y-6">
        <div className="skeleton h-10 w-64" />
        <div className="skeleton h-6 w-96" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="page-transition p-4 md:p-8 max-w-5xl space-y-8 relative z-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">Career Twin</h1>
          <p className="text-on-surface-variant text-sm mt-1.5 font-medium max-w-2xl">
            A comprehensive, brutally honest analysis of your current market readiness and a personalized roadmap to land your target role.
          </p>
        </div>
        
        <button
          onClick={handleGenerateTwin}
          disabled={isGenerating || !profile?.resumeText}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            isGenerating || !profile?.resumeText
              ? 'bg-surface-container-high text-muted cursor-not-allowed'
              : 'bg-primary text-on-primary shadow-sm hover:shadow-md hover:scale-[1.02]'
          }`}
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">psychology</span>
              {twinData ? 'Regenerate Analysis' : 'Generate Twin Analysis'}
            </>
          )}
        </button>
      </div>

      {!profile?.resumeText && !twinData && (
        <div className="card-static p-6 border-l-4 border-l-warning bg-warning/10">
          <p className="text-sm font-bold text-on-surface">Resume Required</p>
          <p className="text-xs text-on-surface-variant mt-1">
            Please upload your resume in the Profile section before generating a Career Twin analysis.
          </p>
        </div>
      )}

      {/* Main Content (Single Page Layout) */}
      {twinData && (
        <div className="space-y-8">
          
          {/* Readiness Score & Stage Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card-static p-6 border-l-4 border-l-primary bg-primary/5 flex flex-col justify-center">
              <p className="text-sm font-bold text-muted uppercase tracking-wider mb-2">Market Readiness</p>
              <div className="flex items-end gap-3 mb-3">
                <span className={`text-5xl font-black ${
                  twinData.readinessScore >= 80 ? 'text-success' : 
                  twinData.readinessScore >= 50 ? 'text-warning' : 'text-error'
                }`}>
                  {twinData.readinessScore}%
                </span>
              </div>
              <p className="text-sm font-semibold text-on-surface leading-relaxed">
                {twinData.readinessReasoning}
              </p>
            </div>
            
            <div className="card-static p-6 border-l-4 border-l-secondary bg-secondary/5 flex flex-col justify-center">
              <p className="text-sm font-bold text-muted uppercase tracking-wider mb-2">Current Position</p>
              <h2 className="text-2xl font-extrabold text-secondary mb-3">{twinData.currentPosition}</h2>
              <p className="text-sm font-semibold text-on-surface leading-relaxed">
                {twinData.positionReasoning}
              </p>
            </div>
          </div>

          {/* Core Strengths & Critical Weaknesses */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card-static p-5 border border-success/30 bg-success/5">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-success">verified</span>
                <h3 className="text-lg font-bold text-on-surface">Core Strengths</h3>
              </div>
              <ul className="space-y-3">
                {twinData.analysis?.strengths?.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant font-medium">
                    <span className="material-symbols-outlined text-success text-[16px] mt-0.5">check_circle</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card-static p-5 border border-error/30 bg-error/5">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-error">warning</span>
                <h3 className="text-lg font-bold text-on-surface">Critical Weaknesses</h3>
              </div>
              <ul className="space-y-3">
                {twinData.analysis?.criticalWeaknesses?.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant font-medium">
                    <span className="material-symbols-outlined text-error text-[16px] mt-0.5">cancel</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Missing Skills & Resume Weaknesses */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card-static p-5 border-outline-variant/30">
              <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-4">Missing Technical Skills</h3>
              <div className="space-y-3">
                {twinData.analysis?.missingSkills?.map((skillObj, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low border border-outline-variant/20">
                    <span className="text-sm font-bold text-on-surface">{skillObj.skill}</span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      skillObj.impact?.toLowerCase() === 'high' ? 'bg-error/10 text-error' : 
                      skillObj.impact?.toLowerCase() === 'medium' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'
                    }`}>
                      {skillObj.impact} Impact
                    </span>
                  </div>
                ))}
                {(!twinData.analysis?.missingSkills || twinData.analysis.missingSkills.length === 0) && (
                  <p className="text-sm text-muted">No critical missing skills identified.</p>
                )}
              </div>
            </div>

            <div className="card-static p-5 border-outline-variant/30">
              <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-4">Resume Weaknesses</h3>
              <ul className="space-y-3 list-disc list-inside text-sm font-medium text-on-surface-variant">
                {twinData.analysis?.resumeWeaknesses?.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Career Roadmap */}
          <div className="card-static p-6 border-l-4 border-l-secondary bg-surface">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-secondary text-2xl">route</span>
              <div>
                <h2 className="text-xl font-extrabold text-on-surface">Career Roadmap</h2>
                <p className="text-xs text-on-surface-variant mt-1">Your step-by-step path to becoming highly competitive.</p>
              </div>
            </div>

            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-outline-variant/30 before:to-transparent">
              {twinData.roadmap?.map((milestone, i) => (
                <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-surface bg-secondary text-on-primary shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 font-bold text-sm">
                    {i + 1}
                  </div>
                  
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] card-static p-5 border-outline-variant/30 transition-transform duration-200 hover:-translate-y-1">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-base font-bold text-on-surface">{milestone.title}</h3>
                      <span className="text-[10px] font-bold text-secondary bg-secondary/10 px-2 py-1 rounded-md ml-2 whitespace-nowrap">
                        +{milestone.expectedImprovement}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mb-4">{milestone.whyItMatters}</p>
                    
                    <div className="space-y-2 text-xs">
                      <div className="flex gap-2">
                        <span className="font-bold text-on-surface w-20 shrink-0">Duration:</span>
                        <span className="text-muted">{milestone.estimatedDuration}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-bold text-on-surface w-20 shrink-0">Deliverable:</span>
                        <span className="text-muted">{milestone.deliverables}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-bold text-on-surface w-20 shrink-0">Success:</span>
                        <span className="text-muted">{milestone.completionCriteria}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-4 bg-secondary/10 rounded-xl border border-secondary/20 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-on-surface">Current Stage: <span className="text-secondary">{twinData.currentStage?.stage}</span></p>
                <p className="text-xs text-on-surface-variant mt-1 max-w-lg">{twinData.currentStage?.reasoning}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-bold text-muted uppercase tracking-wider block mb-1">Confidence</span>
                <span className="text-xl font-black text-secondary">{twinData.currentStage?.confidenceScore}%</span>
              </div>
            </div>
          </div>

          {/* Learning Resources */}
          <div className="card-static p-6">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-primary text-2xl">menu_book</span>
              <h2 className="text-xl font-extrabold text-on-surface">Recommended Resources</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {twinData.learningResources?.map((res, i) => (
                <a 
                  key={i} 
                  href={res.url?.startsWith('http') ? res.url : `https://www.google.com/search?q=${encodeURIComponent(res.url)}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="group block p-4 rounded-xl border border-outline-variant/30 bg-surface-container-low hover:bg-surface-container hover:border-primary/30 transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {res.type}
                    </span>
                    <span className="material-symbols-outlined text-muted text-sm group-hover:text-primary transition-colors">open_in_new</span>
                  </div>
                  <h3 className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-2">
                    {res.title}
                  </h3>
                </a>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
