'use client';
import { useState, useEffect } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function DashboardPage({ onNavigate }) {
  const [profile, setProfile] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const token = localStorage.getItem('careeros_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const [profileRes, appsRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/profile`, { headers }),
          fetch(`${BACKEND_URL}/api/analyze`, { headers })
        ]);
        const profileData = await profileRes.json();
        const appsData = await appsRes.json();
        if (profileData.success) setProfile(profileData.profile);
        if (appsData.success) setApplications(appsData.applications || []);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const statusCounts = {
    applied: applications.filter(a => a.status === 'Applied').length,
    review: applications.filter(a => ['Screening', 'Under Review'].includes(a.status)).length,
    interview: applications.filter(a => a.status === 'Interview').length,
    offer: applications.filter(a => a.status === 'Offer').length,
  };

  const totalApps = applications.length;
  const hasProfile = profile && profile.name && profile.resumeText;

  // Ghost detector: apps stuck > 14 days
  const staleApps = applications.filter(a => {
    if (a.status !== 'Applied') return false;
    const applied = new Date(a.dateApplied);
    const diffDays = Math.floor((Date.now() - applied.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 14;
  });

  if (loading) {
    return (
      <div className="page-transition p-8 space-y-6">
        <div className="skeleton h-10 w-72" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
        <div className="skeleton h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="page-transition p-8 max-w-5xl space-y-8 relative z-10">
      {/* Greeting */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">
            {profile?.name ? (
              <>
                Welcome back, <span className="text-gradient-primary">{profile.name.split(' ')[0]}</span>
              </>
            ) : (
              <span className="text-gradient-primary">Welcome to CareerOS!</span>
            )} 👋
          </h1>
          <p className="text-on-surface-variant text-sm mt-1.5 font-medium">
            Manage your career pipeline and AI optimizations in one command center.
          </p>
        </div>

        {profile?.targetRole && (
          <div className="self-start md:self-center">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/8 text-primary border border-primary/20 text-xs font-semibold shadow-sm">
              <span className="material-symbols-outlined text-[15px] font-bold">target</span>
              Target: {profile.targetRole}
            </span>
          </div>
        )}
      </div>

      {/* Onboarding Prompt */}
      {!hasProfile && (
        <div className="card-static p-6 border-l-4 border-l-primary border-y-outline-variant/30 border-r-outline-variant/30 bg-gradient-to-r from-primary/6 via-transparent to-transparent shadow-lg shadow-primary/2">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
              <span className="material-symbols-outlined text-primary text-xl">waving_hand</span>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-on-surface">Complete your profile to get started</h3>
              <p className="text-on-surface-variant text-sm mt-1 max-w-2xl leading-relaxed">
                Add your target role and upload your base resume. CareerOS uses this to run match reports, optimize bullet points, and draft outreach messages.
              </p>
              <button
                onClick={() => onNavigate('profile')}
                className="mt-4 px-5 py-2.5 bg-gradient-to-r from-primary to-teal-400 text-on-primary rounded-lg text-xs font-bold shadow-md shadow-primary/20 btn-hover"
              >
                Go to Profile →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline Snapshot */}
      <div>
        <div className="flex items-center justify-between mb-4.5">
          <h2 className="text-xs font-extrabold text-muted uppercase tracking-widest">Pipeline Snapshot</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Applied', count: statusCounts.applied, icon: 'send', color: 'text-secondary', hoverColor: 'hover:border-secondary/35 hover:shadow-secondary/3', iconBg: 'bg-secondary/10' },
            { label: 'Review', count: statusCounts.review, icon: 'visibility', color: 'text-warning', hoverColor: 'hover:border-warning/35 hover:shadow-warning/3', iconBg: 'bg-warning/10' },
            { label: 'Interview', count: statusCounts.interview, icon: 'mic', color: 'text-primary', hoverColor: 'hover:border-primary/35 hover:shadow-primary/3', iconBg: 'bg-primary/10' },
            { label: 'Offer', count: statusCounts.offer, icon: 'workspace_premium', color: 'text-success', hoverColor: 'hover:border-success/35 hover:shadow-success/3', iconBg: 'bg-success/10' },
          ].map(item => (
            <div
              key={item.label}
              className={`card p-5 cursor-pointer flex flex-col justify-between min-h-[110px] ${item.hoverColor}`}
              onClick={() => onNavigate('pipeline')}
            >
              <div className="flex items-center justify-between">
                <span className="text-muted text-xs font-semibold">{item.label}</span>
                <span className={`w-7 h-7 rounded-lg ${item.iconBg} flex items-center justify-center border border-white/5`}>
                  <span className={`material-symbols-outlined text-[16px] ${item.color}`}>{item.icon}</span>
                </span>
              </div>
              <p className="text-3xl font-extrabold text-on-surface mt-2 tracking-tight">{item.count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recommended Actions */}
      <div>
        <h2 className="text-xs font-extrabold text-muted uppercase tracking-widest mb-4.5">Recommended Actions</h2>
        <div className="space-y-3">
          {totalApps === 0 && !hasProfile && (
            <div className="card-static p-4.5 flex items-center gap-4 border-l-4 border-l-primary">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                <span className="material-symbols-outlined text-primary text-lg">person</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-on-surface">Set up your profile</p>
                <p className="text-xs text-on-surface-variant mt-0.5 truncate">Upload your resume to unlock AI-powered analysis</p>
              </div>
              <button
                onClick={() => onNavigate('profile')}
                className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-bold btn-hover shrink-0"
              >
                Go →
              </button>
            </div>
          )}
          {totalApps === 0 && hasProfile && (
            <div className="card-static p-4.5 flex items-center gap-4 border-l-4 border-l-primary">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                <span className="material-symbols-outlined text-primary text-lg">target</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-on-surface">Analyze your first Job Description</p>
                <p className="text-xs text-on-surface-variant mt-0.5 truncate">Paste a JD to get AI-powered match analysis and resume optimization</p>
              </div>
              <button
                onClick={() => onNavigate('mission')}
                className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-bold btn-hover shrink-0"
              >
                Start →
              </button>
            </div>
          )}
          {staleApps.map(app => (
            <div key={app.id} className="card-static p-4.5 flex items-center gap-4 border-l-4 border-l-warning">
              <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0 border border-warning/20">
                <span className="material-symbols-outlined text-warning text-lg">schedule</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-on-surface">Follow up with {app.company}</p>
                <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                  Applied {Math.floor((Date.now() - new Date(app.dateApplied).getTime()) / (1000*60*60*24))} days ago — no status changes
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="px-2 py-1 rounded bg-warning/10 text-warning text-[10px] font-bold border border-warning/20 uppercase tracking-wider">Stale</span>
                <button
                  onClick={() => onNavigate('pipeline')}
                  className="px-3.5 py-1.5 bg-surface-container-highest hover:bg-surface-container-high border border-outline-variant/30 rounded-lg text-xs font-semibold text-on-surface btn-hover"
                >
                  View
                </button>
              </div>
            </div>
          ))}
          {totalApps > 0 && staleApps.length === 0 && (
            <div className="card-static p-4.5 flex items-center gap-4 border-l-4 border-l-success">
              <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0 border border-success/20">
                <span className="material-symbols-outlined text-success text-lg">check_circle</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-on-surface">All caught up!</p>
                <p className="text-xs text-on-surface-variant mt-0.5 truncate font-medium">No stale applications. Keep up the high application momentum.</p>
              </div>
              <button
                onClick={() => onNavigate('mission')}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold shadow-md shadow-primary/10 btn-hover shrink-0"
              >
                Analyze JD
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      {totalApps > 0 && (
        <div>
          <h2 className="text-xs font-extrabold text-muted uppercase tracking-widest mb-4.5">Quick Stats</h2>
          <div className="card-static p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="flex flex-col justify-center">
                <p className="text-3xl font-extrabold text-on-surface tracking-tight">{totalApps}</p>
                <p className="text-xs text-muted font-semibold mt-1 uppercase tracking-wide">Total Applications</p>
              </div>
              {totalApps >= 10 ? (
                <>
                  <div className="hidden sm:block w-px h-12 bg-outline-variant/30 align-self-center justify-self-center" />
                  <div className="flex flex-col justify-center">
                    <p className="text-3xl font-extrabold text-primary tracking-tight">
                      {totalApps > 0 ? Math.round((statusCounts.interview / totalApps) * 100) : 0}%
                    </p>
                    <p className="text-xs text-muted font-semibold mt-1 uppercase tracking-wide">Interview Rate</p>
                  </div>
                  <div className="hidden sm:block w-px h-12 bg-outline-variant/30 align-self-center justify-self-center" />
                  <div className="flex flex-col justify-center">
                    <p className="text-3xl font-extrabold text-success tracking-tight">
                      {totalApps > 0 ? Math.round((statusCounts.offer / totalApps) * 100) : 0}%
                    </p>
                    <p className="text-xs text-muted font-semibold mt-1 uppercase tracking-wide">Offer Rate</p>
                  </div>
                </>
              ) : (
                <div className="col-span-2 flex items-center p-3 rounded-lg bg-surface-container border border-outline-variant/20">
                  <span className="material-symbols-outlined text-muted text-sm shrink-0 mr-2.5">info</span>
                  <span className="text-xs text-on-surface-variant leading-relaxed">
                    Response rates and analytical insights will unlock automatically once you log 10+ active applications in your pipeline. Currently logged: {totalApps}/10.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
