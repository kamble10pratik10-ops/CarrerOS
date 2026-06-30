'use client';

export default function Topbar({ onMobileMenu, onDesktopToggle, title }) {
  return (
    <nav className="flex h-14 items-center glass-panel border-b border-outline-variant/30 px-4 gap-4 shrink-0 md:hidden">
      <button
        onClick={() => { onMobileMenu?.(); onDesktopToggle?.(); }}
        className="p-2 -ml-1 rounded-lg hover:bg-surface-container-high/40 text-on-surface-variant hover:text-on-surface transition-colors"
        aria-label="Toggle menu"
      >
        <span className="material-symbols-outlined text-2xl">menu</span>
      </button>
      <span className="text-base font-extrabold text-on-surface truncate">{title}</span>
    </nav>
  );
}
