'use client';

export default function Topbar({ activePage, setActivePage, userEmail, onLogout }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'space_dashboard' },
    { id: 'mission', label: 'Job Mission', icon: 'target' },
    { id: 'twin', label: 'Career Twin', icon: 'psychology' },
    { id: 'mentor', label: 'AI Mentor', icon: 'school' },
    { id: 'interview', label: 'Mock Interview', icon: 'record_voice_over' },
    { id: 'goals', label: 'Goal Tracker', icon: 'flag' },
    { id: 'pipeline', label: 'Pipeline', icon: 'view_kanban' },
    { id: 'profile', label: 'Profile', icon: 'settings' },
  ];

  const initials = userEmail
    ? userEmail.split('@')[0].slice(0, 2).toUpperCase()
    : '?';

  return (
    <nav className="fixed h-[60px] w-full left-0 top-0 flex items-center glass-panel border-b border-outline-variant/30 z-50 px-4 gap-4">
      {/* Left: Brand */}
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary/20 to-secondary/20 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/5">
          <span className="material-symbols-outlined text-primary text-lg">rocket_launch</span>
        </span>
        <span className="text-base font-extrabold text-gradient-primary">CareerOS</span>
      </div>

      {/* Center: Nav items */}
      <div className="flex items-center gap-0.5 mx-auto overflow-x-auto custom-scrollbar">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200 whitespace-nowrap ${
              activePage === item.id
                ? 'active-nav-top text-primary'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/30'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {/* Right: User section */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="pulse-dot" />
          <span className="text-[10px] text-primary font-medium tracking-wide hidden sm:inline">Online</span>
        </div>
        <div className="flex items-center gap-2.5 pl-3 border-l border-outline-variant/20">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-md shadow-primary/20">
            <span className="text-[11px] font-extrabold text-white">{initials}</span>
          </div>
          <span className="text-xs font-semibold text-on-surface truncate max-w-[120px] hidden md:block">{userEmail}</span>
          <button
            onClick={onLogout}
            title="Log out"
            className="text-on-surface-variant hover:text-error transition-colors duration-200 p-1.5 rounded-md hover:bg-error/10"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
