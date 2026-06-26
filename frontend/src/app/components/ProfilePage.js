'use client';
import { useState, useEffect, useRef } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function ProfilePage() {
  const [name, setName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [resumeName, setResumeName] = useState('');
  const [resumeText, setResumeText] = useState('');
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
          profile: { name, targetRole, resumeName, resumeText }
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
    </div>
  );
}
