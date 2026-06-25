import os
import json
from datetime import datetime, timedelta

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(CURRENT_DIR, 'db.json')

def init_db():
    dir_path = os.path.dirname(DB_PATH)
    if not os.path.exists(dir_path):
        os.makedirs(dir_path, exist_ok=True)
    if not os.path.exists(DB_PATH):
        with open(DB_PATH, 'w', encoding='utf-8') as f:
            json.dump({"applications": [], "profile": None}, f, indent=2)

def get_applications():
    init_db()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get("applications", [])
    except Exception as e:
        print(f"Error reading Lemma DataStore: {e}")
        return []

def save_application(app):
    init_db()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        applications = data.get("applications", [])
        
        # Populate defaults
        app_id = app.get("id") or f"app_{int(datetime.now().timestamp() * 1000)}"
        new_app = {
            "id": app_id,
            "company": app.get("company", "Unknown Company"),
            "role": app.get("role", "Software Engineer"),
            "status": app.get("status", "Applied"),
            "dateApplied": app.get("dateApplied") or datetime.utcnow().isoformat() + "Z",
            "matchScore": app.get("matchScore", 50),
            "effort": app.get("effort", "Medium"),
            "flag": app.get("flag", "Green"),
            "flagReason": app.get("flagReason", ""),
            "jdText": app.get("jdText", ""),
            "tailoredBullets": app.get("tailoredBullets", "[]"),
            "outreachMessages": app.get("outreachMessages") or {"confident": "", "curious": "", "concise": ""},
            "interviewQuestions": app.get("interviewQuestions") or [],
            "nudge3Dismissed": app.get("nudge3Dismissed", False),
            "nudge7Dismissed": app.get("nudge7Dismissed", False),
            "gaps": app.get("gaps") or []
        }
        
        # Merge other incoming keys
        for k, v in app.items():
            if k not in new_app:
                new_app[k] = v

        # Check if already exists
        index = -1
        for i, a in enumerate(applications):
            if a.get("id") == app_id:
                index = i
                break
        
        if index >= 0:
            applications[index] = new_app
        else:
            applications.append(new_app)
            
        data["applications"] = applications
        
        with open(DB_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
            
        return new_app
    except Exception as e:
        print(f"Error saving to Lemma DataStore: {e}")
        return None

def update_application(id, updates):
    init_db()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        applications = data.get("applications", [])
        index = -1
        for i, a in enumerate(applications):
            if a.get("id") == id:
                index = i
                break
                
        if index >= 0:
            applications[index].update(updates)
            data["applications"] = applications
            with open(DB_PATH, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
            return applications[index]
        return None
    except Exception as e:
        print(f"Error updating Lemma DataStore: {e}")
        return None

def delete_application(id):
    init_db()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        applications = data.get("applications", [])
        filtered = [a for a in applications if a.get("id") != id]
        data["applications"] = filtered
        
        with open(DB_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        return True
    except Exception as e:
        print(f"Error deleting from Lemma DataStore: {e}")
        return False

def get_profile():
    init_db()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get("profile")
    except Exception as e:
        print(f"Error reading Profile from Lemma DataStore: {e}")
        return None

def save_profile(profile):
    init_db()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        data["profile"] = profile
        with open(DB_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        return profile
    except Exception as e:
        print(f"Error saving Profile to Lemma DataStore: {e}")
        return None

def get_weekly_velocity():
    apps = get_applications()
    now = datetime.utcnow()
    one_week_ago = now - timedelta(days=7)
    
    count = 0
    for app in apps:
        date_str = app.get("dateApplied", "")
        if not date_str:
            continue
        try:
            # Parse ISO date string (strip trailing 'Z' if present for simplicity)
            clean_date_str = date_str.rstrip('Z')
            # Handle fraction of seconds if present
            if '.' in clean_date_str:
                date_obj = datetime.fromisoformat(clean_date_str.split('.')[0])
            else:
                date_obj = datetime.fromisoformat(clean_date_str)
                
            if date_obj >= one_week_ago:
                count += 1
        except Exception as parse_err:
            print(f"Error parsing date {date_str}: {parse_err}")
            
    return count

def get_active_nudges():
    apps = get_applications()
    now = datetime.utcnow()
    nudges = []
    
    for app in apps:
        if app.get("status") not in ["Applied", "Screening"]:
            continue
            
        date_str = app.get("dateApplied", "")
        if not date_str:
            continue
            
        try:
            clean_date_str = date_str.rstrip('Z')
            if '.' in clean_date_str:
                date_obj = datetime.fromisoformat(clean_date_str.split('.')[0])
            else:
                date_obj = datetime.fromisoformat(clean_date_str)
                
            diff_time = now - date_obj
            diff_days = diff_time.days
            
            # Day 3 Nudge
            if diff_days >= 3 and diff_days < 7 and not app.get("nudge3Dismissed", False):
                nudges.append({
                    "id": f"{app.get('id')}_nudge_3",
                    "appId": app.get("id"),
                    "company": app.get("company"),
                    "role": app.get("role"),
                    "type": "Day 3 Nudge",
                    "message": f"It has been {diff_days} days since you applied to {app.get('company')}. Time to send a gentle LinkedIn follow-up!"
                })
            
            # Day 7 Nudge
            if diff_days >= 7 and not app.get("nudge7Dismissed", False):
                nudges.append({
                    "id": f"{app.get('id')}_nudge_7",
                    "appId": app.get("id"),
                    "company": app.get("company"),
                    "role": app.get("role"),
                    "type": "Day 7 Nudge",
                    "message": f"It's been a week since you applied to {app.get('company')}. Consider reaching out to the hiring manager or recruiter again."
                })
        except Exception as parse_err:
            print(f"Error parsing date in nudge generation {date_str}: {parse_err}")
            
    return nudges
