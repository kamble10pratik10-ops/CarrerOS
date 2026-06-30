'use client';

import { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import ForgotPasswordPage from './components/ForgotPasswordPage';
import Sidebar from './components/Sidebar';
import DashboardPage from './components/DashboardPage';
import JobMissionPage from './components/JobMissionPage';
import CareerTwinPage from './components/CareerTwinPage';
import InterviewPrepPage from './components/InterviewPrepPage';
import CodingMentorPage from './components/CodingMentorPage';
import GoalTrackerPage from './components/GoalTrackerPage';
import AiMentorPage from './components/AiMentorPage';
import PipelinePage from './components/PipelinePage';
import ProfilePage from './components/ProfilePage';
import CareerConnectPage from './components/CareerConnectPage';
import MessagesPage from './components/MessagesPage';
import Topbar from './components/Topbar';

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
  if (view === 'auth' && !authedEmail) return <AuthPage onAuthSuccess={(email) => { setAuthedEmail(email); setView('app'); }} onBack={() => setView('landing')} onForgotPassword={() => setView('forgot-password')} />;
  if (view === 'forgot-password' && !authedEmail) return <ForgotPasswordPage onBack={() => setView('auth')} />;
  if (authedEmail) return <MainApp authedEmail={authedEmail} handleLogout={handleLogout} />;
  return <LandingPage onLogin={() => setView('auth')} onGetStarted={() => setView('auth')} />;
}

// Main app - only mounts when authenticated.
function MainApp({ authedEmail, handleLogout }) {
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('careeros_sidebar_collapsed') === 'true'; }
    catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('careeros_sidebar_collapsed', String(sidebarCollapsed)); }
    catch { /* localStorage not available */ }
  }, [sidebarCollapsed]);

  const handleNavigate = (page, user) => {
    if (page === 'messages' && user) {
      setSelectedChatUser(user);
    } else {
      setSelectedChatUser(null);
    }
    setActivePage(page);
    setSidebarOpen(false);
  };

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
      case 'coding':
        return <CodingMentorPage />;
      case 'connect':
        return <CareerConnectPage onNavigate={handleNavigate} />;
      case 'messages':
        return <MessagesPage initialUser={selectedChatUser} onUserSelect={setSelectedChatUser} />;
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

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        userEmail={authedEmail}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
      />

      {/* Main Content */}
      <main className={`flex-1 flex flex-col min-h-0 overflow-hidden relative z-10 transition-all duration-300 ease-out ${sidebarCollapsed ? 'md:ml-0 md:pl-14' : 'md:ml-64'}`}>
        <Topbar
          onMobileMenu={() => setSidebarOpen(true)}
          onDesktopToggle={() => setSidebarCollapsed(prev => !prev)}
          title={activePage.charAt(0).toUpperCase() + activePage.slice(1)}
        />

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

