import os
import json
import time
import uuid
from datetime import datetime, timedelta

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(CURRENT_DIR, 'db.json')

USE_LEMMA = os.environ.get("LEMMA_POD_ID") is not None

_lemma_client = None

def _get_lemma_client():
    global _lemma_client
    if _lemma_client is None and USE_LEMMA:
        from lemma_sdk import Lemma
        pod_id = os.environ["LEMMA_POD_ID"]
        api_url = os.environ.get("LEMMA_API_URL", "https://api.lemma.work")
        _lemma_client = Lemma(pod_id=pod_id, api_url=api_url)
    return _lemma_client

async def _lemma_list(table):
    client = _get_lemma_client()
    if not client:
        return []
    records = await client.records.list(table)
    return [r.data for r in records]

async def _lemma_create(table, data):
    client = _get_lemma_client()
    if not client:
        return None
    record = await client.records.create(table, data)
    return record.data

async def _lemma_update(table, id, data):
    client = _get_lemma_client()
    if not client:
        return None
    record = await client.records.update(table, id, data)
    return record.data

async def _lemma_delete(table, id):
    client = _get_lemma_client()
    if not client:
        return False
    await client.records.delete(table, id)
    return True

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
            legacy_apps = data.get("applications", [])
            legacy_profile = data.get("profile")
            user_data[user_email] = {"applications": legacy_apps, "profile": legacy_profile}
            if "applications" in data: del data["applications"]
            if "profile" in data: del data["profile"]
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
    if USE_LEMMA:
        import asyncio
        try:
            return asyncio.run(_lemma_list("applications"))
        except Exception as e:
            print(f"Lemma get_applications failed, falling back to JSON: {e}")
    user_dict, _ = get_user_data(user_email)
    return user_dict.get("applications", [])

def save_application(user_email: str, app):
    if USE_LEMMA:
        import asyncio
        try:
            result = asyncio.run(_lemma_create("applications", app))
            if result:
                return result
        except Exception as e:
            print(f"Lemma save_application failed, falling back: {e}")
    user_dict, full_data = get_user_data(user_email)
    applications = user_dict.get("applications", [])
    app_id = app.get("id") or f"app_{int(datetime.now().timestamp() * 1000)}"
    new_app = {
        "id": app_id, "company": app.get("company", "Unknown Company"),
        "role": app.get("role", "Software Engineer"), "status": app.get("status", "Applied"),
        "dateApplied": app.get("dateApplied") or datetime.utcnow().isoformat() + "Z",
        "matchScore": app.get("matchScore", 50), "effort": app.get("effort", "Medium"),
        "flag": app.get("flag", "Green"), "flagReason": app.get("flagReason", ""),
        "jdText": app.get("jdText", ""), "tailoredBullets": app.get("tailoredBullets", "[]"),
        "outreachMessages": app.get("outreachMessages") or {"confident": "", "curious": "", "concise": ""},
        "interviewQuestions": app.get("interviewQuestions") or [],
        "nudge3Dismissed": app.get("nudge3Dismissed", False),
        "nudge7Dismissed": app.get("nudge7Dismissed", False), "gaps": app.get("gaps") or []
    }
    for k, v in app.items():
        if k not in new_app: new_app[k] = v
    index = -1
    for i, a in enumerate(applications):
        if a.get("id") == app_id: index = i; break
    if index >= 0: applications[index] = new_app
    else: applications.append(new_app)
    user_dict["applications"] = applications
    save_user_data(user_email, user_dict, full_data)
    return new_app

def update_application(user_email: str, id, updates):
    if USE_LEMMA:
        import asyncio
        try:
            result = asyncio.run(_lemma_update("applications", id, updates))
            if result: return result
        except Exception as e:
            print(f"Lemma update_application failed, falling back: {e}")
    user_dict, full_data = get_user_data(user_email)
    applications = user_dict.get("applications", [])
    for i, a in enumerate(applications):
        if a.get("id") == id:
            applications[i].update(updates)
            user_dict["applications"] = applications
            save_user_data(user_email, user_dict, full_data)
            return applications[i]
    return None

def delete_application(user_email: str, id):
    if USE_LEMMA:
        import asyncio
        try:
            asyncio.run(_lemma_delete("applications", id))
        except Exception as e:
            print(f"Lemma delete failed, falling back: {e}")
    user_dict, full_data = get_user_data(user_email)
    applications = user_dict.get("applications", [])
    user_dict["applications"] = [a for a in applications if a.get("id") != id]
    save_user_data(user_email, user_dict, full_data)
    return True

def get_profile(user_email: str):
    if USE_LEMMA:
        import asyncio
        try:
            profiles = asyncio.run(_lemma_list("profiles"))
            if profiles: return profiles[0]
        except Exception as e:
            print(f"Lemma get_profile failed, falling back: {e}")
    user_dict, _ = get_user_data(user_email)
    return user_dict.get("profile")

def save_profile(user_email: str, profile):
    if USE_LEMMA:
        import asyncio
        try:
            profiles = asyncio.run(_lemma_list("profiles"))
            if profiles:
                result = asyncio.run(_lemma_update("profiles", profiles[0].get("id"), profile))
                if result: return result
            else:
                result = asyncio.run(_lemma_create("profiles", profile))
                if result: return result
        except Exception as e:
            print(f"Lemma save_profile failed, falling back: {e}")
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
        if not date_str: continue
        try:
            clean = date_str.rstrip('Z')
            date_obj = datetime.fromisoformat(clean.split('.')[0] if '.' in clean else clean)
            if date_obj >= one_week_ago: count += 1
        except: pass
    return count

def get_active_nudges(user_email: str):
    apps = get_applications(user_email)
    now = datetime.utcnow()
    nudges = []
    for app in apps:
        if app.get("status") not in ["Applied", "Screening"]: continue
        date_str = app.get("dateApplied", "")
        if not date_str: continue
        try:
            clean = date_str.rstrip('Z')
            date_obj = datetime.fromisoformat(clean.split('.')[0] if '.' in clean else clean)
            diff_days = (now - date_obj).days
            if diff_days >= 3 and diff_days < 7 and not app.get("nudge3Dismissed", False):
                nudges.append({"id": f"{app.get('id')}_nudge_3", "appId": app.get("id"), "company": app.get("company"), "role": app.get("role"), "type": "Day 3 Nudge", "message": f"It has been {diff_days} days since you applied to {app.get('company')}. Time to send a gentle LinkedIn follow-up!"})
            if diff_days >= 7 and not app.get("nudge7Dismissed", False):
                nudges.append({"id": f"{app.get('id')}_nudge_7", "appId": app.get("id"), "company": app.get("company"), "role": app.get("role"), "type": "Day 7 Nudge", "message": f"It's been a week since you applied to {app.get('company')}. Consider reaching out to the hiring manager or recruiter again."})
        except: pass
    return nudges

def get_discoverable_profiles(exclude_email: str):
    init_db()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        profiles = []
        for email, udata in data.get("user_data", {}).items():
            if email.lower() == exclude_email.lower(): continue
            profile = udata.get("profile")
            if profile and profile.get("discoverable") is True:
                p = profile.copy(); p["email"] = email; profiles.append(p)
        return profiles
    except: return []

def follow_user(follower_email, target_email):
    follower_dict, full_data = get_user_data(follower_email)
    fp = follower_dict.get("profile") or {}
    following = set(fp.get("following", [])); following.add(target_email.lower())
    fp["following"] = list(following); follower_dict["profile"] = fp
    full_data.setdefault("user_data", {})[follower_email.lower()] = follower_dict
    target_email = target_email.lower()
    td = full_data.setdefault("user_data", {}).setdefault(target_email, {"applications": [], "profile": {}})
    tp = td.get("profile") or {}
    followers = set(tp.get("followers", [])); followers.add(follower_email.lower())
    tp["followers"] = list(followers); td["profile"] = tp; full_data["user_data"][target_email] = td
    with open(DB_PATH, 'w', encoding='utf-8') as f: json.dump(full_data, f, indent=2)
    return True

def unfollow_user(follower_email, target_email):
    follower_dict, full_data = get_user_data(follower_email)
    fp = follower_dict.get("profile") or {}
    following = set(fp.get("following", []))
    if target_email.lower() in following: following.remove(target_email.lower())
    fp["following"] = list(following); follower_dict["profile"] = fp
    full_data.setdefault("user_data", {})[follower_email.lower()] = follower_dict
    target_email = target_email.lower()
    td = full_data.setdefault("user_data", {}).setdefault(target_email, {"applications": [], "profile": {}})
    tp = td.get("profile") or {}
    followers = set(tp.get("followers", []))
    if follower_email.lower() in followers: followers.remove(follower_email.lower())
    tp["followers"] = list(followers); td["profile"] = tp; full_data["user_data"][target_email] = td
    with open(DB_PATH, 'w', encoding='utf-8') as f: json.dump(full_data, f, indent=2)
    return True

def search_profiles(query, exclude_email):
    init_db(); query = query.lower()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f: data = json.load(f)
        profiles = []
        for email, udata in data.get("user_data", {}).items():
            if email.lower() == exclude_email.lower(): continue
            profile = udata.get("profile")
            if profile and profile.get("discoverable") is True and query in profile.get("name", "").lower():
                p = profile.copy(); p["email"] = email; profiles.append(p)
        return profiles
    except: return []

def get_profiles_by_emails(emails):
    init_db()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f: data = json.load(f)
        result = []
        emails_lower = [e.lower() for e in emails]
        for email, udata in data.get("user_data", {}).items():
            if email.lower() in emails_lower:
                p = (udata.get("profile") or {}).copy(); p["email"] = email; result.append(p)
        return result
    except: return []

def get_chat_room_id(email1, email2):
    emails = sorted([email1.lower(), email2.lower()])
    return f"{emails[0]}_{emails[1]}"

def save_chat_message(sender, receiver, text, media_urls=None):
    init_db()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f: data = json.load(f)
        chats = data.setdefault("chats", {})
        room_id = get_chat_room_id(sender, receiver)
        room_messages = chats.setdefault(room_id, [])
        msg = {"id": f"msg_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}", "sender": sender.lower(), "receiver": receiver.lower(), "text": text, "mediaUrls": media_urls or [], "timestamp": int(time.time() * 1000)}
        room_messages.append(msg)
        with open(DB_PATH, 'w', encoding='utf-8') as f: json.dump(data, f, indent=2)
        return msg
    except: return None

def get_chat_history(user1, user2):
    init_db()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f: data = json.load(f)
        return data.get("chats", {}).get(get_chat_room_id(user1, user2), [])
    except: return []

def get_conversations(email):
    init_db(); email = email.lower()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f: data = json.load(f)
        convos = {}
        for room_id, messages in data.get("chats", {}).items():
            parts = room_id.split("_")
            if email in parts:
                other = parts[0] if parts[1] == email else parts[1]
                if messages:
                    last = messages[-1]
                    convos[other] = {"lastMessage": last.get("text", ""), "timestamp": last.get("timestamp", 0), "sender": last.get("sender", "")}
        sorted_c = sorted(convos.items(), key=lambda x: x[1]["timestamp"], reverse=True)
        return [{"email": e, **d} for e, d in sorted_c]
    except: return []

COMPANIES_DB_PATH = os.path.join(CURRENT_DIR, 'companies.json')

def init_companies_db():
    if not os.path.exists(COMPANIES_DB_PATH):
        default = {
            "companies": [
                {"id": "c1", "name": "Google", "industry": "Technology", "location": "Mountain View, CA", "website": "https://careers.google.com", "description": "Search, cloud computing, AI."},
                {"id": "c2", "name": "Microsoft", "industry": "Technology", "location": "Redmond, WA", "website": "https://careers.microsoft.com", "description": "Software, cloud, AI, enterprise."},
                {"id": "c3", "name": "Amazon", "industry": "Technology / E-commerce", "location": "Seattle, WA", "website": "https://amazon.jobs", "description": "E-commerce, AWS, AI, logistics."},
                {"id": "c4", "name": "Meta", "industry": "Technology / Social Media", "location": "Menlo Park, CA", "website": "https://metacareers.com", "description": "Social media, AR/VR, AI."},
                {"id": "c5", "name": "Apple", "industry": "Technology", "location": "Cupertino, CA", "website": "https://apple.com/careers", "description": "Consumer electronics, software, services."},
                {"id": "c6", "name": "Netflix", "industry": "Entertainment", "location": "Los Gatos, CA", "website": "https://jobs.netflix.com", "description": "Streaming entertainment."},
                {"id": "c7", "name": "Tesla", "industry": "Automotive / Energy", "location": "Austin, TX", "website": "https://tesla.com/careers", "description": "Electric vehicles, solar, battery tech."},
                {"id": "c8", "name": "Stripe", "industry": "Fintech", "location": "San Francisco, CA", "website": "https://stripe.com/jobs", "description": "Online payment processing."},
                {"id": "c9", "name": "Airbnb", "industry": "Hospitality / Technology", "location": "San Francisco, CA", "website": "https://airbnb.com/careers", "description": "Short-term lodging, travel."},
                {"id": "c10", "name": "Salesforce", "industry": "Enterprise Software", "location": "San Francisco, CA", "website": "https://salesforce.com/careers", "description": "CRM, enterprise cloud, AI."},
                {"id": "c11", "name": "Atlassian", "industry": "Enterprise Software", "location": "Sydney, Australia", "website": "https://atlassian.com/careers", "description": "Jira, Confluence, team collaboration."},
                {"id": "c12", "name": "Spotify", "industry": "Music / Audio", "location": "Stockholm, Sweden", "website": "https://spotify.com/careers", "description": "Music streaming, podcasting."}
            ]
        }
        with open(COMPANIES_DB_PATH, 'w', encoding='utf-8') as f: json.dump(default, f, indent=2)

def get_companies(search=""):
    init_companies_db()
    try:
        with open(COMPANIES_DB_PATH, 'r', encoding='utf-8') as f: data = json.load(f)
        companies = data.get("companies", [])
        if search:
            q = search.lower()
            companies = [c for c in companies if q in c["name"].lower() or q in c["industry"].lower() or q in c.get("location", "").lower()]
        return companies
    except: return []

def save_company_interest(user_email, company_id):
    init_db()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f: data = json.load(f)
        interests = data.setdefault("company_interests", {})
        user_list = interests.setdefault(user_email.lower(), [])
        if company_id not in user_list: user_list.append(company_id)
        with open(DB_PATH, 'w', encoding='utf-8') as f: json.dump(data, f, indent=2)
        return True
    except: return False

def get_user_company_interests(user_email):
    init_db()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f: data = json.load(f)
        return data.get("company_interests", {}).get(user_email.lower(), [])
    except: return []
