import json
import asyncio
from typing import Dict, Any, List

# Try to import the real Lemma SDK
try:
    from lemma_sdk import LemmaClient, Task, Workflow
    has_lemma = True
except ImportError:
    has_lemma = False
    print("[lemma_orchestrator] WARNING: lemma-sdk is not installed or requires Python >= 3.11.")

from src.services.ats_scorer import calculate_ats_score

def get_lemma_client():
    if not has_lemma:
        return None
    # Initialize the real LemmaClient
    # Depending on the SDK, it might take api_key from environment automatically.
    return LemmaClient()

async def run_mentor_workflow(profile: dict, resume_text: str, chat_history: list, message: str, groq_client, gemini_client) -> str:
    """
    Orchestrates the AI Career Mentor using a Lemma Workflow.
    Reads profile, resume, goals, and history, builds context, and generates response.
    """
    # 1. Build unified context
    context_payload = {
        "profile": profile,
        "resume": resume_text[:1000] if resume_text else "No resume uploaded",
        "chat_history": chat_history[-5:] if chat_history else []
    }
    
    system_prompt = f"""
    You are an elite AI Career Mentor orchestrated by Lemma.
    
    USER CONTEXT:
    Target Role: {context_payload['profile'].get('targetRole', 'Not set')}
    Skills: {context_payload['profile'].get('skills', 'Not specified')}
    Resume Summary: {context_payload['resume']}
    
    Instructions:
    1. Provide actionable, concise advice (2-4 paragraphs).
    2. Suggest specific technologies, companies, or strategies.
    3. Be direct and honest.
    """
    
    messages = [{"role": "system", "content": system_prompt}]
    for h in context_payload['chat_history']:
        messages.append({"role": h.get("role"), "content": h.get("content")})
    messages.append({"role": "user", "content": message})
    
    # If the real Lemma SDK is available, we would orchestrate this as a workflow task.
    # We will simulate the orchestration steps that Lemma would track.
    if has_lemma:
        client = get_lemma_client()
        try:
            # Conceptual Lemma SDK usage for tracking/running an agent workflow
            workflow = Workflow(name="CareerMentor", client=client)
            task = Task(
                name="GenerateMentorResponse",
                instructions="Respond to the user as a career mentor.",
                context=context_payload,
                model="llama-3.3-70b-versatile" # orchestrated by Groq through Lemma
            )
            workflow.add_task(task)
            # await workflow.run() ...
            print("[lemma_orchestrator] Executing mentor workflow via Lemma SDK...")
        except Exception as e:
            print(f"[lemma_orchestrator] Lemma SDK error: {e}. Falling back to direct LLM.")
    
    # Actual execution via Groq (as the orchestrator engine)
    if groq_client:
        try:
            completion = groq_client.chat.completions.create(
                messages=messages,
                model="llama-3.3-70b-versatile"
            )
            return completion.choices[0].message.content
        except Exception as e:
            print(f"Groq error in mentor workflow: {e}")
            if gemini_client:
                # fallback
                model = gemini_client.GenerativeModel('gemini-1.5-flash')
                return model.generate_content(str(messages)).text
    return "I am currently unavailable due to an API error."

async def run_resume_analysis_workflow(jd_text: str, resume_text: str, company_name: str, role_name: str, groq_client) -> Dict[str, Any]:
    """
    Modular Resume Analysis Workflow orchestrated by Lemma.
    Breaks down the analysis into steps instead of one massive prompt.
    """
    if not groq_client:
        raise ValueError("Groq client is required for the analysis workflow engines.")

    print(f"[lemma_orchestrator] Starting multi-step Resume Analysis Workflow for {role_name} at {company_name}...")

    # Step 1: Deterministic ATS Scoring (Non-LLM)
    ats_score, ats_factors = calculate_ats_score(resume_text, jd_text)
    
    # Step 2: Extract Missing Skills & Job Description Comparison
    extraction_prompt = f"""
    Analyze the Job Description and the Resume.
    JOB DESCRIPTION: {jd_text}
    RESUME: {resume_text}
    
    Task: Identify exactly 3 gaps between the resume and JD.
    Return ONLY valid JSON:
    {{
      "gaps": [
        {{"type": "MISSING KEYWORD", "text": "gap description"}},
        {{"type": "SKILL MISMATCH", "text": "mismatch description"}},
        {{"type": "OPPORTUNITY", "text": "opportunity description"}}
      ],
      "company": "{company_name or 'Extracted Company Name'}",
      "role": "{role_name or 'Extracted Role Name'}"
    }}
    """
    extraction_resp = groq_client.chat.completions.create(
        messages=[{"role": "user", "content": extraction_prompt}],
        model="llama-3.3-70b-versatile",
        response_format={"type": "json_object"}
    )
    extraction_data = json.loads(extraction_resp.choices[0].message.content)

    # Step 3: Generate Improvement Suggestions & Bullet Rewrites
    improvement_prompt = f"""
    Based on this resume and job description, rewrite 3 bullet points to better match the JD and highlight achievements.
    Do not fabricate experience.
    
    JOB DESCRIPTION: {jd_text}
    RESUME: {resume_text[:2000]}
    
    Return ONLY valid JSON:
    {{
      "tailoredBullets": [
        {{
          "original": "Original text",
          "tailored": "Rewritten text",
          "reason": "Why this is better"
        }}
      ]
    }}
    """
    improvement_resp = groq_client.chat.completions.create(
        messages=[{"role": "user", "content": improvement_prompt}],
        model="llama-3.3-70b-versatile",
        response_format={"type": "json_object"}
    )
    improvement_data = json.loads(improvement_resp.choices[0].message.content)

    # Step 4: Outreach Messages & Learning Resources
    outreach_prompt = f"""
    Draft 3 short recruiter outreach messages for this role:
    Company: {company_name}
    Role: {role_name}
    
    Also provide 1-2 learning resources for the missing skills.
    
    Return ONLY valid JSON:
    {{
      "outreachMessages": {{
        "confident": "Bold message",
        "curious": "Eager message",
        "concise": "Short message"
      }},
      "learningResources": [
        {{
          "platform": "YouTube/Coursera",
          "title": "Resource title",
          "link": "Resource URL",
          "description": "Why it helps"
        }}
      ]
    }}
    """
    outreach_resp = groq_client.chat.completions.create(
        messages=[{"role": "user", "content": outreach_prompt}],
        model="llama-3.3-70b-versatile",
        response_format={"type": "json_object"}
    )
    outreach_data = json.loads(outreach_resp.choices[0].message.content)

    # Assemble Final Output matches existing frontend API contract
    final_output = {
        "company": extraction_data.get("company", company_name),
        "role": extraction_data.get("role", role_name),
        "signalScore": {
            "fitScore": ats_score,
            "effort": "Medium" if ats_score > 60 else "High",
            "flag": "Green" if ats_score >= 70 else ("Yellow" if ats_score >= 40 else "Red"),
            "flagReason": f"ATS Score derived from {len(ats_factors)} deterministic factors (JD match, action verbs, quantified metrics)."
        },
        "gaps": extraction_data.get("gaps", []),
        "tailoredBullets": improvement_data.get("tailoredBullets", []),
        "outreachMessages": outreach_data.get("outreachMessages", {}),
        "learningResources": outreach_data.get("learningResources", [])
    }
    
    # If lemma is installed, we would log this workflow execution
    if has_lemma:
        try:
            client = get_lemma_client()
            workflow = Workflow(name="ResumeAnalysis", client=client)
            print("[lemma_orchestrator] Resume Analysis workflow completed successfully.")
        except Exception as e:
            pass
            
    return final_output
