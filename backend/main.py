import os
from fastapi import FastAPI, UploadFile, File, HTTPException, status, Depends, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from passlib.context import CryptContext

# Load environment variables from .env
load_dotenv()

from src.lib.lemma.datastore import (
    get_applications,
    get_weekly_velocity,
    get_active_nudges,
    update_application,
    delete_application,
    save_profile,
    get_profile
)
from src.lib.lemma.workflows import trigger_application_workflow
from src.services.ai_service import parse_file_with_gemini, chat_with_agent, chat_with_recruiter_agent, evaluate_interview_performance, generate_interview_questions
from src.lib.lemma.auth import create_access_token, verify_token
from src.lib.lemma.auth_store import user_exists, get_user_by_email, create_user

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI(title="CareerOS API", version="1.0.0")

# CORS middleware configuration matching Node.js backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RegisterRequest(BaseModel):
    email: str
    mobile: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class AnalyzeRequest(BaseModel):
    jdText: str
    resumeText: str
    companyName: str | None = None
    roleName: str | None = None

class UpdateRequest(BaseModel):
    id: str | None = None
    updates: dict | None = None
    profile: dict | None = None

class ChatRequest(BaseModel):
    message: str
    chatHistory: list | None = []
    resumeText: str | None = ""
    currentJdText: str | None = ""

class EvaluateRequest(BaseModel):
    chatHistory: list | None = []
    currentJdText: str | None = ""

class GenerateQuestionsRequest(BaseModel):
    targetRole: str | None = ""
    resumeText: str | None = ""
    skills: str | None = ""
    questionTypes: list | None = ["technical", "behavioral", "situational"]

# --- Auth Helper ---
def get_current_user(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header.split(" ")[1]
    email = verify_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return email

# --- Auth Routes ---

@app.post("/api/auth/register")
async def register(req: RegisterRequest):
    if not req.email or not req.password or not req.mobile:
        raise HTTPException(status_code=400, detail="Email, mobile and password are required")
    if user_exists(req.email):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    password_hash = pwd_context.hash(req.password)
    create_user(req.email, req.mobile, password_hash)
    token = create_access_token(req.email)
    return {"success": True, "token": token, "email": req.email.lower()}

@app.post("/api/auth/login")
async def login(req: LoginRequest):
    user = get_user_by_email(req.email)
    if not user or not pwd_context.verify(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(req.email)
    return {"success": True, "token": token, "email": user["email"]}

# --- Profile Routes ---

@app.get("/api/profile")
async def get_profile_route(email: str = Depends(get_current_user)):
    profile = get_profile(email)
    return {"success": True, "profile": profile}

@app.put("/api/profile")
async def update_profile_route(req: UpdateRequest, email: str = Depends(get_current_user)):
    existing = get_profile(email) or {}
    if req.profile:
        existing.update(req.profile)
    saved = save_profile(email, existing)
    return {"success": True, "profile": saved}

# 1. File Upload / Parser Route (Gemini OCR & PDF Parsing)
@app.post("/api/parse-file")
async def parse_file(file: UploadFile = File(...)):
    try:
        file_bytes = await file.read()
        mime_type = file.content_type or ""
        file_name = file.filename or "unknown"
        
        print(f"[Backend] Processing file upload: {file_name} ({mime_type})")
        extracted_text = parse_file_with_gemini(file_bytes, mime_type, file_name)
        
        return {
            "success": True,
            "text": extracted_text,
            "fileName": file_name,
            "mimeType": mime_type
        }
    except Exception as e:
        print(f"Error in parse-file route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e) or "Failed to parse file"
        )

# 2. Application Analysis Workflow Route (Groq + Gemini Triage Scorer)
@app.post("/api/analyze")
async def analyze_application(req: AnalyzeRequest, email: str = Depends(get_current_user)):
    try:
        print(f"[Backend] Triggering analysis workflow for {email}...")
        saved_app = await trigger_application_workflow(email, {
            "jdText": req.jdText,
            "resumeText": req.resumeText,
            "companyName": req.companyName,
            "roleName": req.roleName
        })
        
        weekly_velocity = get_weekly_velocity(email)
        active_nudges = get_active_nudges(email)
        all_apps = get_applications(email)
        
        return {
            "success": True,
            "application": saved_app,
            "weeklyVelocity": weekly_velocity,
            "activeNudges": active_nudges,
            "allApps": all_apps
        }
    except Exception as e:
        print(f"Error in analyze route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e) or "Failed to analyze application"
        )

# 3. Get Application pipeline board and stats
@app.get("/api/analyze")
async def get_analysis_dashboard(email: str = Depends(get_current_user)):
    try:
        all_apps = get_applications(email)
        weekly_velocity = get_weekly_velocity(email)
        active_nudges = get_active_nudges(email)
        
        return {
            "success": True,
            "applications": all_apps,
            "weeklyVelocity": weekly_velocity,
            "activeNudges": active_nudges
        }
    except Exception as e:
        print(f"Error fetching applications: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch application states"
        )

# 4. Update application status or user profile
@app.put("/api/applications")
async def update_applications_or_profile(req: UpdateRequest, email: str = Depends(get_current_user)):
    try:
        if req.profile is not None:
            print(f"[Backend] Updating user profile for {email}...")
            saved = save_profile(email, req.profile)
            return {"success": True, "profile": saved}
            
        if not req.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Application ID is required"
            )
            
        print(f"[Backend] Updating application status: {req.id} for {email}")
        updated_app = update_application(email, req.id, req.updates or {})
        
        if not updated_app:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found"
            )
            
        return {"success": True, "application": updated_app}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error in applications PUT route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e) or "Failed to update"
        )

# 5. Delete an application
@app.delete("/api/applications")
async def delete_app(id: str, email: str = Depends(get_current_user)):
    try:
        print(f"[Backend] Deleting application {id} for {email}")
        success = delete_application(email, id)
        return {"success": success}
    except Exception as e:
        print(f"Error in applications DELETE route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete application"
        )

# 5.b Download Tailored Resume
import docx
import json
import tempfile

@app.get("/api/applications/{app_id}/download-resume")
async def download_resume(app_id: str, email: str = Depends(get_current_user)):
    try:
        all_apps = get_applications(email)
        app_data = next((a for a in all_apps if a.get("id") == app_id), None)
        if not app_data:
            raise HTTPException(status_code=404, detail="Application not found")
            
        profile = get_profile(email)
        resume_text = profile.get("resumeText", "") if profile else ""
        if not resume_text:
            raise HTTPException(status_code=400, detail="No base resume found")
            
        # Parse tailored bullets
        tailored_bullets_raw = app_data.get("tailoredBullets", "[]")
        try:
            tailored_bullets = json.loads(tailored_bullets_raw) if isinstance(tailored_bullets_raw, str) else tailored_bullets_raw
        except:
            tailored_bullets = []
            
        # Reconstruct resume text by replacing original with tailored
        final_resume = resume_text
        for bullet in tailored_bullets:
            original = bullet.get("original", "").strip()
            tailored = bullet.get("tailored", "").strip()
            if original and tailored and original in final_resume:
                final_resume = final_resume.replace(original, tailored)
                
        # Create a DOCX
        doc = docx.Document()
        
        # Add basic formatting
        for paragraph in final_resume.split('\n'):
            p = paragraph.strip()
            if p:
                if p.isupper() and len(p) < 40:
                    # Treat short uppercase lines as headings
                    doc.add_heading(p, level=2)
                elif p.startswith(('-', '*')):
                    # Treat lines starting with hyphens or asterisks as bullets
                    doc.add_paragraph(p[1:].strip(), style='List Bullet')
                else:
                    doc.add_paragraph(p)
                    
        # Save to temp file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".docx")
        doc.save(temp_file.name)
        
        return FileResponse(
            temp_file.name, 
            media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            filename=f"Tailored_Resume_{app_data.get('company', 'Company')}.docx"
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error downloading resume: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate document"
        )

# 6. Conversational Chat Agent (Career Concierge)
@app.post("/api/chat")
async def chat(req: ChatRequest, email: str = Depends(get_current_user)):
    try:
        print(f"[Backend] Forwarding message to Career Concierge for {email}...")
        reply = await chat_with_agent({
            "message": req.message,
            "chatHistory": req.chatHistory or [],
            "resumeText": req.resumeText,
            "currentJdText": req.currentJdText
        })
        
        return {
            "success": True,
            "reply": reply
        }
    except Exception as e:
        print(f"Error in chat API route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e) or "Failed to get response from AI chat"
        )

# 7. Recruiter Simulator Chat Agent
@app.post("/api/interview-chat")
async def interview_chat(req: ChatRequest, email: str = Depends(get_current_user)):
    try:
        print(f"[Backend] Forwarding message to Recruiter Simulator for {email}...")
        reply = await chat_with_recruiter_agent({
            "message": req.message,
            "chatHistory": req.chatHistory or [],
            "resumeText": req.resumeText,
            "currentJdText": req.currentJdText
        })
        
        return {
            "success": True,
            "reply": reply
        }
    except Exception as e:
        print(f"Error in interview chat API route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e) or "Failed to get response from Recruiter Simulator"
        )

# 8. Recruiter Simulator Interview Evaluator
@app.post("/api/evaluate-interview")
async def evaluate_interview(req: EvaluateRequest, email: str = Depends(get_current_user)):
    try:
        print(f"[Backend] Forwarding interview to Evaluator for {email}...")
        evaluation = await evaluate_interview_performance({
            "chatHistory": req.chatHistory or [],
            "currentJdText": req.currentJdText
        })
        
        return {
            "success": True,
            "evaluation": evaluation
        }
    except Exception as e:
        print(f"Error in evaluate-interview API route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e) or "Failed to evaluate interview performance"
        )

# 9. Interview Question Generator
@app.post("/api/generate-questions")
async def generate_questions(req: GenerateQuestionsRequest, email: str = Depends(get_current_user)):
    try:
        print(f"[Backend] Generating interview questions for {email}...")
        result = await generate_interview_questions({
            "targetRole": req.targetRole or "",
            "resumeText": req.resumeText or "",
            "skills": req.skills or "",
            "questionTypes": req.questionTypes or ["technical", "behavioral", "situational"]
        })
        return {"success": True, **result}
    except Exception as e:
        print(f"Error in generate-questions API route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e) or "Failed to generate interview questions"
        )


if __name__ == "__main__":
    import uvicorn
    # Use port 3001 to match Next.js frontend expectance
    uvicorn.run("main:app", host="127.0.0.1", port=3001, reload=False)
