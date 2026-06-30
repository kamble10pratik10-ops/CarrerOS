'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

export default function LandingPage({ onLogin, onGetStarted }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [visibleSections, setVisibleSections] = useState({});
  const sectionRefs = useRef({});

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const observeSection = useCallback((id) => (el) => {
    if (!el) return;
    sectionRefs.current[id] = el;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisibleSections(prev => ({ ...prev, [id]: true })); observer.unobserve(el); } },
      { threshold: 0.15 }
    );
    observer.observe(el);
  }, []);

  const scrollTo = (id) => {
    setMobileNavOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const navLinks = [
    { id: 'features', label: 'Features' },
    { id: 'how-it-works', label: 'How It Works' },
  ];

  return (
    <div className="landing-root">
      <div className="dot-grid-bg" />
      <div className="ambient-orb-1" />
      <div className="ambient-orb-2" />
      <div className="ambient-orb-3" />

      {/* Topnav */}
      <nav className={`landing-nav ${scrolled ? 'landing-nav-scrolled' : ''}`}>
        <div className="landing-nav-inner">
          <div className="landing-nav-left">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary/20 to-secondary/20 border border-primary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-lg">rocket_launch</span>
            </span>
            <span className="text-base font-extrabold text-gradient-primary">CareerOS</span>
          </div>

          <div className="landing-nav-center">
            {navLinks.map(link => (
              <button key={link.id} onClick={() => scrollTo(link.id)} className="landing-nav-link">{link.label}</button>
            ))}
          </div>

          <div className="landing-nav-right">
            <button onClick={onLogin} className="landing-nav-login">Log in</button>
            <button onClick={onGetStarted} className="landing-nav-cta">Get Started <span className="material-symbols-outlined text-sm">arrow_forward</span></button>
          </div>

          <button className="landing-mobile-toggle" onClick={() => setMobileNavOpen(v => !v)}>
            <span className="material-symbols-outlined text-on-surface">{mobileNavOpen ? 'close' : 'menu'}</span>
          </button>
        </div>

        {mobileNavOpen && (
          <div className="landing-mobile-menu">
            {navLinks.map(link => (
              <button key={link.id} onClick={() => scrollTo(link.id)} className="landing-mobile-link">{link.label}</button>
            ))}
            <button onClick={onLogin} className="landing-mobile-link">Log in</button>
            <button onClick={onGetStarted} className="landing-mobile-cta">Get Started <span className="material-symbols-outlined text-sm">arrow_forward</span></button>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-badge">
          <span className="landing-hero-badge-icon">✦</span>
          AI-Powered Career Operating System
        </div>
        <h1 className="landing-hero-heading">
          Stop Applying Blindly
          <br />
          Start Landing{' '}
          <span className="landing-hero-gradient">Interviews</span>
        </h1>
        <p className="landing-hero-tagline">
          AI scores every job against your CV, writes tailored resumes,
          <br />
          and tracks your pipeline — all private, all yours.
        </p>
        <div className="landing-hero-actions">
          <button onClick={onGetStarted} className="landing-hero-cta">
            Get Started Free <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </button>
          <button onClick={() => scrollTo('how-it-works')} className="landing-hero-ghost">
            See How It Works <span className="material-symbols-outlined text-lg">expand_more</span>
          </button>
        </div>
        <div className="landing-hero-stats">
          <span>10,000+ job seekers</span>
          <span className="landing-hero-stats-dot" />
          <span>740 jobs analyzed</span>
          <span className="landing-hero-stats-dot" />
          <span>#1 on GitHub</span>
        </div>
      </section>

      {/* Features */}
      <section id="features" ref={observeSection('features')} className={`landing-section ${visibleSections.features ? 'fade-up' : ''}`}>
        <div className="landing-section-inner">
          <h2 className="landing-section-title">
            Everything you need to <span className="text-gradient-primary">land the role</span>
          </h2>
          <p className="landing-section-subtitle">Four powerful tools, one dashboard. No fluff.</p>
          <div className="landing-features-grid">
            {[
              { icon: 'target', title: 'Job Scoring', desc: 'Score every listing 1.0–5.0 against your CV. Know which jobs are worth your time before you apply.' },
              { icon: 'description', title: 'Resume Tailoring', desc: 'AI rewrites your CV per role, ATS-optimized. Download a tailored .docx instantly.' },
              { icon: 'view_kanban', title: 'Pipeline Tracker', desc: 'Kanban board for all your applications. Drag, drop, never lose track of a status.' },
              { icon: 'psychology', title: 'Career Twin AI', desc: 'Chat with an AI that knows your career goals. Get personalised advice on demand.' },
            ].map((f, i) => (
              <div key={i} className="feature-card">
                <div className="feature-card-icon">
                  <span className="material-symbols-outlined text-primary text-2xl">{f.icon}</span>
                </div>
                <h3 className="feature-card-title">{f.title}</h3>
                <p className="feature-card-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" ref={observeSection('how')} className={`landing-section ${visibleSections.how ? 'fade-up' : ''}`}>
        <div className="landing-section-inner">
          <h2 className="landing-section-title">Four steps to your next <span className="text-gradient-primary">offer</span></h2>
          <p className="landing-section-subtitle">From paste to pipeline in minutes.</p>
          <div className="landing-steps">
            {[
              { num: '1', title: 'Paste a job URL', desc: 'AI scores it against your profile and highlights gaps.' },
              { num: '2', title: 'Get a tailored resume', desc: 'ATS-optimised .docx generated instantly, ready to submit.' },
              { num: '3', title: 'Track your pipeline', desc: 'Every application lives in a Kanban board. Know your status at a glance.' },
              { num: '4', title: 'Chat with Career Twin', desc: 'Refine your strategy with an AI mentor that knows your goals.' },
            ].map((s, i) => (
              <div key={i} className="landing-step">
                <div className="step-number">{s.num}</div>
                <div className="landing-step-content">
                  <h3 className="landing-step-title">{s.title}</h3>
                  <p className="landing-step-desc">{s.desc}</p>
                </div>
                {i < 3 && <div className="step-connector" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <div className="stats-bar">
        <span>55K+ GitHub Stars</span>
        <span className="stats-bar-dot">·</span>
        <span>MIT Licensed</span>
        <span className="stats-bar-dot">·</span>
        <span>Zero Data Sent</span>
        <span className="stats-bar-dot">·</span>
        <span>Free Forever</span>
      </div>

      {/* Final CTA */}
      <section ref={observeSection('cta')} className={`landing-cta-section ${visibleSections.cta ? 'fade-up' : ''}`}>
        <div className="landing-cta-inner">
          <h2 className="landing-cta-title">Ready to take control of your job search?</h2>
          <p className="landing-cta-subtitle">No credit card. No cloud. Your data stays on your machine.</p>
          <button onClick={onGetStarted} className="landing-cta-btn">
            Create Free Account <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-left">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-tr from-primary/20 to-secondary/20 border border-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-sm">rocket_launch</span>
              </span>
              <span className="text-sm font-extrabold text-gradient-primary">CareerOS</span>
            </div>
          </div>
          <div className="landing-footer-links">
            <button onClick={() => scrollTo('features')} className="landing-footer-link">Features</button>
            <button onClick={() => scrollTo('how-it-works')} className="landing-footer-link">How It Works</button>
            <a href="https://github.com/kamble10pratik10-ops/CarrerOS" target="_blank" rel="noopener noreferrer" className="landing-footer-link">GitHub</a>
          </div>
          <p className="landing-footer-copy">© 2026 CareerOS · MIT License · Privacy</p>
        </div>
      </footer>
    </div>
  );
}
