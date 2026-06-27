'use client';

export default function Sidebar({ activePage, setActivePage, userEmail, onLogout }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'space_dashboard' },
    { id: 'mission', label: 'Job Mission', icon: 'target' },
    { id: 'twin', label: 'Career Twin', icon: 'psychology' },
    { id: 'interview', label: 'Mock Interview', icon: 'record_voice_over' },
    { id: 'goals', label: 'Goal Tracker', icon: 'flag' },
    { id: 'pipeline', label: 'Pipeline', icon: 'view_kanban' },
    { id: 'profile', label: 'Profile', icon: 'settings' },
  ];

  return (
    <nav className="fixed h-screen w-[240px] left-0 top-0 flex flex-col py-6 glass-panel border-r border-outline-variant/30 z-50 justify-between">
      <div>
        {/* Brand */}
        <div className="px-6 mb-10">
          <h1 className="text-xl font-extrabold text-on-surface flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary/20 to-secondary/20 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/5">
              <span className="material-symbols-outlined text-primary text-xl">rocket_launch</span>
            </span>
            <span className="text-gradient-primary">CareerOS</span>
          </h1>
          <p className="text-muted text-[9px] font-bold tracking-[0.2em] mt-2 ml-[48px] uppercase">Career Strategy</p>
        </div>
 
        {/* Navigation */}
        <div className="space-y-1.5 px-3">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-200 text-sm relative ${
                activePage === item.id
                  ? 'active-nav-glow bg-primary/8 text-primary font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container-high/40 hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>
 
      {/* User Footer */}
      <div className="px-5 pt-5 border-t border-outline-variant/20 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-surface-container-high to-surface-container-highest flex items-center justify-center border border-outline-variant/35 shadow-inner">
            <span className="material-symbols-outlined text-on-surface-variant text-xl">person</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-on-surface truncate">{userEmail}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="pulse-dot" />
              <span className="text-[10px] text-primary font-medium tracking-wide">Online</span>
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Log out"
            className="text-on-surface-variant hover:text-error transition-colors duration-200 p-1 rounded-md hover:bg-error/10"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
