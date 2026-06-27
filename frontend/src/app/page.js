'use client';

import { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import Sidebar from './components/Sidebar';
import DashboardPage from './components/DashboardPage';
import JobMissionPage from './components/JobMissionPage';
import CareerTwinPage from './components/CareerTwinPage';
import InterviewPrepPage from './components/InterviewPrepPage';
import GoalTrackerPage from './components/GoalTrackerPage';
import AiMentorPage from './components/AiMentorPage';
import PipelinePage from './components/PipelinePage';
import ProfilePage from './components/ProfilePage';

// Auth wrapper - default export. Only holds auth state.
export default function CareerCommandCenter() {
  const [view, setView] = useState('landing');
  const [authedEmail, setAuthedEmail] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('careeros_token');
    const email = localStorage.getItem('careeros_email');
    if (token && email) { setAuthedEmail(email); setView('app'); }
    setAuthChecked(true);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('careeros_token');
    localStorage.removeItem('careeros_email');
    setAuthedEmail(null);
    setView('landing');
  };

  if (!authChecked) return null;
  if (view === 'landing') return <LandingPage onLogin={() => setView('auth')} onGetStarted={() => setView('auth')} />;
  if (view === 'auth' && !authedEmail) return <AuthPage onAuthSuccess={(email) => { setAuthedEmail(email); setView('app'); }} onBack={() => setView('landing')} />;
  if (authedEmail) return <MainApp authedEmail={authedEmail} handleLogout={handleLogout} />;
  return <LandingPage onLogin={() => setView('auth')} onGetStarted={() => setView('auth')} />;
}

// Main app - only mounts when authenticated.
function MainApp({ authedEmail, handleLogout }) {
  const [activePage, setActivePage] = useState('dashboard');

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage onNavigate={setActivePage} />;
      case 'mission':
        return <JobMissionPage />;
      case 'twin':
        return <CareerTwinPage />;
      case 'mentor':
        return <AiMentorPage />;
      case 'interview':
        return <InterviewPrepPage />;
      case 'goals':
        return <GoalTrackerPage onNavigate={setActivePage} />;
      case 'pipeline':
        return <PipelinePage />;
      case 'profile':
        return <ProfilePage />;
      default:
        return <DashboardPage onNavigate={setActivePage} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Background Orbs */}
      <div className="ambient-orb-1" />
      <div className="ambient-orb-2" />
      <div className="ambient-orb-3" />

      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        userEmail={authedEmail}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="ml-[240px] min-h-screen flex flex-col w-[calc(100%-240px)] overflow-y-auto custom-scrollbar relative z-10">
        {renderPage()}
      </main>
    </div>
  );
}

