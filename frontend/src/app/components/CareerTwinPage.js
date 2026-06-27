'use client';
import { useState, useEffect, useRef } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function CareerTwinPage() {
  const [applications, setApplications] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('skills');

  useEffect(() => {
    loadData();
  }, []);

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
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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


    </div>
  );
}
