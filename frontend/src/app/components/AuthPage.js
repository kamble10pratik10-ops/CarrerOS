'use client';
import { useState } from 'react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const countryCodes = [
  { code: '+1', country: 'United States/Canada' },
  { code: '+93', country: 'Afghanistan' },
  { code: '+355', country: 'Albania' },
  { code: '+213', country: 'Algeria' },
  { code: '+376', country: 'Andorra' },
  { code: '+244', country: 'Angola' },
  { code: '+54', country: 'Argentina' },
  { code: '+374', country: 'Armenia' },
  { code: '+61', country: 'Australia' },
  { code: '+43', country: 'Austria' },
  { code: '+994', country: 'Azerbaijan' },
  { code: '+973', country: 'Bahrain' },
  { code: '+880', country: 'Bangladesh' },
  { code: '+375', country: 'Belarus' },
  { code: '+32', country: 'Belgium' },
  { code: '+501', country: 'Belize' },
  { code: '+229', country: 'Benin' },
  { code: '+975', country: 'Bhutan' },
  { code: '+591', country: 'Bolivia' },
  { code: '+387', country: 'Bosnia and Herzegovina' },
  { code: '+267', country: 'Botswana' },
  { code: '+55', country: 'Brazil' },
  { code: '+673', country: 'Brunei' },
  { code: '+359', country: 'Bulgaria' },
  { code: '+226', country: 'Burkina Faso' },
  { code: '+257', country: 'Burundi' },
  { code: '+855', country: 'Cambodia' },
  { code: '+237', country: 'Cameroon' },
  { code: '+1', country: 'Canada' },
  { code: '+238', country: 'Cape Verde' },
  { code: '+236', country: 'Central African Republic' },
  { code: '+235', country: 'Chad' },
  { code: '+56', country: 'Chile' },
  { code: '+86', country: 'China' },
  { code: '+57', country: 'Colombia' },
  { code: '+269', country: 'Comoros' },
  { code: '+242', country: 'Congo' },
  { code: '+506', country: 'Costa Rica' },
  { code: '+385', country: 'Croatia' },
  { code: '+53', country: 'Cuba' },
  { code: '+357', country: 'Cyprus' },
  { code: '+420', country: 'Czech Republic' },
  { code: '+45', country: 'Denmark' },
  { code: '+253', country: 'Djibouti' },
  { code: '+593', country: 'Ecuador' },
  { code: '+20', country: 'Egypt' },
  { code: '+503', country: 'El Salvador' },
  { code: '+240', country: 'Equatorial Guinea' },
  { code: '+291', country: 'Eritrea' },
  { code: '+372', country: 'Estonia' },
  { code: '+251', country: 'Ethiopia' },
  { code: '+679', country: 'Fiji' },
  { code: '+358', country: 'Finland' },
  { code: '+33', country: 'France' },
  { code: '+241', country: 'Gabon' },
  { code: '+220', country: 'Gambia' },
  { code: '+995', country: 'Georgia' },
  { code: '+49', country: 'Germany' },
  { code: '+233', country: 'Ghana' },
  { code: '+30', country: 'Greece' },
  { code: '+502', country: 'Guatemala' },
  { code: '+224', country: 'Guinea' },
  { code: '+245', country: 'Guinea-Bissau' },
  { code: '+592', country: 'Guyana' },
  { code: '+509', country: 'Haiti' },
  { code: '+504', country: 'Honduras' },
  { code: '+852', country: 'Hong Kong' },
  { code: '+36', country: 'Hungary' },
  { code: '+354', country: 'Iceland' },
  { code: '+91', country: 'India' },
  { code: '+62', country: 'Indonesia' },
  { code: '+98', country: 'Iran' },
  { code: '+964', country: 'Iraq' },
  { code: '+353', country: 'Ireland' },
  { code: '+972', country: 'Israel' },
  { code: '+39', country: 'Italy' },
  { code: '+225', country: 'Ivory Coast' },
  { code: '+81', country: 'Japan' },
  { code: '+962', country: 'Jordan' },
  { code: '+7', country: 'Kazakhstan' },
  { code: '+254', country: 'Kenya' },
  { code: '+965', country: 'Kuwait' },
  { code: '+996', country: 'Kyrgyzstan' },
  { code: '+856', country: 'Laos' },
  { code: '+371', country: 'Latvia' },
  { code: '+961', country: 'Lebanon' },
  { code: '+266', country: 'Lesotho' },
  { code: '+231', country: 'Liberia' },
  { code: '+218', country: 'Libya' },
  { code: '+423', country: 'Liechtenstein' },
  { code: '+370', country: 'Lithuania' },
  { code: '+352', country: 'Luxembourg' },
  { code: '+853', country: 'Macau' },
  { code: '+389', country: 'Macedonia' },
  { code: '+261', country: 'Madagascar' },
  { code: '+265', country: 'Malawi' },
  { code: '+60', country: 'Malaysia' },
  { code: '+960', country: 'Maldives' },
  { code: '+223', country: 'Mali' },
  { code: '+356', country: 'Malta' },
  { code: '+222', country: 'Mauritania' },
  { code: '+230', country: 'Mauritius' },
  { code: '+52', country: 'Mexico' },
  { code: '+373', country: 'Moldova' },
  { code: '+377', country: 'Monaco' },
  { code: '+976', country: 'Mongolia' },
  { code: '+382', country: 'Montenegro' },
  { code: '+212', country: 'Morocco' },
  { code: '+258', country: 'Mozambique' },
  { code: '+95', country: 'Myanmar' },
  { code: '+264', country: 'Namibia' },
  { code: '+977', country: 'Nepal' },
  { code: '+31', country: 'Netherlands' },
  { code: '+64', country: 'New Zealand' },
  { code: '+505', country: 'Nicaragua' },
  { code: '+227', country: 'Niger' },
  { code: '+234', country: 'Nigeria' },
  { code: '+82', country: 'South Korea' },
  { code: '+47', country: 'Norway' },
  { code: '+968', country: 'Oman' },
  { code: '+92', country: 'Pakistan' },
  { code: '+970', country: 'Palestine' },
  { code: '+507', country: 'Panama' },
  { code: '+675', country: 'Papua New Guinea' },
  { code: '+595', country: 'Paraguay' },
  { code: '+51', country: 'Peru' },
  { code: '+63', country: 'Philippines' },
  { code: '+48', country: 'Poland' },
  { code: '+351', country: 'Portugal' },
  { code: '+974', country: 'Qatar' },
  { code: '+40', country: 'Romania' },
  { code: '+7', country: 'Russia' },
  { code: '+250', country: 'Rwanda' },
  { code: '+966', country: 'Saudi Arabia' },
  { code: '+221', country: 'Senegal' },
  { code: '+381', country: 'Serbia' },
  { code: '+248', country: 'Seychelles' },
  { code: '+232', country: 'Sierra Leone' },
  { code: '+65', country: 'Singapore' },
  { code: '+421', country: 'Slovakia' },
  { code: '+386', country: 'Slovenia' },
  { code: '+252', country: 'Somalia' },
  { code: '+27', country: 'South Africa' },
  { code: '+34', country: 'Spain' },
  { code: '+94', country: 'Sri Lanka' },
  { code: '+249', country: 'Sudan' },
  { code: '+597', country: 'Suriname' },
  { code: '+268', country: 'Swaziland' },
  { code: '+46', country: 'Sweden' },
  { code: '+41', country: 'Switzerland' },
  { code: '+963', country: 'Syria' },
  { code: '+886', country: 'Taiwan' },
  { code: '+992', country: 'Tajikistan' },
  { code: '+255', country: 'Tanzania' },
  { code: '+66', country: 'Thailand' },
  { code: '+228', country: 'Togo' },
  { code: '+676', country: 'Tonga' },
  { code: '+216', country: 'Tunisia' },
  { code: '+90', country: 'Turkey' },
  { code: '+993', country: 'Turkmenistan' },
  { code: '+256', country: 'Uganda' },
  { code: '+380', country: 'Ukraine' },
  { code: '+971', country: 'United Arab Emirates' },
  { code: '+44', country: 'United Kingdom' },
  { code: '+1', country: 'United States' },
  { code: '+598', country: 'Uruguay' },
  { code: '+998', country: 'Uzbekistan' },
  { code: '+58', country: 'Venezuela' },
  { code: '+84', country: 'Vietnam' },
  { code: '+967', country: 'Yemen' },
  { code: '+260', country: 'Zambia' },
  { code: '+263', country: 'Zimbabwe' },
];
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function AuthPage({ onAuthSuccess }) {
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
    <div style={styles.root}>
      <div style={styles.orb1} />
      <div style={styles.orb2} />
      <div style={styles.orb3} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeSlideIn { from { opacity:0; transform:translateY(8px);} to { opacity:1; transform:translateY(0);} }
        .auth-input:focus { border-color: rgba(45, 212, 191, 0.6) !important; box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.12) !important; background: rgba(8, 14, 30, 0.75) !important; }
        .auth-submit:hover:not(:disabled) { transform: translateY(-1.5px); box-shadow: 0 6px 24px rgba(45, 212, 191, 0.3); }
        .auth-submit:active:not(:disabled) { transform: translateY(0.5px); }
        .auth-tab:hover { color: #2DD4BF !important; }
      `}</style>
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#2DD4BF"/>
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#818CF8" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={styles.logoTitle}>CareerOS</div>
            <div style={styles.logoSubtitle}>AI-DRIVEN CAREER STRATEGY</div>
          </div>
        </div>
        <div style={styles.tabs}>
          <button className="auth-tab" style={{...styles.tab,...(mode==='login'?styles.tabActive:{})}} onClick={()=>{setMode('login');setError('');}} type="button">Log In</button>
          <button className="auth-tab" style={{...styles.tab,...(mode==='signup'?styles.tabActive:{})}} onClick={()=>{setMode('signup');setError('');}} type="button">Create Account</button>
        </div>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <div style={styles.inputWrap}>
              <svg style={styles.inputIcon} width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#64748B" strokeWidth="1.5"/><polyline points="22,6 12,13 2,6" stroke="#64748B" strokeWidth="1.5"/></svg>
              <input className="auth-input" style={styles.input} type="email" name="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required autoComplete="email"/>
            </div>
          </div>
          {mode === 'signup' && (
            <div style={{...styles.field, animation:'fadeSlideIn 0.2s ease'}}>
              <label style={styles.label}>Mobile Number</label>
              <div style={{...styles.inputWrap, gap:0}}>
                <svg style={{...styles.inputIcon, zIndex:1}} width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="5" y="2" width="14" height="20" rx="2" stroke="#64748B" strokeWidth="1.5"/><circle cx="12" cy="17" r="1" fill="#64748B"/></svg>
                <select style={{...styles.input, width:'auto', minWidth:90, flexShrink:0, padding:'12px 6px 12px 36px', borderRight:'1px solid rgba(56,66,92,0.85)', borderRadius:'10px 0 0 10px', cursor:'pointer', appearance:'auto', fontSize:13}} value={countryCode} onChange={(e)=>{setCountryCode(e.target.value);setError('');}}>
                  {countryCodes.map(cc => (
                    <option key={`${cc.code}-${cc.country}`} value={cc.code}>{cc.code} {cc.country}</option>
                  ))}
                </select>
                <input className="auth-input" style={{...styles.input, borderRadius:'0 10px 10px 0', borderLeft:'none'}} type="tel" name="mobile" placeholder="98765 43210" value={form.mobile} onChange={handleChange} required autoComplete="tel"/>
              </div>
            </div>
          )}
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <div style={styles.inputWrap}>
              <svg style={styles.inputIcon} width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="#64748B" strokeWidth="1.5"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#64748B" strokeWidth="1.5"/></svg>
              <input className="auth-input" style={styles.input} type={showPassword?'text':'password'} name="password" placeholder="••••••••" value={form.password} onChange={handleChange} required autoComplete={mode==='login'?'current-password':'new-password'}/>
              <button type="button" style={styles.eyeBtn} onClick={()=>setShowPassword(v=>!v)} tabIndex={-1}>
                {showPassword
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#64748B" strokeWidth="1.5"/><circle cx="12" cy="12" r="3" stroke="#64748B" strokeWidth="1.5"/></svg>
                }
              </button>
            </div>
          </div>
          {error && <div style={styles.errorBox}><span>⚠</span> {error}</div>}
          <button type="submit" className="auth-submit" style={{...styles.submitBtn,...(loading?{opacity:0.7,cursor:'not-allowed'}:{})}} disabled={loading}>
            {loading ? <span style={styles.spinner}/> : (mode==='login'?'Log In →':'Create Account →')}
          </button>
        </form>
        <p style={styles.toggleHint}>
          {mode==='login'?"Don't have an account? ":"Already have an account? "}
          <button type="button" style={styles.toggleLink} onClick={()=>{setMode(mode==='login'?'signup':'login');setError('');}}>
            {mode==='login'?'Sign up':'Log in'}
          </button>
        </p>
      </div>
    </div>
  );
}

const styles = {
  root:{minHeight:'100vh',background:'radial-gradient(ellipse at 20% 50%, #080C1E 0%, #050814 60%, #020409 100%)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden',fontFamily:'"Inter",system-ui,sans-serif'},
  orb1:{position:'absolute',top:'-10%',left:'-5%',width:550,height:550,borderRadius:'50%',background:'radial-gradient(circle, rgba(45,212,191,0.08) 0%, transparent 70%)',pointerEvents:'none'},
  orb2:{position:'absolute',bottom:'-15%',right:'-5%',width:650,height:650,borderRadius:'50%',background:'radial-gradient(circle, rgba(129,140,248,0.07) 0%, transparent 70%)',pointerEvents:'none'},
  orb3:{position:'absolute',top:'45%',left:'55%',width:350,height:350,borderRadius:'50%',background:'radial-gradient(circle, rgba(236,72,153,0.05) 0%, transparent 70%)',pointerEvents:'none'},
  card:{position:'relative',background:'rgba(12,18,37,0.7)',backdropFilter:'blur(24px)',WebkitBackdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.05)',borderRadius:20,padding:'44px 48px',width:'100%',maxWidth:440,boxShadow:'0 25px 60px rgba(0,0,0,0.45)'},
  logo:{display:'flex',alignItems:'center',gap:14,marginBottom:36},
  logoIcon:{width:44,height:44,borderRadius:12,background:'linear-gradient(135deg, rgba(45,212,191,0.08) 0%, rgba(129,140,248,0.08) 100%)',border:'1px solid rgba(45,212,191,0.25)',display:'flex',alignItems:'center',justifyContent:'center'},
  logoTitle:{fontSize:20,fontWeight:800,color:'#F8FAFC',letterSpacing:'-0.5px'},
  logoSubtitle:{fontSize:9,fontWeight:600,color:'#2DD4BF',letterSpacing:'1.5px'},
  tabs:{display:'flex',background:'rgba(5,8,18,0.85)',borderRadius:12,padding:4,marginBottom:32,border:'1px solid rgba(56,66,92,0.45)'},
  tab:{flex:1,padding:'10px 0',fontSize:13,fontWeight:600,border:'none',borderRadius:8,cursor:'pointer',background:'transparent',color:'#94A3B8',transition:'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'},
  tabActive:{background:'rgba(45,212,191,0.1)',color:'#2DD4BF',boxShadow:'0 2px 10px rgba(0,0,0,0.3)'},
  form:{display:'flex',flexDirection:'column',gap:20},
  field:{display:'flex',flexDirection:'column',gap:8},
  label:{fontSize:12,fontWeight:600,color:'#94A3B8',letterSpacing:'0.3px'},
  inputWrap:{position:'relative',display:'flex',alignItems:'center'},
  inputIcon:{position:'absolute',left:14,pointerEvents:'none'},
  input:{width:'100%',padding:'12px 40px 12px 40px',background:'rgba(5,8,18,0.65)',border:'1px solid rgba(56,66,92,0.85)',borderRadius:10,fontSize:14,color:'#F8FAFC',outline:'none',boxSizing:'border-box',transition:'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',fontFamily:'"Inter",Arial,Helvetica,sans-serif'},
  eyeBtn:{position:'absolute',right:14,background:'none',border:'none',cursor:'pointer',padding:4,display:'flex',alignItems:'center'},
  errorBox:{background:'rgba(244,63,94,0.12)',border:'1px solid rgba(244,63,94,0.25)',borderRadius:8,padding:'11px 14px',fontSize:13,color:'#F43F5E',display:'flex',alignItems:'center',gap:8},
  submitBtn:{marginTop:6,padding:'14px 0',background:'linear-gradient(135deg,#2DD4BF 0%,#818CF8 100%)',border:'none',borderRadius:10,fontSize:14,fontWeight:600,color:'#050814',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',letterSpacing:'0.2px'},
  spinner:{width:18,height:18,border:'2px solid rgba(5,8,20,0.3)',borderTop:'2px solid #050814',borderRadius:'50%',display:'inline-block',animation:'spin 0.8s linear infinite'},
  toggleHint:{marginTop:24,textAlign:'center',fontSize:13,color:'#64748B'},
  toggleLink:{background:'none',border:'none',color:'#2DD4BF',cursor:'pointer',fontWeight:600,fontSize:13,textDecoration:'none',transition:'color 0.2s',borderBottom:'1px solid transparent'},
};
