import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'src', 'lib', 'lemma', 'db.json');

// Ensure the DB file exists
function initDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ applications: [], profile: null }, null, 2));
  }
}

export function getApplications() {
  initDb();
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data).applications || [];
  } catch (error) {
    console.error('Error reading Lemma DataStore:', error);
    return [];
  }
}

export function saveApplication(app) {
  initDb();
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    const applications = data.applications || [];
    
    // Add unique ID and timestamp if not present
    const newApp = {
      id: app.id || `app_${Date.now()}`,
      company: app.company || 'Unknown Company',
      role: app.role || 'Software Engineer',
      status: app.status || 'Applied',
      dateApplied: app.dateApplied || new Date().toISOString(),
      matchScore: app.matchScore || 50,
      effort: app.effort || 'Medium',
      flag: app.flag || 'Green',
      flagReason: app.flagReason || '',
      jdText: app.jdText || '',
      tailoredBullets: app.tailoredBullets || '',
      outreachMessages: app.outreachMessages || { confident: '', curious: '', concise: '' },
      interviewQuestions: app.interviewQuestions || [],
      nudge3Dismissed: false,
      nudge7Dismissed: false,
      ...app
    };

    // Check if it already exists, if so update, else push
    const index = applications.findIndex(a => a.id === newApp.id);
    if (index >= 0) {
      applications[index] = newApp;
    } else {
      applications.push(newApp);
    }

    data.applications = applications;
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    return newApp;
  } catch (error) {
    console.error('Error saving to Lemma DataStore:', error);
    return null;
  }
}

export function updateApplication(id, updates) {
  initDb();
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    const applications = data.applications || [];
    const index = applications.findIndex(a => a.id === id);
    if (index >= 0) {
      applications[index] = { ...applications[index], ...updates };
      data.applications = applications;
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
      return applications[index];
    }
    return null;
  } catch (error) {
    console.error('Error updating Lemma DataStore:', error);
    return null;
  }
}

export function deleteApplication(id) {
  initDb();
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    const applications = data.applications || [];
    const filtered = applications.filter(a => a.id !== id);
    data.applications = filtered;
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error deleting from Lemma DataStore:', error);
    return false;
  }
}

export function getProfile() {
  initDb();
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data).profile || null;
  } catch (error) {
    console.error('Error reading Profile from Lemma DataStore:', error);
    return null;
  }
}

export function saveProfile(profile) {
  initDb();
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    data.profile = profile;
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    return profile;
  } catch (error) {
    console.error('Error saving Profile to Lemma DataStore:', error);
    return null;
  }
}

// Helper to compute weekly application velocity
export function getWeeklyVelocity() {
  const apps = getApplications();
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  return apps.filter(app => {
    const date = new Date(app.dateApplied);
    return date >= oneWeekAgo;
  }).length;
}

// Helper to compute active follow-up nudges
export function getActiveNudges() {
  const apps = getApplications();
  const now = new Date();
  const nudges = [];

  apps.forEach(app => {
    // Only nudge if they are in "Applied" or "Screening" status
    if (app.status !== 'Applied' && app.status !== 'Screening') return;

    const dateApplied = new Date(app.dateApplied);
    const diffTime = Math.abs(now - dateApplied);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Day 3 Nudge
    if (diffDays >= 3 && diffDays < 7 && !app.nudge3Dismissed) {
      nudges.push({
        id: `${app.id}_nudge_3`,
        appId: app.id,
        company: app.company,
        role: app.role,
        type: 'Day 3 Nudge',
        message: `It has been ${diffDays} days since you applied to ${app.company}. Time to send a gentle LinkedIn follow-up!`,
      });
    }

    // Day 7 Nudge
    if (diffDays >= 7 && !app.nudge7Dismissed) {
      nudges.push({
        id: `${app.id}_nudge_7`,
        appId: app.id,
        company: app.company,
        role: app.role,
        type: 'Day 7 Nudge',
        message: `It's been a week since you applied to ${app.company}. Consider reaching out to the hiring manager or recruiter again.`,
      });
    }
  });

  return nudges;
}
