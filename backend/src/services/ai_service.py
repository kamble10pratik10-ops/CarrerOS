import os
import json
from groq import Groq
import google.generativeai as genai

def get_groq_client():
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return None
    try:
        return Groq(api_key=api_key)
    except Exception:
        return None

def get_gemini_client():
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return None
    genai.configure(api_key=api_key)
    return genai

def clean_json_string(text):
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()

def parse_file_with_gemini(file_bytes, mime_type, file_name):
    file_ext = (file_name.rsplit('.', 1)[-1] if '.' in file_name else '').lower()
    
    # --- Plain text files: just decode ---
    if mime_type.startswith("text/") or file_ext in ("txt", "text", "csv", "md"):
        try:
            return file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            return file_bytes.decode("latin-1")
    
    # --- DOCX: extract with python-docx (Gemini can't handle DOCX inline) ---
    if file_ext in ("docx",) or mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        try:
            import docx
            import io
            doc = docx.Document(io.BytesIO(file_bytes))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            extracted = "\n".join(paragraphs)
            if extracted.strip():
                return extracted
            # If paragraphs are empty, try tables
            table_text = []
            for table in doc.tables:
                for row in table.rows:
                    row_data = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                    if row_data:
                        table_text.append(" | ".join(row_data))
            return "\n".join(table_text) if table_text else "Could not extract text from this DOCX file."
        except ImportError:
            raise ValueError("python-docx is not installed. Run: pip install python-docx")
        except Exception as e:
            raise ValueError(f"Failed to parse DOCX file: {e}")
    
    # --- Old .doc format: try textract-like fallback ---
    if file_ext == "doc" or mime_type == "application/msword":
        # .doc is a legacy binary format — try to decode as text, or advise to convert
        try:
            text = file_bytes.decode("utf-8", errors="ignore")
            # Strip binary noise
            clean = "".join(c for c in text if c.isprintable() or c in "\n\r\t")
            if len(clean.strip()) > 50:
                return clean.strip()
        except Exception:
            pass
        raise ValueError("Old .doc format detected. Please save as .docx or PDF and try again.")
    
    # --- Images and PDFs: use Gemini Vision/Document AI ---
    gen_ai = get_gemini_client()
    if not gen_ai:
        raise ValueError("Gemini API key (GOOGLE_API_KEY) is not set in environment.")
        
    model = gen_ai.GenerativeModel('gemini-2.0-flash')
    
    part = {
        "mime_type": mime_type,
        "data": file_bytes
    }
    
    if mime_type.startswith("image/"):
        prompt = "Extract ALL text from this image. This may be a resume or a job description screenshot. Provide the complete parsed text clearly, preserving structure."
    elif mime_type == "application/pdf":
        prompt = "Extract the complete text contents of this document (which is a resume or job description). Maintain structure where possible."
    else:
        prompt = "Extract all readable text from this file."
        
    result = model.generate_content([part, prompt])
    return result.text

async def generate_application_analysis(payload):
    jd_text = payload.get("jdText")
    resume_text = payload.get("resumeText")
    company_name = payload.get("companyName")
    role_name = payload.get("roleName")
    
    prompt = f"""
You are Career Command, an elite AI Agent that helps students optimize their job applications.
Analyze the following Job Description and the Candidate's Resume.

---
JOB DESCRIPTION:
{jd_text}
---
CANDIDATE'S RESUME:
{resume_text}
---

Perform these tasks and return a structured JSON response matching the specifications:
1. Identify the Company Name and Job Role. If not provided or unclear, extract them from the Job Description text.
2. Compute the "Signal Score":
   - "fitScore": A score from 0-100 indicating skills and experience overlap.
   - "effort": A rating of "Easy", "Medium", or "High" indicating how much tailoring work is needed vs. the candidate's realistic shot.
   - "flag": "Green", "Yellow", or "Red" flag based on JD quality (e.g. Red for unrealistic qualifications, ghost posting indicators, or extremely vague JDs).
   - "flagReason": A brief 1-sentence reason justifying the flag.
3. List 3 key "gaps" between the resume and the JD. Use categories: "MISSING KEYWORD", "SKILL MISMATCH", or "OPPORTUNITY".
4. Tailor 3 bullet points from the Candidate's Resume to match the Job Description. The tailored bullet points must show original resume bullets rewritten for high-impact framing WITHOUT fabricating any experience or credentials.
5. Draft 3 Recruiter Outreach messages in different tones:
   - "confident": Bold and assertive.
   - "curious": Eager, research-oriented, showing interest in the company's recent achievements.
   - "concise": Under 4 sentences, quick and sweet.
6. Generate an "Interview Prep Pack" containing 5 to 7 high-quality, trusted FREE learning resources tailored to the skills needed for this role.
   - Include a mix of top-tier free courses (e.g., freeCodeCamp, Coursera free tier, edX), official documentation/guides (e.g., MDN), highly rated YouTube channels or playlists, and practice sites (e.g., GeeksforGeeks, LeetCode).
   Provide a brief description of what the user will learn from each resource and why it is highly recommended.

Return ONLY a valid JSON object matching the exact structure below. Do not include markdown code block syntax (like ```json) or any wrapping text.

Expected JSON format:
{{
  "company": "Company Name",
  "role": "Job Role",
  "signalScore": {{
    "fitScore": 85,
    "effort": "Medium",
    "flag": "Green",
    "flagReason": "Reason for the flag"
  }},
  "gaps": [
    {{"type": "MISSING KEYWORD", "text": "Description of gap"}},
    {{"type": "SKILL MISMATCH", "text": "Description of mismatch"}},
    {{"type": "OPPORTUNITY", "text": "Description of opportunity"}}
  ],
  "tailoredBullets": [
    {{
      "original": "Original resume bullet point",
      "tailored": "Tailored resume bullet point",
      "reason": "AI optimization explanation"
    }}
  ],
  "outreachMessages": {{
    "confident": "Confident message draft",
    "curious": "Curious message draft",
    "concise": "Concise message draft"
  }},
  "learningResources": [
    {{
      "platform": "YouTube",
      "title": "Title of the video or topic",
      "link": "Search query or URL",
      "description": "Why it's useful for this role"
    }}
  ]
}}
"""

    groq_client = get_groq_client()
    gemini_client = get_gemini_client()
    
    if groq_client:
        try:
            print("[ai_service] Using Groq API (llama-3.3-70b) for analysis...")
            completion = groq_client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.3-70b-versatile",
                response_format={"type": "json_object"}
            )
            resp_text = completion.choices[0].message.content
            return json.loads(clean_json_string(resp_text))
        except Exception as e:
            print(f"[ai_service] Groq API Error, falling back to Gemini: {e}")
            return await generate_analysis_with_gemini(prompt, gemini_client)
    else:
        print("[ai_service] Groq API key not set or invalid, using Gemini API...")
        return await generate_analysis_with_gemini(prompt, gemini_client)

async def generate_analysis_with_gemini(prompt, gemini_client):
    if not gemini_client:
        raise ValueError("Neither Groq nor Gemini API keys are configured correctly.")
        
    model = gemini_client.GenerativeModel(
        model_name='gemini-2.0-flash',
        generation_config={"response_mime_type": "application/json"}
    )
    result = model.generate_content(prompt)
    return json.loads(clean_json_string(result.text))

async def chat_with_agent(payload):
    message = payload.get("message")
    chat_history = payload.get("chatHistory") or []
    resume_text = payload.get("resumeText")
    current_jd_text = payload.get("currentJdText")
    
    system_prompt = f"""
You are Career Concierge, the personal career agent of the user. You are running inside the "Career Command" AI Job Application Command Centre.
You help candidates improve their resumes, prepare for interviews, write cold outreach emails, and evaluate job fit.
Your personality is professional, encouraging, extremely sharp, and analytical.

Current Candidate Resume:
{resume_text or 'No resume uploaded yet.'}

Current Job Description Under Review:
{current_jd_text or 'No job description under review yet.'}

Instructions:
1. Provide actionable, concise advice.
2. Keep responses brief (under 3 paragraphs) to fit the chat bubble UI.
3. Use bullet points for structural readability.
4. When asked to write or tailor text, focus on highlighting real achievements without fabrication.
"""

    groq_client = get_groq_client()
    gemini_client = get_gemini_client()
    
    messages = [{"role": "system", "content": system_prompt}]
    for h in chat_history:
        messages.append({"role": h.get("role"), "content": h.get("content")})
    messages.append({"role": "user", "content": message})
    
    if groq_client:
        try:
            print("[ai_service] Using Groq API for chat...")
            completion = groq_client.chat.completions.create(
                messages=messages,
                model="llama-3.3-70b-versatile"
            )
            return completion.choices[0].message.content
        except Exception as e:
            print(f"[ai_service] Groq Chat Error, falling back to Gemini: {e}")
            return await chat_with_gemini(messages, gemini_client)
    else:
        print("[ai_service] Using Gemini API for chat...")
        return await chat_with_gemini(messages, gemini_client)

async def chat_with_recruiter_agent(payload):
    message = payload.get("message")
    chat_history = payload.get("chatHistory") or []
    resume_text = payload.get("resumeText")
    current_jd_text = payload.get("currentJdText")
    
    system_prompt = f"""
You are an expert AI Recruiter Simulator conducting a mock interview for the candidate.
Your personality is professional, strict but fair, and observant. You are simulating a real interview environment.

Candidate's Resume:
{resume_text or 'No resume provided.'}

Job Description they are interviewing for:
{current_jd_text or 'No job description provided.'}

Instructions:
1. Speak as a recruiter. Ask ONE question at a time.
2. Based on the candidate's answers, you can ask follow-up questions or move on to the next topic.
3. Your interview should cover:
   - Technical questions (development, CS fundamentals, backend/frontend, scalability, security) based on the JD.
   - Behavioral / "Googliness" questions (teamwork, conflict resolution, leadership).
   - Aptitude / Problem-solving questions.
   - Resume-specific questions (diving deep into hackathons, projects, internships they mentioned).
4. Judge their readiness and confidence implicitly through your responses.
5. Keep your responses short and conversational, as if spoken aloud (no markdown formatting like bolding or bullet points).
6. If the user asks for feedback or to end the interview, provide a comprehensive summary of their performance.
"""

    groq_client = get_groq_client()
    gemini_client = get_gemini_client()
    
    messages = [{"role": "system", "content": system_prompt}]
    for h in chat_history:
        messages.append({"role": h.get("role"), "content": h.get("content")})
    messages.append({"role": "user", "content": message})
    
    if groq_client:
        try:
            print("[ai_service] Using Groq API for recruiter chat...")
            completion = groq_client.chat.completions.create(
                messages=messages,
                model="llama-3.3-70b-versatile"
            )
            return completion.choices[0].message.content
        except Exception as e:
            print(f"[ai_service] Groq Chat Error, falling back to Gemini: {e}")
            return await chat_with_gemini(messages, gemini_client)
    else:
        print("[ai_service] Using Gemini API for recruiter chat...")
        return await chat_with_gemini(messages, gemini_client)

async def evaluate_interview_performance(payload):
    chat_history = payload.get("chatHistory", [])
    jd_text = payload.get("currentJdText", "")
    
    # Format chat history for the prompt
    history_text = ""
    for msg in chat_history:
        role = "Recruiter" if msg.get("role") == "assistant" else "Candidate"
        history_text += f"{role}: {msg.get('content')}\n\n"
        
    prompt = f"""
You are an expert Interview Evaluator. Review the following mock interview transcript between an AI Recruiter and a Candidate.
The interview was for a role described by this Job Description:
{jd_text or 'No job description provided.'}

--- INTERVIEW TRANSCRIPT ---
{history_text}
----------------------------

Evaluate the candidate's performance and return a strict JSON object with the following structure:
{{
  "overallScore": <integer 0-100>,
  "confidenceScore": <integer 0-100 based on conciseness and lack of hesitation>,
  "toneAnalysis": "<Analyze the candidate's tone (e.g., nervous, anxious, confident, calm) based on sentence structure, hesitations, and filler words.>",
  "technicalAccuracy": "<Provide a brief assessment of whether the candidate's answers were technically correct or if they made mistakes.>",
  "fillerWords": {{
    "count": <total number of filler words detected>,
    "words": [<array of unique filler words used, e.g., "um", "uh", "like", "you know">]
  }},
  "recommendations": [
    <exactly 3 string bullet points with actionable advice to improve>
  ],
  "qaReview": [
    {{
      "question": "<The recruiter's question>",
      "answer": "<The candidate's exact answer>",
      "feedback": "<1-2 sentences of specific feedback on this answer including whether it was correct>",
      "score": <integer 0-100 for this specific answer>
    }}
  ]
}}

Ensure the output is ONLY valid JSON without any markdown formatting wrappers like ```json.
"""
    
    groq_client = get_groq_client()
    gemini_client = get_gemini_client()
    
    if groq_client:
        try:
            print("[ai_service] Using Groq API for interview evaluation...")
            completion = groq_client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.3-70b-versatile",
                response_format={"type": "json_object"}
            )
            resp_text = completion.choices[0].message.content
            return json.loads(clean_json_string(resp_text))
        except Exception as e:
            print(f"[ai_service] Groq Eval Error, falling back to Gemini: {e}")
            return await generate_analysis_with_gemini(prompt, gemini_client)
    else:
        print("[ai_service] Using Gemini API for interview evaluation...")
        return await generate_analysis_with_gemini(prompt, gemini_client)

async def chat_with_gemini(messages, gemini_client):
    if not gemini_client:
        raise ValueError("No LLM client is available. Set GROQ_API_KEY or GOOGLE_API_KEY.")
        
    system_instruction = ""
    for m in messages:
        if m.get("role") == "system":
            system_instruction = m.get("content", "")
            break
            
    model = gemini_client.GenerativeModel(
        model_name='gemini-2.0-flash',
        system_instruction=system_instruction
    )
    
    contents = []
    for m in messages:
        if m.get("role") == "system":
            continue
        role = "model" if m.get("role") == "assistant" else "user"
        contents.append({
            "role": role,
            "parts": [{"text": m.get("content", "")}]
        })
        
    history_contents = contents[:-1]
    first_user_index = -1
    for idx, c in enumerate(history_contents):
        if c.get("role") == "user":
            first_user_index = idx
            break
            
    sliced_history = history_contents[first_user_index:] if first_user_index != -1 else []
    
    # start_chat expects list of Content types or structured dicts
    # In python: [{'role': 'user', 'parts': [{'text': 'hi'}]}]
    chat = model.start_chat(history=sliced_history)
    last_msg = contents[-1]["parts"][0]["text"]
    result = chat.send_message(last_msg)
    return result.text
