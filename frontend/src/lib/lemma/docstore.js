import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'src', 'lib', 'lemma', 'db.json');

function initDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ applications: [], profile: null }, null, 2));
  }
}

export function getResume() {
  initDb();
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    return data.profile?.resume || '';
  } catch (error) {
    console.error('Error fetching resume from Lemma DocStore:', error);
    return '';
  }
}

export function saveResume(resumeText) {
  initDb();
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    if (!data.profile) {
      data.profile = {};
    }
    data.profile.resume = resumeText;
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving resume to Lemma DocStore:', error);
    return false;
  }
}

export function getTailoredResume(appId) {
  initDb();
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    const applications = data.applications || [];
    const app = applications.find(a => a.id === appId);
    return app ? app.tailoredBullets : '';
  } catch (error) {
    console.error('Error fetching tailored resume from Lemma DocStore:', error);
    return '';
  }
}

export function saveTailoredResume(appId, tailoredBullets) {
  initDb();
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    const applications = data.applications || [];
    const index = applications.findIndex(a => a.id === appId);
    if (index >= 0) {
      applications[index].tailoredBullets = tailoredBullets;
      data.applications = applications;
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error saving tailored resume to Lemma DocStore:', error);
    return false;
  }
}
