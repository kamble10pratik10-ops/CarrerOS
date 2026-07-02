import json
from typing import Dict, Any
from src.services.ats_scorer import calculate_ats_score

async def analyze_resume(jd_text: str, resume_text: str, company_name: str, role_name: str, groq_client) -> Dict[str, Any]:
    print(f"[GroqProvider] Starting local fallback Resume Analysis Pipeline for {role_name} at {company_name}...")

    # Step 1: ATS Scoring Engine
    ats_score, ats_factors = calculate_ats_score(resume_text, jd_text)
    
    # Step 2: Identify Gaps and Extract Info
    gap_prompt = f"""
    Analyze the Job Description and the Resume.
    JOB DESCRIPTION: {jd_text}
    RESUME: {resume_text}
    
    Task: Identify exactly 3 gaps between the resume and JD. Also extract the company name and role name from the Job Description.
    Return ONLY valid JSON:
    {{
      "company": "Extracted Company Name (or Unknown if not found)",
      "role": "Extracted Role Name (or Unknown if not found)",
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
    
    company_name = company_name or gaps_data.get("company", "Extracted Company")
    role_name = role_name or gaps_data.get("role", "Extracted Role")
    
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
