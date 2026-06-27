'use client';
import { useState, useEffect } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const GOALS_STORAGE_KEY = 'careeros_goals';

const defaultGoals = {
  weeklyApplications: 5,
  weeklyInterviews: 2,
  monthlyOffers: 1,
  skillsToLearn: 3,
};

export default function GoalTrackerPage({ onNavigate }) {
  const [applications, setApplications] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState(defaultGoals);
  const [editingGoal, setEditingGoal] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [activeWeekOffset, setActiveWeekOffset] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem(GOALS_STORAGE_KEY);
    if (saved) {
      try { setGoals(JSON.parse(saved)); }
      catch { localStorage.removeItem(GOALS_STORAGE_KEY); }
    }
    loadData();
  }, []);

  useEffect(() => {
    localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
  }, [goals]);

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
      console.error('Goal tracker load error:', err);
    } finally {
      setLoading(false);
    }
  }

  const getWeekRange = (offset) => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday + offset * 7);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
  };

  const getWeekLabel = (offset) => {
    const { start, end } = getWeekRange(offset);
    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (offset === 0) return `This Week (${fmt(start)} - ${fmt(end)})`;
    if (offset === -1) return `Last Week (${fmt(start)} - ${fmt(end)})`;
    return `${fmt(start)} - ${fmt(end)}`;
  };

  const getThisWeekApps = () => {
    const { start, end } = getWeekRange(activeWeekOffset);
    return applications.filter(a => {
      const d = new Date(a.dateApplied);
      return d >= start && d <= end;
    });
  };

  const getThisWeekInterviews = () => {
    const { start, end } = getWeekRange(activeWeekOffset);
    return applications.filter(a => {
      const d = new Date(a.dateApplied);
      return d >= start && d <= end && a.status === 'Interview';
    });
  };

  const getTotalOffers = () => applications.filter(a => a.status === 'Offer').length;

  const weekApps = getThisWeekApps();
  const weekInterviews = getThisWeekInterviews();
  const totalOffers = getTotalOffers();
  const streak = calculateStreak();

  function calculateStreak() {
    let count = 0;
    const sorted = [...applications].sort((a, b) => new Date(b.dateApplied) - new Date(a.dateApplied));
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const dayStr = day.toDateString();
      const hasApp = sorted.some(a => new Date(a.dateApplied).toDateString() === dayStr);
      if (hasApp) count++;
      else if (i > 0) break;
    }
    return count;
  }

  const goalItems = [
    { key: 'weeklyApplications', label: 'Weekly Applications', icon: 'send', current: weekApps.length, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
    { key: 'weeklyInterviews', label: 'Weekly Interviews', icon: 'mic', current: weekInterviews.length, color: 'text-secondary', bg: 'bg-secondary/10', border: 'border-secondary/20' },
    { key: 'monthlyOffers', label: 'Total Offers', icon: 'workspace_premium', current: totalOffers, color: 'text-success', bg: 'bg-success/10', border: 'border-success/20' },
    { key: 'skillsToLearn', label: 'Skills Target', icon: 'psychology', current: 0, color: 'text-tertiary', bg: 'bg-tertiary/10', border: 'border-tertiary/20' },
  ];

  const startEdit = (key) => {
    setEditingGoal(key);
    setEditValue(String(goals[key]));
  };

  const saveEdit = () => {
    if (editingGoal && editValue) {
      const val = parseInt(editValue, 10);
      if (!isNaN(val) && val >= 0) {
        setGoals(prev => ({ ...prev, [editingGoal]: val }));
      }
    }
    setEditingGoal(null);
    setEditValue('');
  };

  const progressColor = (current, target) => {
    const pct = target > 0 ? (current / target) * 100 : 0;
    if (pct >= 100) return { bar: 'bg-success', text: 'text-success', emoji: '🎯' };
    if (pct >= 50) return { bar: 'bg-primary', text: 'text-primary', emoji: '✅' };
    if (pct > 0) return { bar: 'bg-warning', text: 'text-warning', emoji: '📝' };
    return { bar: 'bg-surface-container-highest', text: 'text-muted', emoji: '⏳' };
  };

  const weeklyAppData = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const { start } = getWeekRange(activeWeekOffset);
    return days.map((day, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dayStr = d.toDateString();
      const count = applications.filter(a => new Date(a.dateApplied).toDateString() === dayStr).length;
      return { label: day, count, max: Math.max(1, ...weekApps.length > 0 ? [Math.max(...days.map((_, j) => {
        const dd = new Date(start);
        dd.setDate(start.getDate() + j);
        return applications.filter(a => new Date(a.dateApplied).toDateString() === dd.toDateString()).length;
      }))] : [1]) };
    });
  };

  if (loading) {
    return (
      <div className="page-transition p-8 space-y-6">
        <div className="skeleton h-10 w-72" />
        <div className="grid grid-cols-2 gap-4">{[1,2,3,4].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}</div>
        <div className="skeleton h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="page-transition p-8 max-w-5xl space-y-8 relative z-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">
            <span className="text-gradient-secondary">Goal Tracker</span>
          </h1>
          <p className="text-on-surface-variant text-sm mt-1.5 font-medium">
            Set weekly targets and track your career progress.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3.5 py-1.5 rounded-full bg-primary/8 text-primary border border-primary/20 text-xs font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">local_fire_department</span>
            {streak} day streak
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {goalItems.map(item => {
          const pct = goals[item.key] > 0 ? Math.min(100, Math.round((item.current / goals[item.key]) * 100)) : 0;
          const pc = progressColor(item.current, goals[item.key]);
          return (
            <div key={item.key} className="card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center border ${item.border}`}>
                  <span className={`material-symbols-outlined text-lg ${item.color}`}>{item.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted font-semibold uppercase tracking-wider">{item.label}</p>
                </div>
              </div>
              <div className="flex items-baseline gap-1.5 mb-3">
                <span className="text-3xl font-extrabold text-on-surface tracking-tight">{item.current}</span>
                <span className="text-sm text-muted font-semibold">/ {editingGoal === item.key ? (
                  <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)}
                    onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()}
                    className="w-12 px-1 py-0 bg-surface-container-highest border border-outline-variant/40 rounded text-sm text-on-surface text-center font-bold outline-none"
                    autoFocus />
                ) : (
                  <button onClick={() => startEdit(item.key)} className="hover:text-primary transition-colors cursor-pointer">
                    {goals[item.key]}
                  </button>
                )}</span>
                <span className="text-xs text-muted ml-auto font-bold">{pct}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-surface-container-highest/50 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${pc.bar}`} style={{ width: `${pct}%` }} />
              </div>
              {pct >= 100 && <p className="text-xs text-success font-semibold mt-2">Target completed! 🎉</p>}
            </div>
          );
        })}
      </div>

      <div className="card-static p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs font-extrabold text-muted uppercase tracking-widest">Weekly Activity</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveWeekOffset(activeWeekOffset - 1)}
              className="p-1.5 rounded-lg hover:bg-surface-container border border-outline-variant/20 text-on-surface-variant hover:text-on-surface transition-all">
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            <span className="text-xs font-semibold text-on-surface min-w-[180px] text-center">{getWeekLabel(activeWeekOffset)}</span>
            <button onClick={() => setActiveWeekOffset(Math.min(0, activeWeekOffset + 1))}
              className="p-1.5 rounded-lg hover:bg-surface-container border border-outline-variant/20 text-on-surface-variant hover:text-on-surface transition-all">
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
        <div className="flex items-end justify-between gap-2 h-32">
          {weeklyAppData().map(day => {
            const maxVal = weeklyAppData().reduce((max, d) => Math.max(max, d.count), 1);
            const height = maxVal > 0 ? (day.count / maxVal) * 100 : 0;
            return (
              <div key={day.label} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-bold text-on-surface-variant">{day.count}</span>
                <div className="w-full rounded-md bg-surface-container-highest/30 relative overflow-hidden" style={{ height: '80px' }}>
                  <div className="absolute bottom-0 w-full rounded-md bg-gradient-to-t from-primary to-secondary transition-all duration-500"
                    style={{ height: `${height}%` }} />
                </div>
                <span className="text-[9px] font-semibold text-muted uppercase">{day.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-static p-6">
          <h2 className="text-xs font-extrabold text-muted uppercase tracking-widest mb-4">Application Breakdown</h2>
          <div className="space-y-3">
            {[
              { label: 'Total Applied', count: applications.length, color: 'text-secondary' },
              { label: 'In Review', count: applications.filter(a => ['Screening', 'Under Review'].includes(a.status)).length, color: 'text-warning' },
              { label: 'Interviews', count: applications.filter(a => a.status === 'Interview').length, color: 'text-primary' },
              { label: 'Offers', count: totalOffers, color: 'text-success' },
              { label: 'Rejected', count: applications.filter(a => a.status === 'Rejected').length, color: 'text-error' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-on-surface-variant">{item.label}</span>
                <span className={`text-sm font-extrabold ${item.color}`}>{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-static p-6">
          <h2 className="text-xs font-extrabold text-muted uppercase tracking-widest mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-container border border-outline-variant/20">
              <span className="material-symbols-outlined text-primary text-lg">target</span>
              <p className="text-sm text-on-surface flex-1">Analyze a new job description</p>
              <button onClick={() => onNavigate?.('mission')}
                className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-bold btn-hover">
                Go
              </button>
            </div>
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-container border border-outline-variant/20">
              <span className="material-symbols-outlined text-secondary text-lg">record_voice_over</span>
              <p className="text-sm text-on-surface flex-1">Practice with mock interview</p>
              <button onClick={() => onNavigate?.('interview')}
                className="px-3 py-1.5 bg-secondary/10 text-secondary border border-secondary/20 rounded-lg text-xs font-bold btn-hover">
                Go
              </button>
            </div>
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-container border border-outline-variant/20">
              <span className="material-symbols-outlined text-success text-lg">settings</span>
              <p className="text-sm text-on-surface flex-1">Update your profile and resume</p>
              <button onClick={() => onNavigate?.('profile')}
                className="px-3 py-1.5 bg-success/10 text-success border border-success/20 rounded-lg text-xs font-bold btn-hover">
                Go
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
