'use client';
import { useState } from 'react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const countryCodes = [
  { code: '+1', country: 'United States/Canada' }, { code: '+93', country: 'Afghanistan' }, { code: '+355', country: 'Albania' }, { code: '+213', country: 'Algeria' }, { code: '+376', country: 'Andorra' }, { code: '+244', country: 'Angola' }, { code: '+54', country: 'Argentina' }, { code: '+374', country: 'Armenia' }, { code: '+61', country: 'Australia' }, { code: '+43', country: 'Austria' }, { code: '+994', country: 'Azerbaijan' }, { code: '+973', country: 'Bahrain' }, { code: '+880', country: 'Bangladesh' }, { code: '+375', country: 'Belarus' }, { code: '+32', country: 'Belgium' }, { code: '+501', country: 'Belize' }, { code: '+229', country: 'Benin' }, { code: '+975', country: 'Bhutan' }, { code: '+591', country: 'Bolivia' }, { code: '+387', country: 'Bosnia and Herzegovina' }, { code: '+267', country: 'Botswana' }, { code: '+55', country: 'Brazil' }, { code: '+673', country: 'Brunei' }, { code: '+359', country: 'Bulgaria' }, { code: '+226', country: 'Burkina Faso' }, { code: '+257', country: 'Burundi' }, { code: '+855', country: 'Cambodia' }, { code: '+237', country: 'Cameroon' }, { code: '+1', country: 'Canada' }, { code: '+238', country: 'Cape Verde' }, { code: '+236', country: 'Central African Republic' }, { code: '+235', country: 'Chad' }, { code: '+56', country: 'Chile' }, { code: '+86', country: 'China' }, { code: '+57', country: 'Colombia' }, { code: '+269', country: 'Comoros' }, { code: '+242', country: 'Congo' }, { code: '+506', country: 'Costa Rica' }, { code: '+385', country: 'Croatia' }, { code: '+53', country: 'Cuba' }, { code: '+357', country: 'Cyprus' }, { code: '+420', country: 'Czech Republic' }, { code: '+45', country: 'Denmark' }, { code: '+253', country: 'Djibouti' }, { code: '+593', country: 'Ecuador' }, { code: '+20', country: 'Egypt' }, { code: '+503', country: 'El Salvador' }, { code: '+240', country: 'Equatorial Guinea' }, { code: '+291', country: 'Eritrea' }, { code: '+372', country: 'Estonia' }, { code: '+251', country: 'Ethiopia' }, { code: '+679', country: 'Fiji' }, { code: '+358', country: 'Finland' }, { code: '+33', country: 'France' }, { code: '+241', country: 'Gabon' }, { code: '+220', country: 'Gambia' }, { code: '+995', country: 'Georgia' }, { code: '+49', country: 'Germany' }, { code: '+233', country: 'Ghana' }, { code: '+30', country: 'Greece' }, { code: '+502', country: 'Guatemala' }, { code: '+224', country: 'Guinea' }, { code: '+245', country: 'Guinea-Bissau' }, { code: '+592', country: 'Guyana' }, { code: '+509', country: 'Haiti' }, { code: '+504', country: 'Honduras' }, { code: '+852', country: 'Hong Kong' }, { code: '+36', country: 'Hungary' }, { code: '+354', country: 'Iceland' }, { code: '+91', country: 'India' }, { code: '+62', country: 'Indonesia' }, { code: '+98', country: 'Iran' }, { code: '+964', country: 'Iraq' }, { code: '+353', country: 'Ireland' }, { code: '+972', country: 'Israel' }, { code: '+39', country: 'Italy' }, { code: '+225', country: 'Ivory Coast' }, { code: '+81', country: 'Japan' }, { code: '+962', country: 'Jordan' }, { code: '+7', country: 'Kazakhstan' }, { code: '+254', country: 'Kenya' }, { code: '+965', country: 'Kuwait' }, { code: '+996', country: 'Kyrgyzstan' }, { code: '+856', country: 'Laos' }, { code: '+371', country: 'Latvia' }, { code: '+961', country: 'Lebanon' }, { code: '+266', country: 'Lesotho' }, { code: '+231', country: 'Liberia' }, { code: '+218', country: 'Libya' }, { code: '+423', country: 'Liechtenstein' }, { code: '+370', country: 'Lithuania' }, { code: '+352', country: 'Luxembourg' }, { code: '+853', country: 'Macau' }, { code: '+389', country: 'Macedonia' }, { code: '+261', country: 'Madagascar' }, { code: '+265', country: 'Malawi' }, { code: '+60', country: 'Malaysia' }, { code: '+960', country: 'Maldives' }, { code: '+223', country: 'Mali' }, { code: '+356', country: 'Malta' }, { code: '+222', country: 'Mauritania' }, { code: '+230', country: 'Mauritius' }, { code: '+52', country: 'Mexico' }, { code: '+373', country: 'Moldova' }, { code: '+377', country: 'Monaco' }, { code: '+976', country: 'Mongolia' }, { code: '+382', country: 'Montenegro' }, { code: '+212', country: 'Morocco' }, { code: '+258', country: 'Mozambique' }, { code: '+95', country: 'Myanmar' }, { code: '+264', country: 'Namibia' }, { code: '+977', country: 'Nepal' }, { code: '+31', country: 'Netherlands' }, { code: '+64', country: 'New Zealand' }, { code: '+505', country: 'Nicaragua' }, { code: '+227', country: 'Niger' }, { code: '+234', country: 'Nigeria' }, { code: '+82', country: 'South Korea' }, { code: '+47', country: 'Norway' }, { code: '+968', country: 'Oman' }, { code: '+92', country: 'Pakistan' }, { code: '+970', country: 'Palestine' }, { code: '+507', country: 'Panama' }, { code: '+675', country: 'Papua New Guinea' }, { code: '+595', country: 'Paraguay' }, { code: '+51', country: 'Peru' }, { code: '+63', country: 'Philippines' }, { code: '+48', country: 'Poland' }, { code: '+351', country: 'Portugal' }, { code: '+974', country: 'Qatar' }, { code: '+40', country: 'Romania' }, { code: '+7', country: 'Russia' }, { code: '+250', country: 'Rwanda' }, { code: '+966', country: 'Saudi Arabia' }, { code: '+221', country: 'Senegal' }, { code: '+381', country: 'Serbia' }, { code: '+248', country: 'Seychelles' }, { code: '+232', country: 'Sierra Leone' }, { code: '+65', country: 'Singapore' }, { code: '+421', country: 'Slovakia' }, { code: '+386', country: 'Slovenia' }, { code: '+252', country: 'Somalia' }, { code: '+27', country: 'South Africa' }, { code: '+34', country: 'Spain' }, { code: '+94', country: 'Sri Lanka' }, { code: '+249', country: 'Sudan' }, { code: '+597', country: 'Suriname' }, { code: '+268', country: 'Swaziland' }, { code: '+46', country: 'Sweden' }, { code: '+41', country: 'Switzerland' }, { code: '+963', country: 'Syria' }, { code: '+886', country: 'Taiwan' }, { code: '+992', country: 'Tajikistan' }, { code: '+255', country: 'Tanzania' }, { code: '+66', country: 'Thailand' }, { code: '+228', country: 'Togo' }, { code: '+676', country: 'Tonga' }, { code: '+216', country: 'Tunisia' }, { code: '+90', country: 'Turkey' }, { code: '+993', country: 'Turkmenistan' }, { code: '+256', country: 'Uganda' }, { code: '+380', country: 'Ukraine' }, { code: '+971', country: 'United Arab Emirates' }, { code: '+44', country: 'United Kingdom' }, { code: '+1', country: 'United States' }, { code: '+598', country: 'Uruguay' }, { code: '+998', country: 'Uzbekistan' }, { code: '+58', country: 'Venezuela' }, { code: '+84', country: 'Vietnam' }, { code: '+967', country: 'Yemen' }, { code: '+260', country: 'Zambia' }, { code: '+263', country: 'Zimbabwe' },
];
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function AuthPage({ onAuthSuccess, onBack }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', mobile: '', password: '' });
  const [countryCode, setCountryCode] = useState('+1');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!EMAIL_REGEX.test(form.email)) {
      setError('Please enter a valid email address');
      return;
    }
    setLoading(true);
    setError('');
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const fullMobile = `${countryCode} ${form.mobile}`;
    const body = mode === 'login'
      ? { email: form.email, password: form.password }
      : { email: form.email, mobile: fullMobile, password: form.password };
    try {
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Something went wrong');
      localStorage.setItem('careeros_token', data.token);
      localStorage.setItem('careeros_email', data.email);
      onAuthSuccess(data.email);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root fade-in">
      {/* Grid overlay */}
      <div className="auth-grid" />

      {/* Ambient orbs */}
      <div className="ambient-orb-1" />
      <div className="ambient-orb-2" />
      <div className="ambient-orb-3" />

      {onBack && (
        <div className="auth-back-wrap">
          <button onClick={onBack} className="auth-back-btn">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to Home
          </button>
        </div>
      )}

      <div className="auth-layout">
        {/* Hero Section */}
        <div className="auth-hero">
          <div className="auth-badge">
            <span className="auth-badge-icon">✦</span>
            AI-Powered Career OS
          </div>

          <h1 className="auth-heading">
            Land Your{" "}
            <span className="auth-heading-gradient">Dream Job</span>
            <br />
            Faster Than Ever
          </h1>

          <p className="auth-tagline">
            AI analyzes jobs, tailors your resume, tracks applications
            <br />
            — so you focus on interviews, not spreadsheets.
          </p>

          <div className="auth-trust">
            <span>🔒 Private & Local</span>
            <span className="auth-trust-dot" />
            <span>⚡ AI-Powered</span>
            <span className="auth-trust-dot" />
            <span>🎯 ATS-Optimized</span>
          </div>
        </div>

        {/* Auth Card */}
        <div className="auth-card-wrap">
          <div className="auth-card-border" />
          <div className="auth-card">
            {/* Tabs */}
            <div className="auth-tabs">
              <button
                className={`auth-tab-btn ${mode === 'login' ? 'auth-tab-active' : ''}`}
                onClick={() => { setMode('login'); setError(''); }}
                type="button"
              >
                Sign In
                {mode === 'login' && <span className="auth-tab-underline" />}
              </button>
              <button
                className={`auth-tab-btn ${mode === 'signup' ? 'auth-tab-active' : ''}`}
                onClick={() => { setMode('signup'); setError(''); }}
                type="button"
              >
                Create Account
                {mode === 'signup' && <span className="auth-tab-underline" />}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label className="auth-label">Email</label>
                <div className="auth-input-wrap">
                  <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#64748B" strokeWidth="1.5"/><polyline points="22,6 12,13 2,6" stroke="#64748B" strokeWidth="1.5"/></svg>
                  <input className="auth-input" type="email" name="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required autoComplete="email" />
                </div>
              </div>

              {mode === 'signup' && (
                <div className="auth-field auth-field-animate">
                  <label className="auth-label">Mobile Number</label>
                  <div className="auth-input-wrap" style={{ gap: 0 }}>
                    <svg className="auth-input-icon" style={{ zIndex: 1 }} width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="5" y="2" width="14" height="20" rx="2" stroke="#64748B" strokeWidth="1.5"/><circle cx="12" cy="17" r="1" fill="#64748B"/></svg>
                    <select className="auth-input auth-input-select" value={countryCode} onChange={(e) => { setCountryCode(e.target.value); setError(''); }}>
                      {countryCodes.map(cc => (
                        <option key={`${cc.code}-${cc.country}`} value={cc.code}>{cc.code} {cc.country}</option>
                      ))}
                    </select>
                    <input className="auth-input auth-input-tel" type="tel" name="mobile" placeholder="98765 43210" value={form.mobile} onChange={handleChange} required autoComplete="tel" />
                  </div>
                </div>
              )}

              <div className="auth-field">
                <label className="auth-label">Password</label>
                <div className="auth-input-wrap">
                  <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="#64748B" strokeWidth="1.5"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#64748B" strokeWidth="1.5"/></svg>
                  <input className="auth-input" type={showPassword ? 'text' : 'password'} name="password" placeholder="••••••••" value={form.password} onChange={handleChange} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                  <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                    {showPassword
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#64748B" strokeWidth="1.5"/><circle cx="12" cy="12" r="3" stroke="#64748B" strokeWidth="1.5"/></svg>
                    }
                  </button>
                </div>
              </div>

              {error && <div className="auth-error"><span>⚠</span> {error}</div>}

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? <span className="auth-spinner" /> : (mode === 'login' ? 'Sign In' : 'Create Account')}
              </button>
            </form>

            <p className="auth-toggle-hint">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button type="button" className="auth-toggle-link" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
                {mode === 'login' ? 'Sign up' : 'Log in'}
              </button>
            </p>

            <p className="auth-social-proof">Joined by 10,000+ job seekers</p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="auth-stats">
        740 Jobs Analyzed <span className="auth-stats-dot">·</span> 68 Applications <span className="auth-stats-dot">·</span> 12 Interviews <span className="auth-stats-dot">·</span> 1 Offer
      </div>
    </div>
  );
}
