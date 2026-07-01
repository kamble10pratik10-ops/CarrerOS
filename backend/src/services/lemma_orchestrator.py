import json
import asyncio
from typing import Dict, Any, List

# Attempt to import real Lemma SDK, fallback to shim if Python 3.10 is used
try:
    from lemma_sdk import LemmaClient, Task, Workflow
    has_lemma = True
except ImportError:
    has_lemma = False
    print("[lemma_orchestrator] WARNING: lemma-sdk is not installed or requires Python >= 3.11. Using orchestration polyfill.")
    
    class LemmaClient:
        pass
        
    class Task:
        def __init__(self, name: str, executor: callable, context: dict = None):
            self.name = name
            self.executor = executor
            self.context = context or {}
            
        async def run(self, shared_state: dict):
            print(f"[Lemma SDK] Executing Task: {self.name}...")
            if asyncio.iscoroutinefunction(self.executor):
                return await self.executor(shared_state, self.context)
            else:
                return self.executor(shared_state, self.context)
                
    class Workflow:
        def __init__(self, name: str, client: Any):
            self.name = name
            self.client = client
            self.tasks = []
            
        def add_task(self, task: Task):
            self.tasks.append(task)
            
        async def run(self, initial_state: dict = None):
            state = initial_state or {}
            print(f"[Lemma SDK] Starting Workflow: {self.name}...")
            for task in self.tasks:
                result = await task.run(state)
                state[task.name] = result
            print(f"[Lemma SDK] Workflow {self.name} Completed.")
            return state

from src.services.ats_scorer import calculate_ats_score

def get_lemma_client():
    return LemmaClient() if has_lemma else LemmaClient()

# ==========================================
# MENTOR WORKFLOW EXECUTORS
# ==========================================

async def build_career_context_task(state: dict, context: dict):
    profile = context.get('profile', {})
    resume = context.get('resume', '')
    history = context.get('chat_history', [])
    
    unified_context = f"""
    USER PROFILE:
    Target Role: {profile.get('targetRole', 'Not set')}
    Skills: {profile.get('skills', 'Not specified')}
    Resume Summary: {resume[:1000] if resume else 'No resume uploaded'}
    """
    return {
        "unified_context": unified_context,
        "history": history,
        "message": context.get('message', '')
    }

async def generate_mentor_response_task(state: dict, context: dict):
    groq_client = context.get("groq_client")
    built_context = state.get("BuildCareerContext", {})
    
    system_prompt = f"""
    You are an elite AI Career Mentor orchestrated by Lemma.
    
    {built_context.get('unified_context', '')}
    
    Instructions:
    1. Provide actionable, concise advice (2-4 paragraphs).
    2. Suggest specific technologies, companies, or strategies.
    3. Be direct and honest.
    """
    
    messages = [{"role": "system", "content": system_prompt}]
    for h in built_context.get('history', []):
        messages.append({"role": h.get("role"), "content": h.get("content")})
    messages.append({"role": "user", "content": built_context.get('message', '')})
    
    if groq_client:
        completion = groq_client.chat.completions.create(
            messages=messages,
            model="llama-3.3-70b-versatile"
        )
        return completion.choices[0].message.content
    return "API Client not provided."

async def run_mentor_workflow(profile: dict, resume_text: str, chat_history: list, message: str, groq_client, gemini_client) -> str:
    """
    Orchestrates the AI Career Mentor using a Lemma Workflow.
    """
    client = get_lemma_client()
    workflow = Workflow(name="CareerMentor", client=client)
    
    workflow.add_task(Task(
        name="BuildCareerContext", 
        executor=build_career_context_task, 
        context={"profile": profile, "resume": resume_text, "chat_history": chat_history, "message": message}
    ))
    
    workflow.add_task(Task(
        name="GenerateMentorResponse", 
        executor=generate_mentor_response_task, 
        context={"groq_client": groq_client}
    ))
    
    results = await workflow.run()
    return results.get("GenerateMentorResponse", "Error generating response.")


# ==========================================
# RESUME ANALYSIS WORKFLOW EXECUTORS
# ==========================================

async def extract_and_score_resume_task(state: dict, context: dict):
    jd_text = context.get('jd_text', '')
    resume_text = context.get('resume_text', '')
    ats_score, ats_factors = calculate_ats_score(resume_text, jd_text)
    return {
        "score": ats_score,
        "factors": ats_factors
    }

async def identify_gaps_task(state: dict, context: dict):
    groq_client = context.get("groq_client")
    jd_text = context.get("jd_text")
    resume_text = context.get("resume_text")
    
    prompt = f"""
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
      ]
    }}
    """
    completion = groq_client.chat.completions.create(
        messages=[{"role": "user", "content": prompt}],
        model="llama-3.3-70b-versatile",
        response_format={"type": "json_object"}
    )
    return json.loads(completion.choices[0].message.content)

async def suggest_improvements_task(state: dict, context: dict):
    groq_client = context.get("groq_client")
    jd_text = context.get("jd_text")
    resume_text = context.get("resume_text")
    
    prompt = f"""
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
    completion = groq_client.chat.completions.create(
        messages=[{"role": "user", "content": prompt}],
        model="llama-3.3-70b-versatile",
        response_format={"type": "json_object"}
    )
    return json.loads(completion.choices[0].message.content)

async def generate_outreach_task(state: dict, context: dict):
    groq_client = context.get("groq_client")
    company_name = context.get("company_name", "")
    role_name = context.get("role_name", "")
    
    prompt = f"""
    Draft 3 short recruiter outreach messages for this role:
    Company: {company_name}
    Role: {role_name}
    
    Also provide 1-2 learning resources for missing skills.
    
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
    completion = groq_client.chat.completions.create(
        messages=[{"role": "user", "content": prompt}],
        model="llama-3.3-70b-versatile",
        response_format={"type": "json_object"}
    )
    return json.loads(completion.choices[0].message.content)

async def aggregate_resume_results_task(state: dict, context: dict):
    # Retrieve outputs from previous tasks
    score_data = state.get("CalculateATSScore", {})
    gaps_data = state.get("IdentifyGaps", {})
    improvements_data = state.get("SuggestImprovements", {})
    outreach_data = state.get("GenerateOutreach", {})
    
    ats_score = score_data.get("score", 50)
    ats_factors = score_data.get("factors", {})
    
    # Construct final payload adhering to frontend JSON contract
    final_output = {
        "company": context.get("company_name", "Extracted Company"),
        "role": context.get("role_name", "Extracted Role"),
        "signalScore": {
            "fitScore": ats_score,
            "effort": "Medium" if ats_score > 60 else "High",
            "flag": "Green" if ats_score >= 70 else ("Yellow" if ats_score >= 40 else "Red"),
            "flagReason": f"ATS Score derived from {len(ats_factors)} deterministic factors."
        },
        "gaps": gaps_data.get("gaps", []),
        "tailoredBullets": improvements_data.get("tailoredBullets", []),
        "outreachMessages": outreach_data.get("outreachMessages", {}),
        "learningResources": outreach_data.get("learningResources", [])
    }
    return final_output


async def run_resume_analysis_workflow(jd_text: str, resume_text: str, company_name: str, role_name: str, groq_client) -> Dict[str, Any]:
    """
    Modular Resume Analysis Workflow orchestrated by Lemma.
    Executes multiple independent tasks and aggregates their outputs.
    """
    client = get_lemma_client()
    workflow = Workflow(name="ResumeAnalysis", client=client)
    
    # Task 1: ATS Scoring Engine
    workflow.add_task(Task(
        name="CalculateATSScore",
        executor=extract_and_score_resume_task,
        context={"jd_text": jd_text, "resume_text": resume_text}
    ))
    
    # Task 2: Identify Gaps
    workflow.add_task(Task(
        name="IdentifyGaps",
        executor=identify_gaps_task,
        context={"groq_client": groq_client, "jd_text": jd_text, "resume_text": resume_text}
    ))
    
    # Task 3: Improve Bullets
    workflow.add_task(Task(
        name="SuggestImprovements",
        executor=suggest_improvements_task,
        context={"groq_client": groq_client, "jd_text": jd_text, "resume_text": resume_text}
    ))
    
    # Task 4: Outreach Messages
    workflow.add_task(Task(
        name="GenerateOutreach",
        executor=generate_outreach_task,
        context={"groq_client": groq_client, "company_name": company_name, "role_name": role_name}
    ))
    
    # Task 5: Aggregate results
    workflow.add_task(Task(
        name="AggregateResults",
        executor=aggregate_resume_results_task,
        context={"company_name": company_name, "role_name": role_name}
    ))
    
    results = await workflow.run()
    return results.get("AggregateResults", {})
