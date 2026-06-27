'use client';
import { useState, useEffect } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function CareerConnectPage({ onNavigate }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [introLoading, setIntroLoading] = useState({});
  const [intros, setIntros] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [currentUserFollowing, setCurrentUserFollowing] = useState([]);

  useEffect(() => {
    loadMatches();
    loadCurrentUserProfile();
  }, []);

  async function loadCurrentUserProfile() {
    try {
      const token = localStorage.getItem('careeros_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`${BACKEND_URL}/api/profile`, { headers });
      const data = await res.json();
      if (data.success && data.profile) {
        setCurrentUserFollowing(data.profile.following || []);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function loadMatches() {
    try {
      const token = localStorage.getItem('careeros_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`${BACKEND_URL}/api/network/matches`, { headers });
      const data = await res.json();
      
      if (data.success) {
        if (data.message) {
          setError(data.message);
        } else {
          setMatches(data.matches || []);
        }
      } else {
        setError(data.detail || 'Failed to load matches');
      }
    } catch (err) {
      console.error('Match loading error:', err);
      setError('An error occurred while fetching your network matches.');
    } finally {
      setLoading(false);
    }
  }

  const generateIntro = async (targetEmail) => {
    setIntroLoading(prev => ({ ...prev, [targetEmail]: true }));
    try {
      const token = localStorage.getItem('careeros_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      
      const res = await fetch(`${BACKEND_URL}/api/network/intro`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ targetEmail })
      });
      const data = await res.json();
      
      if (data.success) {
        setIntros(prev => ({ ...prev, [targetEmail]: data.intro }));
      }
    } catch (err) {
      console.error('Intro generation error:', err);
    } finally {
      setIntroLoading(prev => ({ ...prev, [targetEmail]: false }));
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const token = localStorage.getItem('careeros_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`${BACKEND_URL}/api/network/search?q=${encodeURIComponent(searchQuery)}`, { headers });
      const data = await res.json();
      if (data.success) setSearchResults(data.profiles || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const toggleFollow = async (targetEmail) => {
    const isFollowing = currentUserFollowing.includes(targetEmail.toLowerCase());
    const endpoint = isFollowing ? '/api/network/unfollow' : '/api/network/follow';
    
    if (isFollowing) {
      setCurrentUserFollowing(prev => prev.filter(e => e !== targetEmail.toLowerCase()));
    } else {
      setCurrentUserFollowing(prev => [...prev, targetEmail.toLowerCase()]);
    }

    try {
      const token = localStorage.getItem('careeros_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ targetEmail })
      });
    } catch (e) {
      console.error(e);
      if (isFollowing) {
        setCurrentUserFollowing(prev => [...prev, targetEmail.toLowerCase()]);
      } else {
        setCurrentUserFollowing(prev => prev.filter(e => e !== targetEmail.toLowerCase()));
      }
    }
  };

  const copyIntro = (targetEmail) => {
    const text = intros[targetEmail];
    if (text) {
      navigator.clipboard.writeText(text);
      // Brief visual feedback could go here
    }
  };

  if (loading) {
    return (
      <div className="page-transition p-8 max-w-5xl space-y-6">
        <div className="skeleton h-10 w-64" />
        <div className="skeleton h-6 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-48 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="page-transition p-8 max-w-5xl space-y-8 relative z-10">
      <div>
        <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">
          <span className="text-gradient-primary">Career Connect</span>
        </h1>
        <p className="text-on-surface-variant text-sm mt-1.5 font-medium">
          Find peers with complementary goals, study groups, and hackathon teammates.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-muted">search</span>
          <input 
            type="text" 
            placeholder="Search for peers by name..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-surface-container/50 border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:outline-none focus:border-primary/50 focus:bg-surface-container transition-all"
          />
        </div>
        <button type="submit" disabled={searching} className="px-6 py-3 bg-primary text-on-primary rounded-xl text-sm font-bold shadow-lg shadow-primary/25 btn-hover disabled:opacity-50 flex items-center gap-2">
          {searching ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : 'Search'}
        </button>
      </form>

      {searchResults.length > 0 && (
        <div className="space-y-4 mb-10">
          <h2 className="text-xl font-extrabold text-on-surface">Search Results</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {searchResults.map((user, idx) => {
              const isFollowing = currentUserFollowing.includes(user.email.toLowerCase());
              return (
              <div key={idx} className="card-static flex flex-col border-outline-variant/30 overflow-hidden hover:border-primary/40 transition-colors">
                <div className="p-5 flex items-center justify-between bg-surface-container-low/30">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-on-primary font-bold shadow-inner">
                      {user.photoUrl ? (
                        <img src={user.photoUrl.startsWith('http') ? user.photoUrl : `${BACKEND_URL}${user.photoUrl}`} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg">{user.name ? user.name.charAt(0).toUpperCase() : '?'}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-on-surface">{user.name || user.email}</p>
                      <p className="text-[11px] text-primary font-bold uppercase tracking-wider">{user.targetRole || 'Peer'}</p>
                    </div>
                  </div>
                  <button onClick={() => toggleFollow(user.email)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${isFollowing ? 'bg-surface-container text-on-surface hover:bg-surface-container-high border border-outline-variant/30' : 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'}`}>
                    {isFollowing ? 'Following' : 'Add Friend'}
                  </button>
                </div>
              </div>
            )})}
          </div>
        </div>
      )}

      {error ? (
        <div className="card-static p-12 flex flex-col items-center gap-4 text-center border-dashed">
          <span className="material-symbols-outlined text-muted text-5xl">visibility_off</span>
          <h2 className="text-lg font-bold text-on-surface mt-2">Opt-in Required</h2>
          <p className="text-sm text-on-surface-variant font-medium max-w-md">
            {error}
          </p>
          <button 
            onClick={() => onNavigate?.('profile')}
            className="mt-4 px-6 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold shadow-lg shadow-primary/25 btn-hover"
          >
            Update Profile Settings
          </button>
        </div>
      ) : matches.length === 0 ? (
        <div className="card-static p-12 flex flex-col items-center gap-4 text-center border-dashed">
          <span className="material-symbols-outlined text-muted text-5xl">group_off</span>
          <h2 className="text-lg font-bold text-on-surface mt-2">No Matches Found</h2>
          <p className="text-sm text-on-surface-variant font-medium max-w-md">
            We couldn't find any peers that match your current profile criteria. Try updating your goals, skills, and hackathons to cast a wider net!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card-static p-5 border-l-4 border-l-secondary bg-secondary/2">
            <div className="flex items-start gap-3.5">
              <span className="material-symbols-outlined text-secondary text-xl shrink-0 mt-0.5">auto_awesome</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-on-surface">AI Matchmaking Active</p>
                <p className="text-xs text-on-surface-variant mt-1.5 font-medium">
                  We scanned other discoverable users and found {matches.length} strong peers for you based on complementary skills and shared goals.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {matches.map((match, idx) => {
              const isFollowing = currentUserFollowing.includes(match.email.toLowerCase());
              return (
              <div key={idx} className="card-static flex flex-col border-outline-variant/30 overflow-hidden hover:border-primary/40 transition-colors">
                <div className="p-5 border-b border-outline-variant/15 flex items-center justify-between bg-surface-container-low/30">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-on-primary font-bold shadow-inner">
                      {match.photoUrl ? (
                        <img src={match.photoUrl.startsWith('http') ? match.photoUrl : `${BACKEND_URL}${match.photoUrl}`} alt={match.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg">{match.name ? match.name.charAt(0).toUpperCase() : '?'}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-on-surface">{match.name || match.email}</p>
                      <p className="text-[11px] text-primary font-bold uppercase tracking-wider">{match.role}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end mr-2">
                        <span className="text-xl font-extrabold text-on-surface tracking-tighter">{match.score}%</span>
                        <span className="text-[9px] text-muted font-bold uppercase tracking-widest">Match</span>
                      </div>
                      <button onClick={() => toggleFollow(match.email)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isFollowing ? 'bg-surface-container text-on-surface hover:bg-surface-container-high border border-outline-variant/30' : 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'}`}>
                        {isFollowing ? 'Following' : 'Add Friend'}
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="p-5 flex-1 flex flex-col space-y-4">
                  <div>
                    <h4 className="text-[10px] font-extrabold text-muted uppercase tracking-widest mb-2">Why you match</h4>
                    <ul className="space-y-2">
                      {match.reasons?.map((reason, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-success text-[14px] mt-0.5">check_circle</span>
                          <span className="text-xs text-on-surface-variant font-medium leading-relaxed">{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-auto pt-4 border-t border-outline-variant/15">
                    {intros[match.email] ? (
                      <div className="space-y-3">
                        <div className="p-3 bg-surface-container-high rounded-lg border border-outline-variant/20 relative group">
                          <p className="text-xs text-on-surface leading-relaxed whitespace-pre-wrap">{intros[match.email]}</p>
                          <button 
                            onClick={() => copyIntro(match.email)}
                            className="absolute top-2 right-2 p-1.5 rounded bg-surface-container hover:bg-surface-container-highest text-muted hover:text-on-surface transition-colors opacity-0 group-hover:opacity-100"
                            title="Copy to clipboard"
                          >
                            <span className="material-symbols-outlined text-sm">content_copy</span>
                          </button>
                        </div>
                        <a 
                          href={`mailto:${match.email}?subject=CareerOS Connection&body=${encodeURIComponent(intros[match.email])}`}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-surface-container-highest text-on-surface text-xs font-bold hover:bg-surface-container-highest/80 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">mail</span>
                          Send Email
                        </a>
                      </div>
                    ) : (
                      <button
                        onClick={() => generateIntro(match.email)}
                        disabled={introLoading[match.email]}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 text-xs font-bold transition-all disabled:opacity-50"
                      >
                        {introLoading[match.email] ? (
                          <>
                            <div className="w-3.5 h-3.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                            Drafting Intro...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                            Generate AI Intro
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )})}
          </div>
        </div>
      )}
    </div>
  );
}
