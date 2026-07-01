import json
import asyncio
import traceback
from typing import Dict, Any, List

# Attempt to import real Lemma SDK
# try:
#     from lemma_sdk import Pod
#     has_lemma = True
# except ImportError:
#     has_lemma = False
#     print("[lemma_orchestrator] WARNING: lemma-sdk is not installed or requires Python >= 3.11.")
#     print("[lemma_orchestrator] Authentic Lemma orchestration disabled. Falling back to local Groq execution.")
try:
    from lemma_sdk import Pod
    has_lemma = True
    print("✅ Lemma SDK imported successfully")
except Exception as e:
    has_lemma = False
    print("❌ Lemma SDK import failed")
    print(type(e))
    print(e)

from src.services.ats_scorer import calculate_ats_score

# ==========================================
# LOCAL FALLBACK EXECUTORS
# ==========================================
# These execute locally using Groq when the authentic Lemma SDK cannot be reached.

async def local_mentor_workflow(profile: dict, resume_text: str, chat_history: list, message: str, groq_client) -> str:
    unified_context = f"""
    USER PROFILE:
    Target Role: {profile.get('targetRole', 'Not set')}
    Skills: {profile.get('skills', 'Not specified')}
    Resume Summary: {resume_text[:1000] if resume_text else 'No resume uploaded'}
    """
    
    system_prompt = f"""
    You are an elite AI Career Mentor.
    
    {unified_context}
    
    Instructions:
    1. Provide actionable, concise advice (2-4 paragraphs).
    2. Suggest specific technologies, companies, or strategies.
    3. Be direct and honest.
    """
    
    messages = [{"role": "system", "content": system_prompt}]
    for h in chat_history:
        messages.append({"role": h.get("role"), "content": h.get("content")})
    messages.append({"role": "user", "content": message})
    
    if groq_client:
        completion = groq_client.chat.completions.create(
            messages=messages,
            model="llama-3.3-70b-versatile"
        )
        return completion.choices[0].message.content
    return "API Client not provided."


async def local_resume_workflow(jd_text: str, resume_text: str, company_name: str, role_name: str, groq_client) -> Dict[str, Any]:
    print(f"[lemma_orchestrator] Starting local fallback Resume Analysis Pipeline for {role_name} at {company_name}...")

    # Step 1: ATS Scoring Engine
    ats_score, ats_factors = calculate_ats_score(resume_text, jd_text)
    
    # Step 2: Identify Gaps
    gap_prompt = f"""
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
    gap_completion = groq_client.chat.completions.create(
        messages=[{"role": "user", "content": gap_prompt}],
        model="llama-3.3-70b-versatile",
        response_format={"type": "json_object"}
    )
    gaps_data = json.loads(gap_completion.choices[0].message.content)
    
    # Step 3: Suggest Improvements
    imp_prompt = f"""
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
    imp_completion = groq_client.chat.completions.create(
        messages=[{"role": "user", "content": imp_prompt}],
        model="llama-3.3-70b-versatile",
        response_format={"type": "json_object"}
    )
    improvements_data = json.loads(imp_completion.choices[0].message.content)
    
    # Step 4: Generate Outreach
    out_prompt = f"""
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
    out_completion = groq_client.chat.completions.create(
        messages=[{"role": "user", "content": out_prompt}],
        model="llama-3.3-70b-versatile",
        response_format={"type": "json_object"}
    )
    outreach_data = json.loads(out_completion.choices[0].message.content)
    
    # Step 5: Aggregate results
    final_output = {
        "company": company_name or "Extracted Company",
        "role": role_name or "Extracted Role",
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


# ==========================================
# AUTHENTIC LEMMA SDK ORCHESTRATION 
# ==========================================

async def run_mentor_workflow(profile: dict, resume_text: str, chat_history: list, message: str, groq_client, gemini_client) -> str:
    print("🔥 run_mentor_workflow() CALLED")
    """
    Orchestrates the AI Career Mentor. Uses authentic Lemma SDK if available,
    otherwise falls back to local Groq execution.
    """
    if has_lemma:
        try:
            print("🚀 USING LEMMA SDK")
            pod = Pod.from_env()
            print("[lemma_orchestrator] Delegating to genuine Lemma Agent: careermentor")
            
            # Send message to the agent hosted on Lemma
            # We pass profile, resume, and chat_history as metadata so the remote agent has context
            metadata = {
                "profile": profile,
                "resume_summary": resume_text[:1000] if resume_text else "",
                "chat_history": chat_history
            }
            
            # Actual integration of lemma_sdk.agents.run
            # conversation = pod.agents.run(
            #     "CareerMentor", 
            #     message=message,
            #     metadata=metadata
            # )
            context = f"""
            ## USER PROFILE

            Target Role:
            {profile.get("targetRole", "Not specified")}

            Skills:
            {profile.get("skills", "Not specified")}

            Education:
            {profile.get("education", "Not specified")}

            Resume:
            {resume_text[:2500] if resume_text else "No resume uploaded"}

            Conversation History:
            {json.dumps(chat_history, indent=2)}

            ## USER QUESTION

            {message}
            """

            conversation = pod.agents.run(
                "careermentor",
                message=context
            )
            print("=" * 60)
            print("LEMMA AGENT CALLED")
            print("Conversation ID:", conversation.id)
            print("Conversation Output:", conversation.output)
            print("=" * 60)
            
            # The agent responds asynchronously. We check if output is populated.
            # In lemma-sdk, unset fields use a special UNSET object.
            # To get the final reply if it takes a while, one would normally poll:
            # pod.conversations.messages(str(conversation.id))
            # from lemma_sdk.types import UNSET
            # if conversation.output and conversation.output is not UNSET:
            #     return conversation.output
            # else:
            #     return "Agent started processing. Reply is asynchronous."
                
        except Exception as e:
            print("=" * 60)
            print("LEMMA FAILED!")
            print(e)
            print("=" * 60)

            return await local_mentor_workflow(
                profile,
                resume_text,
                chat_history,
                message,
                groq_client
            )


    # Fallback to direct local execution
    return await local_mentor_workflow(profile, resume_text, chat_history, message, groq_client)


async def run_resume_analysis_workflow(jd_text: str, resume_text: str, company_name: str, role_name: str, groq_client) -> Dict[str, Any]:
    """
    Orchestrates the Resume Analysis Pipeline. Uses authentic Lemma SDK if available,
    otherwise falls back to local Groq execution.
    """
    if has_lemma:
        try:
            pod = Pod.from_env()
            print("[lemma_orchestrator] Delegating to genuine Lemma Workflow: ResumeAnalysis")
            
            # Actual integration of lemma_sdk.workflows.run
            run_response = pod.workflows.run("ResumeAnalysis")
            
            # Submit the form with the resume and JD inputs if the workflow expects form inputs
            if run_response.active_wait and run_response.active_wait.node_id:
                inputs = {
                    "jd_text": jd_text,
                    "resume_text": resume_text,
                    "company_name": company_name,
                    "role_name": role_name
                }
                final_response = pod.workflows.submit_form(
                    str(run_response.id), 
                    node_id=run_response.active_wait.node_id, 
                    inputs=inputs
                )
                
                # Retrieve the final workflow context output
                if final_response.execution_context:
                    return final_response.execution_context.to_dict()
                    
        except Exception as e:
            print(f"[lemma_orchestrator] Authentic Lemma SDK execution failed: {e}")
            print("[lemma_orchestrator] Falling back to local Groq engine.")

    # Fallback to direct local execution
    return await local_resume_workflow(jd_text, resume_text, company_name, role_name, groq_client)
