'use client';
import { useState, useEffect } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const ACTIVE_GOALS_KEY = 'careeros_active_goals';
const PAST_GOALS_KEY = 'careeros_past_goals';
const TWIN_DATA_KEY = 'careeros_twin_data';

export default function GoalTrackerPage() {
  const [activeGoals, setActiveGoals] = useState([]);
  const [pastGoals, setPastGoals] = useState([]);
  const [twinData, setTwinData] = useState(null);
  const [profile, setProfile] = useState(null);
  const [careerScore, setCareerScore] = useState(0);
  
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [isEndingGoalId, setIsEndingGoalId] = useState(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: '', category: 'Learning', durationDays: 14, dailyTarget: '' });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const active = JSON.parse(localStorage.getItem(ACTIVE_GOALS_KEY) || '[]');
    const past = JSON.parse(localStorage.getItem(PAST_GOALS_KEY) || '[]');
    const twin = JSON.parse(localStorage.getItem(TWIN_DATA_KEY) || 'null');
    
    setActiveGoals(active);
    setPastGoals(past);
    setTwinData(twin);
    
    let baseScore = twin?.readinessScore || 0;
    // Add 2 points for every completed goal (just for local score update)
    baseScore = Math.min(100, baseScore + (past.length * 2));
    setCareerScore(baseScore);

    const token = localStorage.getItem('careeros_token');
    if (token) {
      try {
        const profileRes = await fetch(`${BACKEND_URL}/api/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
        const pData = await profileRes.json();
        if (pData.success) {
          setProfile(pData.profile);
        }
      } catch (e) {
        console.error('Failed to load profile', e);
      }
    }
  }

  const saveGoals = (active, past) => {
    setActiveGoals(active);
    setPastGoals(past);
    localStorage.setItem(ACTIVE_GOALS_KEY, JSON.stringify(active));
    localStorage.setItem(PAST_GOALS_KEY, JSON.stringify(past));
  };

  const getGoalRecommendations = async () => {
    if (!profile || !twinData) {
      alert("Please generate a Career Twin analysis first!");
      return;
    }
    setIsLoadingRecommendations(true);
    try {
      const token = localStorage.getItem('careeros_token');
      const missingSkills = twinData.analysis?.missingSkills?.map(s => s.skill) || [];
      const res = await fetch(`${BACKEND_URL}/api/goals/recommend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetRole: profile.targetRole,
          skills: profile.skills || profile.goals || '',
          missingSkills: missingSkills
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setAiRecommendations(data.data.recommendations || []);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to get AI recommendations');
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  const addGoal = (goalData) => {
    const goal = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      history: {}, // { 'YYYY-MM-DD': 'Completed' | 'Missed' | 'Skipped' }
      ...goalData
    };
    saveGoals([goal, ...activeGoals], pastGoals);
    setShowCreateModal(false);
    setNewGoal({ title: '', category: 'Learning', durationDays: 14, dailyTarget: '' });
  };

  const endGoal = async (goal) => {
    setIsEndingGoalId(goal.id);
    try {
      const token = localStorage.getItem('careeros_token');
      const res = await fetch(`${BACKEND_URL}/api/goals/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          goal: {
            title: goal.title,
            category: goal.category,
            durationDays: goal.durationDays,
            dailyTarget: goal.dailyTarget
          },
          history: goal.history
        })
      });
      const data = await res.json();
      const report = data.success ? data.data : { note: "Failed to generate AI report" };
      
      const endedGoal = { ...goal, status: 'Ended', endedAt: new Date().toISOString(), report };
      
      const newActive = activeGoals.filter(g => g.id !== goal.id);
      const newPast = [endedGoal, ...pastGoals];
      saveGoals(newActive, newPast);

      // Re-trigger twin analysis in background if it was an AI recommended goal
      if (goal.isAiRecommended && profile) {
        fetch(`${BACKEND_URL}/api/career-twin/analyze`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            resumeText: profile.resumeText || '',
            targetRole: profile.targetRole || '',
            skills: profile.goals || '',
            projects: profile.projects || '',
            experience: '',
            education: '',
            completedGoals: newPast
          })
        }).then(r => r.json()).then(twinRes => {
          if (twinRes.success) {
            localStorage.setItem(TWIN_DATA_KEY, JSON.stringify(twinRes.data));
            loadData(); // refresh career score
          }
        });
      }

    } catch (e) {
      console.error(e);
      alert('Failed to end goal properly.');
    } finally {
      setIsEndingGoalId(null);
    }
  };

  const toggleDayStatus = (goalId, dateStr) => {
    const updated = activeGoals.map(g => {
      if (g.id !== goalId) return g;
      const current = g.history[dateStr];
      let nextStatus = 'Completed';
      if (current === 'Completed') nextStatus = 'Missed';
      else if (current === 'Missed') nextStatus = 'Skipped';
      else if (current === 'Skipped') nextStatus = null; // reset
      
      const newHistory = { ...g.history };
      if (nextStatus) {
        newHistory[dateStr] = nextStatus;
      } else {
        delete newHistory[dateStr];
      }
      return { ...g, history: newHistory };
    });
    saveGoals(updated, pastGoals);
  };

  const getStatusColor = (status) => {
    if (status === 'Completed') return 'bg-success';
    if (status === 'Missed') return 'bg-error';
    if (status === 'Skipped') return 'bg-warning';
    return 'bg-surface-container-high border border-outline-variant/30';
  };

  return (
    <div className="page-transition p-4 md:p-8 max-w-6xl mx-auto space-y-8 relative z-10">
      
      {/* HEADER & CAREER SCORE */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 card-static p-6 border-l-4 border-l-primary bg-primary/5">
        <div>
          <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">Daily Goal Tracker</h1>
          <p className="text-on-surface-variant text-sm mt-2 font-medium max-w-xl">
            Build career-defining habits. Log your daily progress, complete AI-recommended milestones, and level up your Career Score.
          </p>
        </div>
        <div className="flex flex-col items-center bg-surface p-4 rounded-xl border border-primary/20 shadow-sm min-w-[150px]">
          <span className="text-xs font-extrabold text-muted uppercase tracking-widest mb-1">Career Score</span>
          <span className={`text-4xl font-black ${careerScore >= 80 ? 'text-success' : careerScore >= 50 ? 'text-primary' : 'text-error'}`}>
            {careerScore}
          </span>
        </div>
      </div>

      {/* AI RECOMMENDATIONS */}
      <div className="card-static p-6 border border-secondary/20 bg-secondary/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">psychology</span>
            <h2 className="text-lg font-bold text-on-surface">Career Twin Recommended Goals</h2>
          </div>
          <button 
            onClick={getGoalRecommendations}
            disabled={isLoadingRecommendations}
            className="px-4 py-2 bg-secondary/10 text-secondary font-bold text-xs rounded-lg hover:bg-secondary/20 transition-colors flex items-center gap-2"
          >
            {isLoadingRecommendations ? 'Generating...' : 'Refresh AI Goals'}
          </button>
        </div>
        
        {aiRecommendations.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Click refresh to generate personalized high-impact goals based on your missing skills.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aiRecommendations.map((rec, i) => (
              <div key={i} className="card-static p-4 border-outline-variant/30 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-sm font-bold text-on-surface">{rec.title}</h3>
                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{rec.durationDays}d</span>
                  </div>
                  <p className="text-xs text-on-surface-variant mb-4">{rec.description}</p>
                </div>
                <button 
                  onClick={() => addGoal({ ...rec, isAiRecommended: true })}
                  className="w-full py-2 bg-primary text-on-primary text-xs font-bold rounded-lg hover:shadow-md transition-shadow"
                >
                  Add to Tracker
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-on-surface">Active Goals</h2>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-surface-container-high hover:bg-surface-container text-on-surface text-sm font-bold rounded-xl transition-colors border border-outline-variant/30"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Custom Goal
        </button>
      </div>

      {/* ACTIVE GOALS */}
      <div className="space-y-6">
        {activeGoals.length === 0 && (
          <div className="card-static p-8 text-center border-dashed">
            <span className="material-symbols-outlined text-4xl text-muted mb-2">track_changes</span>
            <h3 className="text-sm font-bold text-on-surface">No Active Goals</h3>
            <p className="text-xs text-on-surface-variant mt-1">Start a custom goal or add an AI recommendation to begin tracking.</p>
          </div>
        )}

        {activeGoals.map(goal => {
          // Generate a 28-day grid or up to durationDays
          const gridDays = [];
          const start = new Date(goal.createdAt);
          start.setHours(0,0,0,0);
          for (let i = 0; i < Math.min(goal.durationDays, 30); i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            gridDays.push(d.toISOString().split('T')[0]);
          }

          const completedCount = Object.values(goal.history).filter(v => v === 'Completed').length;
          const pct = Math.round((completedCount / goal.durationDays) * 100);

          return (
            <div key={goal.id} className="card-static p-5 border-l-4 border-l-primary relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                
                {/* Info */}
                <div className="lg:w-1/3">
                  <div className="flex items-center gap-2 mb-1">
                    {goal.isAiRecommended && <span className="material-symbols-outlined text-secondary text-sm">psychology</span>}
                    <h3 className="text-lg font-bold text-on-surface">{goal.title}</h3>
                  </div>
                  <p className="text-xs text-on-surface-variant mb-3 font-semibold uppercase tracking-wider">{goal.category} • {goal.dailyTarget || 'No daily target'}</p>
                  
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted font-bold uppercase">Progress</span>
                      <span className="text-lg font-black text-primary">{pct}%</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted font-bold uppercase">Completed</span>
                      <span className="text-lg font-black text-on-surface">{completedCount}/{goal.durationDays}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => endGoal(goal)}
                    disabled={isEndingGoalId === goal.id}
                    className="text-xs font-bold text-error bg-error/10 hover:bg-error/20 px-3 py-1.5 rounded-md transition-colors"
                  >
                    {isEndingGoalId === goal.id ? 'Generating AI Report...' : 'End Goal Early'}
                  </button>
                </div>

                {/* Grid */}
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 text-right">Daily Tracker (Click to toggle)</p>
                  <div className="flex flex-wrap gap-2 justify-end">
                    {gridDays.map(dateStr => (
                      <button
                        key={dateStr}
                        onClick={() => toggleDayStatus(goal.id, dateStr)}
                        title={dateStr}
                        className={`w-6 h-6 rounded-md transition-colors shadow-sm ${getStatusColor(goal.history[dateStr])}`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-end gap-3 mt-3 text-[10px] font-bold text-muted">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-success"/> Completed</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-error"/> Missed</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-warning"/> Skipped</span>
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* PAST GOALS */}
      {pastGoals.length > 0 && (
        <div className="mt-12 space-y-6">
          <h2 className="text-xl font-extrabold text-on-surface">Past Goals & AI Reports</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pastGoals.map(goal => (
              <div key={goal.id} className="card-static p-5 border-outline-variant/30">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-sm font-bold text-on-surface">{goal.title}</h3>
                  <span className="text-[10px] font-bold bg-surface-container text-muted px-2 py-1 rounded-full">{goal.durationDays} Days</span>
                </div>
                
                {goal.report ? (
                  <div className="space-y-3 bg-surface-container-low p-4 rounded-xl border border-outline-variant/20">
                    <div className="flex justify-between items-center border-b border-outline-variant/20 pb-2">
                      <span className="text-xs font-bold text-muted">AI Performance Report</span>
                      <span className="text-xs font-black text-secondary">{goal.report.consistency} Consistency</span>
                    </div>
                    <p className="text-xs text-on-surface-variant font-medium leading-relaxed">{goal.report.estimatedSkillImprovement}</p>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-muted uppercase">Recommendations:</span>
                      <ul className="text-xs text-on-surface-variant font-medium list-disc list-inside">
                        {goal.report.recommendations?.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                    <div className="pt-2 flex justify-between items-center text-xs font-bold">
                      <span className="text-muted">Next Step:</span>
                      <span className={`px-2 py-0.5 rounded-md ${
                        goal.report.nextStep === 'Extend' ? 'bg-primary/10 text-primary' : 
                        goal.report.nextStep === 'Continue' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                      }`}>{goal.report.nextStep}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted">No AI report available.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="card-static w-full max-w-md p-6 border border-outline-variant/30 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-extrabold text-on-surface mb-4">Create Custom Goal</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1.5 block">Goal Title</label>
                <input 
                  type="text" 
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-lg p-2.5 text-sm text-on-surface outline-none focus:border-primary transition-colors font-medium"
                  placeholder="e.g. Solve 3 LeetCode Mediums"
                  value={newGoal.title}
                  onChange={e => setNewGoal({...newGoal, title: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1.5 block">Category</label>
                  <select 
                    className="w-full bg-surface-container border border-outline-variant/30 rounded-lg p-2.5 text-sm text-on-surface outline-none focus:border-primary transition-colors font-medium"
                    value={newGoal.category}
                    onChange={e => setNewGoal({...newGoal, category: e.target.value})}
                  >
                    <option>Learning</option>
                    <option>Projects</option>
                    <option>DSA</option>
                    <option>Interview Prep</option>
                    <option>Certifications</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1.5 block">Duration (Days)</label>
                  <input 
                    type="number" 
                    min="1" max="90"
                    className="w-full bg-surface-container border border-outline-variant/30 rounded-lg p-2.5 text-sm text-on-surface outline-none focus:border-primary transition-colors font-medium"
                    value={newGoal.durationDays}
                    onChange={e => setNewGoal({...newGoal, durationDays: parseInt(e.target.value) || 1})}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1.5 block">Daily Target (Optional)</label>
                <input 
                  type="text" 
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-lg p-2.5 text-sm text-on-surface outline-none focus:border-primary transition-colors font-medium"
                  placeholder="e.g. 1 hour, 2 problems, 1 module"
                  value={newGoal.dailyTarget}
                  onChange={e => setNewGoal({...newGoal, dailyTarget: e.target.value})}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-8">
              <button 
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => addGoal(newGoal)}
                disabled={!newGoal.title}
                className="px-5 py-2.5 bg-primary text-on-primary text-xs font-bold rounded-lg hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Goal
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
