import os
import json
import time
import uuid
from datetime import datetime, timedelta

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(CURRENT_DIR, 'db.json')

def init_db():
    dir_path = os.path.dirname(DB_PATH)
    if not os.path.exists(dir_path):
        os.makedirs(dir_path, exist_ok=True)
    if not os.path.exists(DB_PATH):
        with open(DB_PATH, 'w', encoding='utf-8') as f:
            json.dump({"user_data": {}}, f, indent=2)

def get_user_data(user_email: str):
    init_db()
    user_email = user_email.lower()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        user_data = data.setdefault("user_data", {})
        if user_email not in user_data:
            # If this is the first time we see this user, and we have legacy root data, migrate it!
            legacy_apps = data.get("applications", [])
            legacy_profile = data.get("profile")
            
            user_data[user_email] = {
                "applications": legacy_apps,
                "profile": legacy_profile
            }
            # Clean up legacy root data
            if "applications" in data:
                del data["applications"]
            if "profile" in data:
                del data["profile"]
            
            # Save the migrated DB
            with open(DB_PATH, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
        
        return user_data[user_email], data
    except Exception as e:
        print(f"Error reading user data: {e}")
        return {"applications": [], "profile": None}, {"user_data": {}}

def save_user_data(user_email: str, user_dict, full_data):
    init_db()
    user_email = user_email.lower()
    try:
        full_data.setdefault("user_data", {})[user_email] = user_dict
        with open(DB_PATH, 'w', encoding='utf-8') as f:
            json.dump(full_data, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving user data: {e}")
        return False

def get_applications(user_email: str):
    user_dict, _ = get_user_data(user_email)
    return user_dict.get("applications", [])

def save_application(user_email: str, app):
    user_dict, full_data = get_user_data(user_email)
    applications = user_dict.get("applications", [])
    
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
        
    user_dict["applications"] = applications
    save_user_data(user_email, user_dict, full_data)
    return new_app

def update_application(user_email: str, id, updates):
    user_dict, full_data = get_user_data(user_email)
    applications = user_dict.get("applications", [])
    index = -1
    for i, a in enumerate(applications):
        if a.get("id") == id:
            index = i
            break
            
    if index >= 0:
        applications[index].update(updates)
        user_dict["applications"] = applications
        save_user_data(user_email, user_dict, full_data)
        return applications[index]
    return None

def delete_application(user_email: str, id):
    user_dict, full_data = get_user_data(user_email)
    applications = user_dict.get("applications", [])
    filtered = [a for a in applications if a.get("id") != id]
    user_dict["applications"] = filtered
    save_user_data(user_email, user_dict, full_data)
    return True

def get_profile(user_email: str):
    user_dict, _ = get_user_data(user_email)
    return user_dict.get("profile")

def save_profile(user_email: str, profile):
    user_dict, full_data = get_user_data(user_email)
    user_dict["profile"] = profile
    save_user_data(user_email, user_dict, full_data)
    return profile

def get_weekly_velocity(user_email: str):
    apps = get_applications(user_email)
    now = datetime.utcnow()
    one_week_ago = now - timedelta(days=7)
    
    count = 0
    for app in apps:
        date_str = app.get("dateApplied", "")
        if not date_str:
            continue
        try:
            clean_date_str = date_str.rstrip('Z')
            if '.' in clean_date_str:
                date_obj = datetime.fromisoformat(clean_date_str.split('.')[0])
            else:
                date_obj = datetime.fromisoformat(clean_date_str)
                
            if date_obj >= one_week_ago:
                count += 1
        except Exception as parse_err:
            print(f"Error parsing date {date_str}: {parse_err}")
            
    return count

def get_active_nudges(user_email: str):
    apps = get_applications(user_email)
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

def get_discoverable_profiles(exclude_email: str):
    init_db()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        user_data = data.get("user_data", {})
        profiles = []
        for email, udata in user_data.items():
            if email.lower() == exclude_email.lower():
                continue
            profile = udata.get("profile")
            if profile and profile.get("discoverable") is True:
                profile_copy = profile.copy()
                profile_copy["email"] = email
                profiles.append(profile_copy)
        return profiles
    except Exception as e:
        print(f"Error reading discoverable profiles: {e}")
        return []

def follow_user(follower_email: str, target_email: str):
    follower_dict, full_data = get_user_data(follower_email)
    follower_profile = follower_dict.get("profile") or {}
    following = set(follower_profile.get("following", []))
    following.add(target_email.lower())
    follower_profile["following"] = list(following)
    follower_dict["profile"] = follower_profile
    full_data.setdefault("user_data", {})[follower_email.lower()] = follower_dict
    
    target_email = target_email.lower()
    target_dict = full_data.setdefault("user_data", {}).setdefault(target_email, {"applications": [], "profile": {}})
    target_profile = target_dict.get("profile") or {}
    followers = set(target_profile.get("followers", []))
    followers.add(follower_email.lower())
    target_profile["followers"] = list(followers)
    target_dict["profile"] = target_profile
    full_data["user_data"][target_email] = target_dict
    
    with open(DB_PATH, 'w', encoding='utf-8') as f:
        json.dump(full_data, f, indent=2)
    return True

def unfollow_user(follower_email: str, target_email: str):
    follower_dict, full_data = get_user_data(follower_email)
    follower_profile = follower_dict.get("profile") or {}
    following = set(follower_profile.get("following", []))
    if target_email.lower() in following:
        following.remove(target_email.lower())
    follower_profile["following"] = list(following)
    follower_dict["profile"] = follower_profile
    full_data.setdefault("user_data", {})[follower_email.lower()] = follower_dict
    
    target_email = target_email.lower()
    target_dict = full_data.setdefault("user_data", {}).setdefault(target_email, {"applications": [], "profile": {}})
    target_profile = target_dict.get("profile") or {}
    followers = set(target_profile.get("followers", []))
    if follower_email.lower() in followers:
        followers.remove(follower_email.lower())
    target_profile["followers"] = list(followers)
    target_dict["profile"] = target_profile
    full_data["user_data"][target_email] = target_dict
    
    with open(DB_PATH, 'w', encoding='utf-8') as f:
        json.dump(full_data, f, indent=2)
    return True

def search_profiles(query: str, exclude_email: str):
    init_db()
    query = query.lower()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        user_data = data.get("user_data", {})
        profiles = []
        for email, udata in user_data.items():
            if email.lower() == exclude_email.lower():
                continue
            profile = udata.get("profile")
            if profile and profile.get("discoverable") is True:
                name = profile.get("name", "").lower()
                if query in name:
                    profile_copy = profile.copy()
                    profile_copy["email"] = email
                    profiles.append(profile_copy)
        return profiles
    except Exception as e:
        print(f"Error searching profiles: {e}")
        return []

def get_profiles_by_emails(emails: list):
    init_db()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        user_data = data.get("user_data", {})
        profiles = []
        emails_lower = [e.lower() for e in emails]
        for email, udata in user_data.items():
            if email.lower() in emails_lower:
                profile = udata.get("profile") or {}
                profile_copy = profile.copy()
                profile_copy["email"] = email
                profiles.append(profile_copy)
        return profiles
    except Exception as e:
        print(f"Error fetching profiles: {e}")
        return []

def get_chat_room_id(email1: str, email2: str) -> str:
    emails = sorted([email1.lower(), email2.lower()])
    return f"{emails[0]}_{emails[1]}"

def save_chat_message(sender: str, receiver: str, text: str, media_urls: list = None):
    init_db()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        chats = data.setdefault("chats", {})
        room_id = get_chat_room_id(sender, receiver)
        room_messages = chats.setdefault(room_id, [])
        
        msg = {
            "id": f"msg_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}",
            "sender": sender.lower(),
            "receiver": receiver.lower(),
            "text": text,
            "mediaUrls": media_urls or [],
            "timestamp": int(time.time() * 1000)
        }
        room_messages.append(msg)
        
        with open(DB_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        return msg
    except Exception as e:
        print(f"Error saving chat message: {e}")
        return None

def get_chat_history(user1: str, user2: str):
    init_db()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        chats = data.get("chats", {})
        room_id = get_chat_room_id(user1, user2)
        return chats.get(room_id, [])
    except Exception as e:
        print(f"Error fetching chat history: {e}")
        return []

def get_conversations(email: str):
    """Get all unique users the given email has chatted with, with last message preview."""
    init_db()
    email = email.lower()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        chats = data.get("chats", {})
        conversations = {}
        for room_id, messages in chats.items():
            parts = room_id.split("_")
            if email in parts:
                other = parts[0] if parts[1] == email else parts[1]
                if messages:
                    last = messages[-1]
                    conversations[other] = {
                        "lastMessage": last.get("text", ""),
                        "timestamp": last.get("timestamp", 0),
                        "sender": last.get("sender", "")
                    }
        # Sort by timestamp descending
        sorted_convs = sorted(conversations.items(), key=lambda x: x[1]["timestamp"], reverse=True)
        return [{"email": email, **data} for email, data in sorted_convs]
    except Exception as e:
        print(f"Error fetching conversations: {e}")
        return []

# --- Company Discovery ---

COMPANIES_DB_PATH = os.path.join(CURRENT_DIR, 'companies.json')

def init_companies_db():
    if not os.path.exists(COMPANIES_DB_PATH):
        default_companies = {
            "companies": [
                {"id": "c1", "name": "Google", "industry": "Technology", "location": "Mountain View, CA", "website": "https://careers.google.com", "description": "Search, cloud computing, AI, and more."},
                {"id": "c2", "name": "Microsoft", "industry": "Technology", "location": "Redmond, WA", "website": "https://careers.microsoft.com", "description": "Software, cloud, AI, and enterprise solutions."},
                {"id": "c3", "name": "Amazon", "industry": "Technology / E-commerce", "location": "Seattle, WA", "website": "https://amazon.jobs", "description": "E-commerce, cloud computing (AWS), AI, logistics."},
                {"id": "c4", "name": "Meta", "industry": "Technology / Social Media", "location": "Menlo Park, CA", "website": "https://metacareers.com", "description": "Social media, AR/VR, AI, connectivity."},
                {"id": "c5", "name": "Apple", "industry": "Technology / Consumer Electronics", "location": "Cupertino, CA", "website": "https://apple.com/careers", "description": "Consumer electronics, software, services."},
                {"id": "c6", "name": "Netflix", "industry": "Entertainment / Streaming", "location": "Los Gatos, CA", "website": "https://jobs.netflix.com", "description": "Streaming entertainment, content production."},
                {"id": "c7", "name": "Tesla", "industry": "Automotive / Energy", "location": "Austin, TX", "website": "https://tesla.com/careers", "description": "Electric vehicles, solar energy, battery tech."},
                {"id": "c8", "name": "Goldman Sachs", "industry": "Finance / Banking", "location": "New York, NY", "website": "https://goldmansachs.com/careers", "description": "Investment banking, asset management, fintech."},
                {"id": "c9", "name": "JPMorgan Chase", "industry": "Finance / Banking", "location": "New York, NY", "website": "https://jpmorganchase.com/careers", "description": "Banking, financial services, technology."},
                {"id": "c10", "name": "Stripe", "industry": "Fintech", "location": "San Francisco, CA", "website": "https://stripe.com/jobs", "description": "Online payment processing, financial infrastructure."},
                {"id": "c11", "name": "Airbnb", "industry": "Hospitality / Technology", "location": "San Francisco, CA", "website": "https://airbnb.com/careers", "description": "Short-term lodging, experiences, travel."},
                {"id": "c12", "name": "Uber", "industry": "Transportation / Technology", "location": "San Francisco, CA", "website": "https://uber.com/careers", "description": "Ride-hailing, food delivery, freight."},
                {"id": "c13", "name": "Salesforce", "industry": "Enterprise Software / CRM", "location": "San Francisco, CA", "website": "https://salesforce.com/company/careers", "description": "CRM, enterprise cloud, AI (Einstein)."},
                {"id": "c14", "name": "Atlassian", "industry": "Enterprise Software", "location": "Sydney, Australia / Global", "website": "https://atlassian.com/company/careers", "description": "Team collaboration, Jira, Confluence."},
                {"id": "c15", "name": "Spotify", "industry": "Music / Audio Streaming", "location": "Stockholm, Sweden / Global", "website": "https://spotify.com/careers", "description": "Music streaming, podcasting, audio tech."}
            ]
        }
        with open(COMPANIES_DB_PATH, 'w', encoding='utf-8') as f:
            json.dump(default_companies, f, indent=2)
    return COMPANIES_DB_PATH

def get_companies(search: str = ""):
    init_companies_db()
    try:
        with open(COMPANIES_DB_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        companies = data.get("companies", [])
        if search:
            q = search.lower()
            companies = [c for c in companies if q in c["name"].lower() or q in c["industry"].lower() or q in c.get("location", "").lower()]
        return companies
    except Exception as e:
        print(f"Error reading companies: {e}")
        return []

def save_company_interest(user_email: str, company_id: str):
    init_db()
    user_email = user_email.lower()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        interests = data.setdefault("company_interests", {})
        user_interests = interests.setdefault(user_email, [])
        if company_id not in user_interests:
            user_interests.append(company_id)
        with open(DB_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving company interest: {e}")
        return False

def get_user_company_interests(user_email: str):
    init_db()
    user_email = user_email.lower()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        interests = data.get("company_interests", {})
        return interests.get(user_email, [])
    except Exception as e:
        print(f"Error fetching company interests: {e}")
        return []
