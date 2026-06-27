'use client';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function ProfilePage() {
  const { theme, toggleTheme } = useTheme();
  const [name, setName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [resumeName, setResumeName] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [location, setLocation] = useState('');
  const [projects, setProjects] = useState('');
  const [hackathons, setHackathons] = useState('');
  const [goals, setGoals] = useState('');
  const [availability, setAvailability] = useState('');
  const [discoverable, setDiscoverable] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [showNetworkModal, setShowNetworkModal] = useState(null);
  const [networkUsers, setNetworkUsers] = useState([]);
  const [networkLoading, setNetworkLoading] = useState(false);
  const photoInputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const token = localStorage.getItem('careeros_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch(`${BACKEND_URL}/api/profile`, { headers });
        const data = await res.json();
        if (data.success && data.profile) {
          setName(data.profile.name || '');
          setTargetRole(data.profile.targetRole || '');
          setResumeName(data.profile.resumeName || '');
          setResumeText(data.profile.resumeText || '');
          setLocation(data.profile.location || '');
          setProjects(data.profile.projects || '');
          setHackathons(data.profile.hackathons || '');
          setGoals(data.profile.goals || '');
          setAvailability(data.profile.availability || '');
          setDiscoverable(data.profile.discoverable || false);
          setPhotoUrl(data.profile.photoUrl || '');
          setFollowers(data.profile.followers || []);
          setFollowing(data.profile.following || []);
        }
      } catch (err) {
        console.error('Profile load error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const token = localStorage.getItem('careeros_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      await fetch(`${BACKEND_URL}/api/profile`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          profile: { name, targetRole, resumeName, resumeText, location, projects, hackathons, goals, availability, discoverable }
        })
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Profile save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleResumeUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${BACKEND_URL}/api/parse-file`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || `Server error (${res.status})`);
      }
      if (data.success && data.text) {
        setResumeText(data.text);
        setResumeName(file.name);
        setUploadError('');
      } else {
        throw new Error('No text could be extracted from this file.');
      }
    } catch (err) {
      console.error('Resume upload error:', err);
      setUploadError(err.message || 'Failed to parse resume. Try a different file format.');
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    setPhotoUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const token = localStorage.getItem('careeros_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`${BACKEND_URL}/api/profile/photo`, {
        method: 'POST',
        headers,
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setPhotoUrl(data.photoUrl);
      } else {
        alert(data.detail || 'Failed to upload photo');
      }
    } catch (err) {
      console.error('Photo upload error:', err);
    } finally {
      setPhotoUploading(false);
    }
  };

  const openNetworkModal = async (type) => {
    const list = type === 'followers' ? followers : following;
    if (list.length === 0) return;
    setShowNetworkModal(type);
    setNetworkLoading(true);
    try {
      const token = localStorage.getItem('careeros_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`${BACKEND_URL}/api/network/users?emails=${list.join(',')}`, { headers });
      const data = await res.json();
      if (data.success) setNetworkUsers(data.profiles || []);
    } catch (err) {
      console.error('Error loading network users:', err);
    } finally {
      setNetworkLoading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleResumeUpload(e.dataTransfer.files[0]);
    }
  };

  if (loading) {
    return (
      <div className="page-transition p-8 max-w-2xl space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-12 w-full rounded-xl" />
        <div className="skeleton h-12 w-full rounded-xl" />
        <div className="skeleton h-32 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="page-transition p-8 max-w-2xl space-y-8 relative z-10">
      <div>
        <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">Profile & Settings</h1>
        <p className="text-on-surface-variant text-sm mt-1.5 font-medium">Manage your information. Your resume is stored once and used across all analyses.</p>
      </div>

      {/* Profile Header (Photo & Stats) */}
      <div className="flex items-center gap-6 p-6 card-static bg-surface-container-low/50 border-outline-variant/30">
        <div className="relative group shrink-0">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-primary to-secondary flex items-center justify-center border-4 border-surface shadow-lg">
            {photoUrl ? (
              <img src={photoUrl.startsWith('http') ? photoUrl : `${BACKEND_URL}${photoUrl}`} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-bold text-on-primary">{name ? name.charAt(0).toUpperCase() : '?'}</span>
            )}
          </div>
          <button 
            onClick={() => !photoUploading && photoInputRef.current?.click()}
            className="absolute inset-0 bg-black/60 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer"
          >
            {photoUploading ? (
              <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <>
                <span className="material-symbols-outlined text-xl">photo_camera</span>
                <span className="text-[10px] font-bold mt-1">Change</span>
              </>
            )}
          </button>
          <input 
            type="file" 
            ref={photoInputRef}
            onChange={(e) => { e.target.files?.[0] && handlePhotoUpload(e.target.files[0]); e.target.value = ''; }}
            accept="image/*" 
            className="hidden" 
          />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-extrabold text-on-surface truncate">{name || 'Your Name'}</h2>
          <p className="text-sm text-primary font-bold truncate">{targetRole || 'Add your target role below'}</p>
          <div className="flex gap-6 mt-3">
            <button onClick={() => openNetworkModal('followers')} className="text-center group flex items-center gap-2">
              <span className="text-lg font-extrabold text-on-surface group-hover:text-primary transition-colors">{followers.length}</span>
              <span className="text-xs font-bold text-muted uppercase tracking-wider">Followers</span>
            </button>
            <button onClick={() => openNetworkModal('following')} className="text-center group flex items-center gap-2">
              <span className="text-lg font-extrabold text-on-surface group-hover:text-primary transition-colors">{following.length}</span>
              <span className="text-xs font-bold text-muted uppercase tracking-wider">Following</span>
            </button>
          </div>
        </div>
      </div>

      {/* Theme Toggle */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-muted uppercase tracking-widest">Appearance</label>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="card-static px-4 py-2 flex items-center gap-2 hover:bg-surface-container/30 transition-all border-outline-variant/30 btn-hover cursor-pointer"
          >
            {theme === 'dark' ? (
              <span className="material-symbols-outlined text-warning text-xl">light_mode</span>
            ) : (
              <span className="material-symbols-outlined text-secondary text-xl">dark_mode</span>
            )}
            <span className="text-sm font-bold text-on-surface">
              {theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            </span>
          </button>
        </div>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-muted uppercase tracking-widest">Full Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Type here..."
          className="premium-input"
        />
      </div>

      {/* Target Role */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-muted uppercase tracking-widest">Dream Job / Target Role</label>
        <input
          type="text"
          value={targetRole}
          onChange={e => setTargetRole(e.target.value)}
          placeholder="Type here..."
          className="premium-input"
        />
      </div>

      {/* Networking Opt-in */}
      <div className="space-y-4 pt-4 border-t border-outline-variant/20">
        <div>
          <h2 className="text-xl font-bold text-on-surface">Career Connect</h2>
          <p className="text-sm text-on-surface-variant font-medium mt-1">Fill out these details to find peers, study groups, and hackathon teammates.</p>
        </div>
        
        <label className="flex items-start gap-3 p-4 card cursor-pointer border-outline-variant/30 hover:border-primary/50 transition-colors">
          <input 
            type="checkbox" 
            checked={discoverable}
            onChange={e => setDiscoverable(e.target.checked)}
            className="mt-1 w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary focus:ring-offset-surface-container"
          />
          <div>
            <p className="text-sm font-bold text-on-surface">Make my profile discoverable</p>
            <p className="text-xs text-on-surface-variant mt-0.5">Allow other CareerOS users to find and match with you for networking and peer interviews.</p>
          </div>
        </label>
      </div>

      {discoverable && (
        <div className="space-y-6 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-widest">Location</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. San Francisco, Remote, India"
                className="premium-input"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-widest">Availability</label>
              <input
                type="text"
                value={availability}
                onChange={e => setAvailability(e.target.value)}
                placeholder="e.g. Weekends, Evenings, PST"
                className="premium-input"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">Current Goals</label>
            <textarea
              value={goals}
              onChange={e => setGoals(e.target.value)}
              placeholder="e.g. Complete 100 Leetcode questions, Learn FastAPI, Prepare for GATE..."
              className="premium-input min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">Top Projects</label>
            <textarea
              value={projects}
              onChange={e => setProjects(e.target.value)}
              placeholder="e.g. Built an AI Interview platform using Next.js and Groq..."
              className="premium-input min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">Hackathons</label>
            <textarea
              value={hackathons}
              onChange={e => setHackathons(e.target.value)}
              placeholder="e.g. Attending HackTX next month, looking for teammates..."
              className="premium-input min-h-[80px]"
            />
          </div>
        </div>
      )}

      {/* Resume Upload — always supports drag-and-drop */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-muted uppercase tracking-widest">Base Resume</label>
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`card-static p-10 flex flex-col items-center gap-3.5 cursor-pointer transition-all border-dashed ${
            dragActive
              ? 'border-primary bg-primary/8 shadow-lg shadow-primary/4'
              : 'border-outline hover:border-primary/40 hover:bg-surface-container/20'
          }`}
        >
          {uploading ? (
            <>
              <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              <p className="text-sm font-semibold text-on-surface">Parsing resume...</p>
              <p className="text-xs text-on-surface-variant">Extracting text and analyzing details</p>
            </>
          ) : resumeName ? (
            <>
              <span className="material-symbols-outlined text-primary text-4xl filter drop-shadow-[0_0_8px_rgba(45,212,191,0.3)]">description</span>
              <p className="text-sm font-bold text-on-surface">{resumeName}</p>
              <p className="text-xs text-success font-semibold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Resume uploaded and parsed successfully
              </p>
              <p className="text-[10px] text-muted font-bold uppercase tracking-wider mt-1.5">Drop a new file or click to replace</p>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-muted text-4xl">upload_file</span>
              <p className="text-sm font-bold text-on-surface">Drop your resume here or click to browse</p>
              <p className="text-xs text-on-surface-variant">Supports PDF, DOCX, TXT, images & screenshots</p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.doc,.docx,.jpg,.jpeg,.png,.webp,.bmp,.tiff,.tif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
          onChange={e => { e.target.files?.[0] && handleResumeUpload(e.target.files[0]); e.target.value = ''; }}
          className="hidden"
        />

        {/* Upload Error */}
        {uploadError && (
          <div className="card-static p-3.5 border-error/20 bg-error/8 flex items-center gap-2">
            <span className="material-symbols-outlined text-error text-sm shrink-0">error</span>
            <p className="text-xs text-error font-medium flex-1">{uploadError}</p>
            <button onClick={() => setUploadError('')} className="text-error/60 hover:text-error shrink-0">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-4 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-gradient-to-r from-primary to-secondary text-on-primary rounded-lg text-sm font-bold shadow-lg shadow-primary/25 btn-hover disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
        {saved && (
          <span className="text-success text-sm font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            Profile saved
          </span>
        )}
      </div>

      {/* Network Modal */}
      {showNetworkModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowNetworkModal(null)}>
          <div className="card-static bg-surface w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden shadow-2xl border-outline-variant/30" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container/30">
              <h3 className="text-lg font-extrabold text-on-surface capitalize">{showNetworkModal}</h3>
              <button onClick={() => setShowNetworkModal(null)} className="p-1.5 rounded-lg hover:bg-surface-container text-muted hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            
            <div className="p-2 overflow-y-auto custom-scrollbar flex-1">
              {networkLoading ? (
                <div className="p-8 flex justify-center">
                  <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
              ) : networkUsers.length === 0 ? (
                <div className="p-8 text-center">
                  <span className="material-symbols-outlined text-muted text-4xl">group_off</span>
                  <p className="text-sm font-bold text-on-surface mt-2">No users found.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {networkUsers.map((user, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 hover:bg-surface-container/30 rounded-lg transition-colors">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary to-secondary flex items-center justify-center border border-outline-variant/30 shrink-0">
                        {user.photoUrl ? (
                          <img src={user.photoUrl.startsWith('http') ? user.photoUrl : `${BACKEND_URL}${user.photoUrl}`} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-on-primary">{user.name ? user.name.charAt(0).toUpperCase() : '?'}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-extrabold text-on-surface truncate">{user.name || user.email}</p>
                        <p className="text-xs text-primary font-bold truncate">{user.targetRole}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
