'use client';
import { useState, useEffect } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

const STATUSES = ['Applied', 'Under Review', 'Interview', 'Offer', 'Rejected'];
const STATUS_CONFIG = {
  'Applied':      { icon: 'send',              color: 'text-secondary',   bg: 'bg-secondary/10', border: 'border-secondary/20' },
  'Under Review': { icon: 'visibility',        color: 'text-warning',     bg: 'bg-warning/10',   border: 'border-warning/20' },
  'Interview':    { icon: 'mic',               color: 'text-primary',     bg: 'bg-primary/10',   border: 'border-primary/20' },
  'Offer':        { icon: 'workspace_premium',  color: 'text-success',     bg: 'bg-success/10',   border: 'border-success/20' },
  'Rejected':     { icon: 'block',             color: 'text-error',       bg: 'bg-error/10',     border: 'border-error/20' },
};

export default function PipelinePage() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('kanban'); // kanban | analytics | timeline
  const [draggedApp, setDraggedApp] = useState(null);
  const [expandedApp, setExpandedApp] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    loadApplications();
  }, []);

  async function loadApplications() {
    try {
      const token = localStorage.getItem('careeros_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`${BACKEND_URL}/api/analyze`, { headers });
      const data = await res.json();
      if (data.success) {
        setApplications(data.applications || []);
      }
    } catch (err) {
      console.error('Pipeline load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(appId, newStatus) {
    try {
      const token = localStorage.getItem('careeros_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      const res = await fetch(`${BACKEND_URL}/api/applications`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ id: appId, updates: { status: newStatus } })
      });
      const data = await res.json();
      if (data.success) {
        setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
      }
    } catch (err) {
      console.error('Status update error:', err);
    }
  }

  async function deleteApp(appId) {
    setDeletingId(appId);
    try {
      const token = localStorage.getItem('careeros_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`${BACKEND_URL}/api/applications?id=${appId}`, {
        method: 'DELETE',
        headers
      });
      const data = await res.json();
      if (data.success) {
        setApplications(prev => prev.filter(a => a.id !== appId));
        if (expandedApp === appId) setExpandedApp(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeletingId(null);
    }
  }

  // Drag handlers
  const handleDragStart = (e, app) => {
    setDraggedApp(app);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetStatus) => {
    e.preventDefault();
    if (draggedApp && draggedApp.status !== targetStatus) {
      updateStatus(draggedApp.id, targetStatus);
    }
    setDraggedApp(null);
  };

  // Compute stats
  const totalApps = applications.length;
  const statusCounts = STATUSES.reduce((acc, s) => {
    acc[s] = applications.filter(a => a.status === s).length;
    return acc;
  }, {});

  // Ghost detection
  const getGhostApps = () => {
    return applications.filter(a => {
      if (!['Applied', 'Under Review'].includes(a.status)) return false;
      const applied = new Date(a.dateApplied);
      const diffDays = Math.floor((Date.now() - applied.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 14;
    }).map(a => {
      const diffDays = Math.floor((Date.now() - new Date(a.dateApplied).getTime()) / (1000 * 60 * 60 * 24));
      return { ...a, staleDays: diffDays };
    });
  };

  // Interview pending > 5 days
  const getPendingInterviews = () => {
    return applications.filter(a => {
      if (a.status !== 'Interview') return false;
      const applied = new Date(a.dateApplied);
      const diffDays = Math.floor((Date.now() - applied.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 5;
    }).map(a => {
      const diffDays = Math.floor((Date.now() - new Date(a.dateApplied).getTime()) / (1000 * 60 * 60 * 24));
      return { ...a, pendingDays: diffDays };
    });
  };

  const ghostApps = getGhostApps();
  const pendingInterviews = getPendingInterviews();

  // Day diff helper
  const daysSince = (dateStr) => {
    if (!dateStr) return 0;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="page-transition p-8 space-y-6">
        <div className="skeleton h-10 w-72" />
        <div className="flex gap-2 mb-4">
          {[1,2,3].map(i => <div key={i} className="skeleton h-10 w-28 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="space-y-3">
              <div className="skeleton h-8 w-full rounded-lg" />
              <div className="skeleton h-24 w-full rounded-xl" />
              <div className="skeleton h-24 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-transition p-8 space-y-6 relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">Pipeline & Analytics</h1>
          <p className="text-on-surface-variant text-sm mt-1.5 font-medium">
            {totalApps === 0
              ? 'No applications tracked yet. Start by optimizing a JD in Job Mission.'
              : `Tracking ${totalApps} active application${totalApps !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-1.5 bg-surface-container-low/60 border border-outline-variant/30 rounded-xl p-1.5 self-start max-w-sm">
        {[
          { id: 'kanban', label: 'Kanban Board', icon: 'view_kanban' },
          { id: 'analytics', label: 'Analytics', icon: 'analytics' },
          { id: 'timeline', label: 'Timeline', icon: 'timeline' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
              activeView === tab.id
                ? 'bg-primary/10 text-primary'
                : 'text-on-surface-variant hover:bg-surface-container-high/40 hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ghost Detector Alerts */}
      {(ghostApps.length > 0 || pendingInterviews.length > 0) && (
        <div className="space-y-3">
          {ghostApps.map(app => (
            <div key={`ghost_${app.id}`} className="card-static p-4.5 flex items-center gap-4 border-l-4 border-l-warning border-y-outline-variant/20 border-r-outline-variant/20 bg-warning/5 shadow-md shadow-warning/1">
              <span className="material-symbols-outlined text-warning text-xl shrink-0">schedule</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-on-surface">
                  ⚠ <strong>{app.company}</strong> — applied {app.staleDays} days ago with no update
                </p>
                <p className="text-xs text-on-surface-variant mt-0.5 truncate font-medium">
                  This application may be inactive. We recommend sending a follow-up pitch.
                </p>
              </div>
              <button
                onClick={() => setExpandedApp(expandedApp === app.id ? null : app.id)}
                className="px-3.5 py-1.5 bg-surface-container-highest hover:bg-surface-container-high border border-outline-variant/30 rounded-lg text-xs font-bold text-on-surface btn-hover shrink-0"
              >
                Details
              </button>
            </div>
          ))}
          {pendingInterviews.map(app => (
            <div key={`pending_${app.id}`} className="card-static p-4.5 flex items-center gap-4 border-l-4 border-l-primary border-y-outline-variant/20 border-r-outline-variant/20 bg-primary/5 shadow-md shadow-primary/1">
              <span className="material-symbols-outlined text-primary text-xl shrink-0">mic</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-on-surface">
                  📋 <strong>{app.company}</strong> interview — {app.pendingDays} days since status change
                </p>
                <p className="text-xs text-on-surface-variant mt-0.5 truncate font-medium">
                  We suggest sending a check-in message to the recruiter to keep the conversation warm.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {totalApps === 0 && (
        <div className="card-static p-16 flex flex-col items-center gap-4 text-center max-w-xl mx-auto mt-8 border-dashed">
          <div className="w-14 h-14 rounded-2xl bg-surface-container-high border border-outline-variant/30 flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined text-muted text-4xl">view_kanban</span>
          </div>
          <h2 className="text-lg font-bold text-on-surface mt-2">No applications tracked yet</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed max-w-sm font-medium">
            Analyze a Job Description in the Job Mission page and click "Add to Pipeline" to start tracking your applications here.
          </p>
        </div>
      )}

      {/* KANBAN VIEW */}
      {activeView === 'kanban' && totalApps > 0 && (
        <div className="flex flex-col gap-6 w-full">
          {STATUSES.map(status => {
            const config = STATUS_CONFIG[status];
            const appsInCol = applications.filter(a => a.status === status);
            return (
              <div
                key={status}
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, status)}
                className="flex flex-col bg-transparent border border-white/5 rounded-2xl p-5"
              >
                {/* Column Header */}
                <div className={`flex items-center justify-between pb-2 mb-3.5 border-b border-outline-variant/20`}>
                  <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined text-[15px] font-bold ${config.color}`}>{config.icon}</span>
                    <span className={`text-xs font-bold text-on-surface`}>{status}</span>
                  </div>
                  <span className="text-[10px] font-extrabold text-muted bg-surface-container-highest rounded-full px-2 py-0.5 border border-white/5">
                    {appsInCol.length}
                  </span>
                </div>

                {/* Row Cards */}
                <div className="flex flex-col gap-3 min-h-[60px]">
                  {appsInCol.map(app => (
                    <div
                      key={app.id}
                      draggable
                      onDragStart={e => handleDragStart(e, app)}
                      onClick={() => setExpandedApp(expandedApp === app.id ? null : app.id)}
                      className={`group card-static rounded-xl p-4 cursor-grab active:cursor-grabbing transition-all duration-200 hover:border-primary/30 ${
                        expandedApp === app.id ? 'ring-1 ring-primary/40 bg-surface-container-high/60 shadow-lg' : 'hover:bg-surface-container-high/20 shadow-md shadow-black/10'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <span className="material-symbols-outlined text-muted text-[20px] cursor-grab select-none opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">drag_indicator</span>
                          <img
                            src={`https://logo.clearbit.com/${app.company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`}
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                            className="w-10 h-10 rounded-full object-cover shrink-0 bg-surface-container-high shadow-sm"
                            alt=""
                          />
                          <div className="hidden w-10 h-10 rounded-full bg-surface-container-high text-on-surface-variant font-bold text-[14px] items-center justify-center shrink-0 uppercase shadow-sm">
                            {app.company.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6">
                            <p className="text-base font-bold text-on-surface truncate sm:w-48">{app.company}</p>
                            <p className="text-sm text-on-surface-variant font-medium truncate flex-1">{app.role}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 shrink-0 mt-2 sm:mt-0 ml-14 sm:ml-0">
                          <div className="flex items-center gap-1.5 text-muted w-24">
                            <span className="material-symbols-outlined text-[16px]">schedule</span>
                            <span className="text-xs font-semibold">{daysSince(app.dateApplied) === 0 ? 'Today' : `${daysSince(app.dateApplied)}d ago`}</span>
                          </div>
                          
                          {app.matchScore && (
                            <div className="flex items-center gap-3 w-40">
                              <span className={`text-xs font-extrabold w-10 text-right ${app.matchScore >= 70 ? 'text-success' : app.matchScore >= 40 ? 'text-warning' : 'text-error'}`}>
                                {app.matchScore}%
                              </span>
                              <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{
                                    width: `${app.matchScore}%`,
                                    background: app.matchScore >= 70 ? '#10B981' : app.matchScore >= 40 ? '#F59E0B' : '#F43F5E'
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          <span className="material-symbols-outlined text-muted text-[20px] cursor-grab select-none sm:hidden">drag_indicator</span>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {expandedApp === app.id && (
                        <div className="mt-4 pt-3.5 border-t border-outline-variant/20 space-y-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-muted uppercase tracking-wider">
                            <span>Applied:</span>
                            <span className="text-on-surface font-semibold">{formatDate(app.dateApplied)}</span>
                          </div>
                          {app.flag && (
                            <div className="flex items-start gap-1.5 p-2 rounded bg-surface-container-highest border border-outline-variant/30">
                              <span className={`material-symbols-outlined text-[13px] font-bold shrink-0 mt-0.5 ${
                                app.flag === 'Red' ? 'text-error' : app.flag === 'Yellow' ? 'text-warning' : 'text-success'
                              }`}>
                                {app.flag === 'Red' ? 'flag' : app.flag === 'Yellow' ? 'warning' : 'verified'}
                              </span>
                              <p className="text-[10px] text-on-surface-variant font-medium leading-relaxed">{app.flagReason}</p>
                            </div>
                          )}
                          {/* Move to status */}
                          <div className="space-y-1.5">
                            <p className="text-[9px] text-muted font-extrabold uppercase tracking-widest">Move status</p>
                            <div className="flex flex-wrap gap-1">
                              {STATUSES.filter(s => s !== app.status).map(s => (
                                <button
                                  key={s}
                                  onClick={() => updateStatus(app.id, s)}
                                  className={`text-[9px] font-bold px-2 py-1 rounded border ${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].color} ${STATUS_CONFIG[s].border} hover:opacity-80 btn-hover`}
                                >
                                  → {s}
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* Delete */}
                          <div className="pt-1.5 flex justify-end">
                            <button
                              onClick={() => deleteApp(app.id)}
                              disabled={deletingId === app.id}
                              className="text-[10px] text-error/75 hover:text-error transition-colors flex items-center gap-1 font-bold uppercase tracking-wider"
                            >
                              <span className="material-symbols-outlined text-[12px] font-bold">delete</span>
                              {deletingId === app.id ? 'Removing...' : 'Remove'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {appsInCol.length === 0 && (
                    <div className="h-32 rounded-xl border border-dashed border-white/5 flex flex-col items-center justify-center text-center gap-1.5 opacity-60">
                      <span className="material-symbols-outlined text-white/20 text-xl">add</span>
                      <span className="text-[10px] text-white/30 font-semibold tracking-wider">No applications yet</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ANALYTICS VIEW */}
      {activeView === 'analytics' && totalApps > 0 && (
        <div className="page-transition space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Applications', value: totalApps, icon: 'description', color: 'text-on-surface', glow: 'shadow-white/2' },
              { label: 'Interviews Scheduled', value: statusCounts['Interview'] || 0, icon: 'mic', color: 'text-primary', glow: 'shadow-primary/3' },
              { label: 'Offers Received', value: statusCounts['Offer'] || 0, icon: 'workspace_premium', color: 'text-success', glow: 'shadow-success/3' },
              { label: 'Rejections', value: statusCounts['Rejected'] || 0, icon: 'block', color: 'text-error', glow: 'shadow-error/3' },
            ].map(m => (
              <div key={m.label} className={`card-static p-5 flex flex-col justify-between min-h-[110px] ${m.glow}`}>
                <div className="flex items-center justify-between">
                  <span className="text-muted text-xs font-semibold">{m.label}</span>
                  <span className="w-7 h-7 rounded-lg bg-surface-container-high border border-white/5 flex items-center justify-center">
                    <span className={`material-symbols-outlined text-[16px] ${m.color}`}>{m.icon}</span>
                  </span>
                </div>
                <p className="text-3xl font-extrabold text-on-surface tracking-tight mt-2">{m.value}</p>
              </div>
            ))}
          </div>

          {/* Calculated Rates (only if > 10 apps) */}
          {totalApps >= 10 && (
            <div className="card-static p-6 border-l-4 border-l-primary bg-primary/2">
              <h3 className="text-sm font-bold text-on-surface mb-1">Performance Indicators</h3>
              <p className="text-xs text-on-surface-variant font-medium mb-5">Statistically relevant metrics compiled from your logged applications.</p>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-muted font-bold uppercase tracking-wider">Response Rate</p>
                  <p className="text-3xl font-extrabold text-primary mt-1.5 tracking-tight">
                    {Math.round(((totalApps - (statusCounts['Applied'] || 0)) / totalApps) * 100)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted font-bold uppercase tracking-wider">Interview Conversion</p>
                  <p className="text-3xl font-extrabold text-primary mt-1.5 tracking-tight">
                    {Math.round(((statusCounts['Interview'] || 0) / totalApps) * 100)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted font-bold uppercase tracking-wider">Offer Conversion</p>
                  <p className="text-3xl font-extrabold text-success mt-1.5 tracking-tight">
                    {Math.round(((statusCounts['Offer'] || 0) / totalApps) * 100)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {totalApps < 10 && totalApps > 0 && (
            <div className="card-static p-5 border-dashed border-outline-variant/30">
              <div className="flex items-center gap-3.5">
                <span className="material-symbols-outlined text-muted text-xl">info</span>
                <div>
                  <p className="text-sm font-bold text-on-surface">Performance metrics unlock at 10 applications</p>
                  <p className="text-xs text-on-surface-variant mt-0.5 font-semibold">
                    You have {totalApps} logged — {10 - totalApps} more required to render statistical conversions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Status Distribution */}
          <div className="card-static p-6">
            <h3 className="text-sm font-bold text-on-surface mb-5">Stage Distribution</h3>
            <div className="space-y-4">
              {STATUSES.map(status => {
                const count = statusCounts[status] || 0;
                const pct = totalApps > 0 ? Math.round((count / totalApps) * 100) : 0;
                const config = STATUS_CONFIG[status];
                return (
                  <div key={status} className="flex items-center gap-4">
                    <span className={`text-xs font-bold w-24 shrink-0 ${config.color}`}>{status}</span>
                    <div className="flex-1 h-2.5 bg-surface-container-high rounded-full overflow-hidden border border-white/5 relative">
                      <div
                        className={`h-full rounded-full transition-all duration-700`}
                        style={{
                          width: `${pct}%`,
                          background: config.color.includes('secondary') ? 'linear-gradient(90deg, #818CF8, #6366F1)' :
                                       config.color.includes('warning') ? 'linear-gradient(90deg, #F59E0B, #D97706)' :
                                       config.color.includes('primary') ? 'linear-gradient(90deg, #2DD4BF, #06B6D4)' :
                                       config.color.includes('success') ? 'linear-gradient(90deg, #10B981, #059669)' : 'linear-gradient(90deg, #F43F5E, #E11D48)'
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted w-14 shrink-0 text-right font-bold">{count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Match Score Distribution */}
          <div className="card-static p-6">
            <h3 className="text-sm font-bold text-on-surface mb-5">Fit Score Distribution Overview</h3>
            <div className="grid grid-cols-3 gap-6 divide-x divide-outline-variant/20">
              {[
                { label: 'Strong Match (70+)', count: applications.filter(a => a.matchScore >= 70).length, color: 'text-success' },
                { label: 'Moderate Fit (40–69)', count: applications.filter(a => a.matchScore >= 40 && a.matchScore < 70).length, color: 'text-warning' },
                { label: 'Stretch Role (<40)', count: applications.filter(a => a.matchScore < 40).length, color: 'text-error' },
              ].map((bucket, idx) => (
                <div key={bucket.label} className={`text-center ${idx > 0 ? 'pl-4' : ''}`}>
                  <p className={`text-3xl font-extrabold tracking-tight ${bucket.color}`}>{bucket.count}</p>
                  <p className="text-[10px] text-muted font-bold uppercase tracking-wider mt-1.5">{bucket.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TIMELINE VIEW */}
      {activeView === 'timeline' && totalApps > 0 && (
        <div className="page-transition space-y-4">
          <p className="text-xs text-on-surface-variant font-semibold">Chronological history log of all application actions.</p>
          <div className="space-y-1.5 pt-3">
            {applications
              .sort((a, b) => new Date(b.dateApplied) - new Date(a.dateApplied))
              .map(app => {
                const config = STATUS_CONFIG[app.status] || STATUS_CONFIG['Applied'];
                return (
                  <div key={app.id} className="flex gap-4">
                    {/* Timeline dot + line */}
                    <div className="flex flex-col items-center pt-1.5">
                      <div className={`w-3.5 h-3.5 rounded-full border-3 ${config.border} ${config.bg} shadow-md shrink-0`} />
                      <div className="w-0.5 flex-1 bg-outline-variant/20 mt-1.5" />
                    </div>

                    {/* Content */}
                    <div className="card-static p-4.5 flex-1 mb-3.5 border-outline-variant/35 shadow-sm">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-lg bg-surface-container-high border border-white/5 flex items-center justify-center shrink-0`}>
                            <span className={`material-symbols-outlined text-[16px] ${config.color}`}>{config.icon}</span>
                          </span>
                          <div>
                            <p className="text-sm font-bold text-on-surface leading-tight">{app.company}</p>
                            <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">{app.role}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${config.bg} ${config.color} ${config.border}`}>
                            {app.status}
                          </span>
                          <p className="text-[10px] text-muted font-bold mt-1.5">{formatDate(app.dateApplied)}</p>
                        </div>
                      </div>

                      {/* Timeline events */}
                      <div className="mt-3.5 pt-3.5 border-t border-outline-variant/15 flex items-center gap-4 text-[10px] text-muted font-semibold uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[13px] font-bold">send</span>
                          Applied {formatDate(app.dateApplied)}
                        </span>
                        {app.matchScore && (
                          <span className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[13px] font-bold">analytics</span>
                            Fit Report: {app.matchScore}%
                          </span>
                        )}
                        <span className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[13px] font-bold">schedule</span>
                          {daysSince(app.dateApplied)} days ago
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
