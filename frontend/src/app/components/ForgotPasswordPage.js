'use client';
import { useState } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function ForgotPasswordPage({ onBack }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [recoveryQuestion, setRecoveryQuestion] = useState('');
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/forgot-password/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to verify email');
      setRecoveryQuestion(data.recoveryQuestion);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!recoveryAnswer.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setError('Please fill in all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/forgot-password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          recoveryAnswer: recoveryAnswer.trim(),
          newPassword
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to reset password');
      setSuccess(true);
      setTimeout(() => {
        onBack();
      }, 3000);
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

      <div className="auth-back-wrap">
        <button onClick={onBack} className="auth-back-btn" disabled={loading}>
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to Login
        </button>
      </div>

      <div className="auth-layout" style={{ justifyContent: 'center', minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <div className="auth-card-wrap" style={{ width: '100%', maxWidth: '440px' }}>
          <div className="auth-card-border" />
          <div className="auth-card">
            
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h2 className="auth-heading" style={{ fontSize: '28px', marginBottom: '8px' }}>
                Account <span className="auth-heading-gradient">Recovery</span>
              </h2>
              <p className="auth-tagline" style={{ marginTop: '8px' }}>
                {step === 1 ? 'Enter your email to verify your account' : 'Answer your security question to reset your password'}
              </p>
            </div>

            {success ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ width: '64px', height: '64px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <span className="material-symbols-outlined" style={{ color: '#10B981', fontSize: '32px' }}>check_circle</span>
                </div>
                <h3 style={{ color: 'white', fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Password Reset Successfully</h3>
                <p style={{ color: '#94A3B8', fontSize: '14px' }}>Redirecting you to login...</p>
              </div>
            ) : (
              <form onSubmit={step === 1 ? handleVerifyEmail : handleResetPassword} className="auth-form">
                
                {step === 1 && (
                  <div className="auth-field auth-field-animate">
                    <label className="auth-label">Email Address</label>
                    <div className="auth-input-wrap">
                      <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#64748B" strokeWidth="1.5"/><polyline points="22,6 12,13 2,6" stroke="#64748B" strokeWidth="1.5"/></svg>
                      <input className="auth-input" type="email" name="email" placeholder="you@example.com" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} required disabled={loading} />
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="auth-field">
                      <label className="auth-label">Security Question</label>
                      <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: '#E2E8F0', fontSize: '14px', fontWeight: 500 }}>
                        {recoveryQuestion}
                      </div>
                    </div>

                    <div className="auth-field">
                      <label className="auth-label">Your Answer</label>
                      <div className="auth-input-wrap">
                        <input className="auth-input" type="text" name="recoveryAnswer" placeholder="Enter your secret answer" value={recoveryAnswer} onChange={(e) => { setRecoveryAnswer(e.target.value); setError(''); }} required disabled={loading} />
                      </div>
                    </div>

                    <div className="auth-field">
                      <label className="auth-label">New Password</label>
                      <div className="auth-input-wrap">
                        <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="#64748B" strokeWidth="1.5"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#64748B" strokeWidth="1.5"/></svg>
                        <input className="auth-input" type={showPassword ? 'text' : 'password'} name="newPassword" placeholder="••••••••" value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setError(''); }} required disabled={loading} minLength={6} />
                        <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                          {showPassword
                            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round"/></svg>
                            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#64748B" strokeWidth="1.5"/><circle cx="12" cy="12" r="3" stroke="#64748B" strokeWidth="1.5"/></svg>
                          }
                        </button>
                      </div>
                    </div>

                    <div className="auth-field">
                      <label className="auth-label">Confirm New Password</label>
                      <div className="auth-input-wrap">
                        <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="#64748B" strokeWidth="1.5"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#64748B" strokeWidth="1.5"/></svg>
                        <input className="auth-input" type={showPassword ? 'text' : 'password'} name="confirmPassword" placeholder="••••••••" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }} required disabled={loading} minLength={6} />
                      </div>
                    </div>
                  </div>
                )}

                {error && <div className="auth-error fade-in"><span>⚠</span> {error}</div>}

                <button type="submit" className="auth-submit" disabled={loading} style={{ marginTop: '12px' }}>
                  {loading ? <span className="auth-spinner" /> : (step === 1 ? 'Verify Email' : 'Reset Password')}
                </button>

              </form>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
