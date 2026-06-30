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

def call_llm(prompt, is_json=True, fallback_mock=None):
    groq_client = get_groq_client()
    if groq_client:
        try:
            kwargs = {
                "messages": [{"role": "user", "content": prompt}],
                "model": "llama-3.3-70b-versatile"
            }
            if is_json:
                kwargs["response_format"] = {"type": "json_object"}
            completion = groq_client.chat.completions.create(**kwargs)
            text = completion.choices[0].message.content
            return json.loads(text) if is_json else text
        except Exception as e:
            print(f"[coding_mentor] Groq failed: {e}")
            
    gen_ai = get_gemini_client()
    if gen_ai:
        try:
            model = gen_ai.GenerativeModel('gemini-1.5-flash')
            result = model.generate_content(prompt)
            if is_json:
                return json.loads(clean_json_string(result.text))
            return result.text
        except Exception as e:
            print(f"[coding_mentor] Gemini failed: {e}")
            
    return fallback_mock


async def generate_coding_hint(problem, code, language, hint_level, chat_history, user_level):
    """Progressive 5-level hint system."""

    level_instructions = {
        1: "Give a TINY nudge. One sentence. Just point them in the right direction without revealing the approach. Example: 'Think about which data structure allows constant-time lookup.'",
        2: "Explain the general algorithm/approach they should use. Do NOT show any code. Describe the strategy in 2-3 sentences.",
        3: "Show pseudocode for the solution. Use plain English steps, not real code. Be detailed but don't write actual syntax.",
        4: "Show the KEY section of the solution in actual code. Only reveal the critical logic (e.g., the core loop or recursive call), not the full solution.",
        5: "Show the COMPLETE working solution with detailed comments explaining each step. Only do this because the user explicitly requested it."
    }

    instruction = level_instructions.get(hint_level, level_instructions[1])

    history_text = ""
    if chat_history:
        recent = chat_history[-6:]
        history_text = "\n".join([f"{'User' if m.get('role') == 'user' else 'Mentor'}: {m.get('content', '')}" for m in recent])

    prompt = f"""You are an expert coding mentor helping a {user_level}-level programmer.

PROBLEM:
{json.dumps(problem, indent=2) if isinstance(problem, dict) else problem}

STUDENT'S CURRENT CODE ({language}):
```{language}
{code}
```

PREVIOUS CONVERSATION:
{history_text}

HINT LEVEL: {hint_level}/5
INSTRUCTION: {instruction}

{"Adapt your explanation for a beginner — use simple language and analogies." if user_level == "Beginner" else ""}
{"Give a standard explanation suitable for someone with moderate coding experience." if user_level == "Intermediate" else ""}
{"Be concise and technical. Challenge them to think deeper." if user_level == "Advanced" else ""}

Respond with ONLY a JSON object:
{{
  "hint": "Your hint text here (use markdown formatting for code blocks if needed)",
  "encouragement": "A brief encouraging message"
}}"""

    fallback = {"hint": "Mock hint: Check if you are using the right data structure. (API Error - check your keys)", "encouragement": "Keep going! You're making progress."}
    return call_llm(prompt, is_json=True, fallback_mock=fallback)


async def review_code_live(problem, code, language, user_level):
    """Live code review analyzing multiple dimensions."""

    prompt = f"""You are a senior software engineer reviewing a {user_level}-level student's code.

PROBLEM:
{json.dumps(problem, indent=2) if isinstance(problem, dict) else problem}

CODE ({language}):
```{language}
{code}
```

Analyze the code and provide a thorough review. For each issue found, explain WHY it's a problem, WHAT happens because of it, and HOW to improve it.

Respond with ONLY a valid JSON object:
{{
  "overallScore": 0-100,
  "summary": "1-2 sentence overall assessment",
  "issues": [
    {{
      "category": "one of: Logic Error | Naming | Complexity | Edge Case | Bug | Memory | Security | Style | Duplicate Code",
      "severity": "one of: critical | warning | info",
      "line": "approximate line or section description",
      "description": "What the issue is",
      "why": "Why this is problematic",
      "suggestion": "How to fix it (with code snippet if helpful)"
    }}
  ],
  "strengths": ["Things the student did well"],
  "timeComplexity": "Current time complexity",
  "spaceComplexity": "Current space complexity"
}}"""

    fallback = {"overallScore": 50, "summary": "Mock review: API Error prevented real review.", "issues": [{"category": "API", "severity": "warning", "line": "N/A", "description": "API Key Invalid", "why": "The LLM request failed.", "suggestion": "Fix your API key"}], "strengths": ["You wrote some code!"], "timeComplexity": "O(N)", "spaceComplexity": "O(1)"}
    return call_llm(prompt, is_json=True, fallback_mock=fallback)


async def debug_code(problem, code, language, error_output, error_type):
    """Debug compilation or runtime errors."""

    prompt = f"""You are a patient debugging mentor helping a student understand their error.

PROBLEM:
{json.dumps(problem, indent=2) if isinstance(problem, dict) else problem}

CODE ({language}):
```{language}
{code}
```

ERROR TYPE: {error_type}
ERROR OUTPUT:
{error_output}

Explain this error as if talking to a student. Be clear and educational.

Respond with ONLY a valid JSON object:
{{
  "errorExplanation": "What this error means in simple language",
  "rootCause": "Why this error occurred (the actual cause in their code)",
  "lineHint": "Which line or section is causing it",
  "fix": "How to fix it (with corrected code snippet)",
  "prevention": "How to avoid this type of error in the future",
  "concept": "The underlying programming concept they should review"
}}"""

    fallback = {"errorExplanation": "API Error prevented actual debugging.", "rootCause": "Invalid API Key", "lineHint": "N/A", "fix": "Check your .env file", "prevention": "Ensure quota and valid key", "concept": "API Authentication"}
    return call_llm(prompt, is_json=True, fallback_mock=fallback)


async def analyze_complexity(problem, code, language):
    """Analyze time and space complexity with optimization suggestions."""

    prompt = f"""You are an algorithms expert analyzing code complexity.

PROBLEM:
{json.dumps(problem, indent=2) if isinstance(problem, dict) else problem}

CODE ({language}):
```{language}
{code}
```

Provide a thorough complexity analysis.

Respond with ONLY a valid JSON object:
{{
  "timeComplexity": {{
    "best": "O(?)",
    "average": "O(?)",
    "worst": "O(?)",
    "explanation": "Why this is the complexity"
  }},
  "spaceComplexity": {{
    "total": "O(?)",
    "auxiliary": "O(?)",
    "explanation": "What uses the space"
  }},
  "optimizations": [
    {{
      "description": "What could be optimized",
      "newComplexity": "What the complexity would become",
      "approach": "How to achieve it",
      "tradeoff": "Any trade-offs involved"
    }}
  ],
  "alternativeAlgorithms": [
    {{
      "name": "Algorithm name",
      "complexity": "Its complexity",
      "when": "When it's better to use"
    }}
  ]
}}"""

    fallback = {"timeComplexity": {"best": "O(1)", "average": "O(N)", "worst": "O(N^2)", "explanation": "Mock explanation due to API error"}, "spaceComplexity": {"total": "O(1)", "auxiliary": "O(1)", "explanation": "Mock space complexity"}, "optimizations": [], "alternativeAlgorithms": []}
    return call_llm(prompt, is_json=True, fallback_mock=fallback)


async def simulate_execution(code, language, test_cases):
    """AI-powered code execution simulation."""

    tc_text = json.dumps(test_cases, indent=2) if isinstance(test_cases, list) else str(test_cases)

    prompt = f"""You are a code execution engine. Carefully trace through the following code mentally and determine the output for each test case.

CODE ({language}):
```{language}
{code}
```

TEST CASES:
{tc_text}

For each test case, trace through the code step by step and determine:
1. Whether the code would compile/parse successfully
2. Whether it would produce the expected output
3. The actual output it would produce
4. Whether there would be any runtime errors

Respond with ONLY a valid JSON object:
{{
  "compiles": true/false,
  "compileError": "error message if compiles is false, empty string otherwise",
  "results": [
    {{
      "input": "the test input",
      "expected": "expected output",
      "actual": "what the code actually produces",
      "passed": true/false,
      "error": "runtime error if any, empty string otherwise"
    }}
  ],
  "summary": "X/Y test cases passed"
}}"""

    fallback = {"compiles": False, "compileError": "Mock compilation error: LLM API request failed. Please check your API keys.", "results": [{"input": "mock input", "expected": "mock", "actual": "error", "passed": False, "error": "API Error"}], "summary": "0/1 test cases passed"}
    return call_llm(prompt, is_json=True, fallback_mock=fallback)


async def generate_reflection(problem, code, language, results, hints_used, time_spent, user_level):
    """Post-submission reflection and learning analysis."""

    prompt = f"""You are a coding mentor providing a post-submission reflection.

PROBLEM:
{json.dumps(problem, indent=2) if isinstance(problem, dict) else problem}

STUDENT'S SOLUTION ({language}):
```{language}
{code}
```

RESULTS: {json.dumps(results) if isinstance(results, dict) else results}
HINTS USED: {hints_used}
TIME SPENT: {time_spent} seconds
STUDENT LEVEL: {user_level}

Provide a thoughtful, educational reflection.

Respond with ONLY a valid JSON object:
{{
  "didWell": ["Things the student did well - be specific about their code"],
  "mistakes": ["Mistakes or areas for improvement"],
  "interviewerPerspective": "How a technical interviewer would evaluate this solution",
  "topCandidateSolution": "Brief description of how a top candidate would solve this differently (if applicable)",
  "conceptsToRevise": ["Key CS concepts they should review"],
  "recommendedProblems": [
    {{
      "title": "Problem name",
      "difficulty": "Easy/Medium/Hard",
      "topic": "Topic",
      "reason": "Why this problem would help them"
    }}
  ],
  "overallGrade": "A/B/C/D/F",
  "encouragement": "Motivational closing message"
}}"""

    fallback = {"didWell": ["Attempted the problem"], "mistakes": ["Encountered an API error"], "interviewerPerspective": "The candidate's API key seems invalid.", "topCandidateSolution": "A top candidate would have valid API keys.", "conceptsToRevise": ["API Authentication"], "recommendedProblems": [], "overallGrade": "N/A", "encouragement": "Keep practicing!"}
    return call_llm(prompt, is_json=True, fallback_mock=fallback)


async def mentor_chat(problem, code, language, message, chat_history, user_level, interview_mode=False):
    """Free-form mentor chat with full session context."""

    history_text = ""
    if chat_history:
        recent = chat_history[-10:]
        history_text = "\n".join([f"{'User' if m.get('role') == 'user' else 'Mentor'}: {m.get('content', '')}" for m in recent])

    if interview_mode:
        persona = """You are a STRICT technical interviewer. Rules:
- NEVER give direct answers or solutions
- Only give interviewer-style hints (e.g., "What if the input were sorted?")
- Ask follow-up questions about their approach
- Request optimizations
- Ask about edge cases
- Question their time/space complexity
- Evaluate their communication clarity
- Be professional but challenging"""
    else:
        persona = f"""You are a friendly, expert coding mentor helping a {user_level}-level programmer.
- Understand their existing code before answering
- If they ask to review: analyze their code thoroughly
- If they ask to optimize: suggest specific improvements
- If they ask conceptual questions: explain with analogies and examples
- If they ask to convert approaches (DFS to BFS, etc.): show both with explanations
- Never just give answers — guide them to understand
- Use code snippets when helpful
- Be encouraging and educational"""

    prompt = f"""{persona}

CURRENT PROBLEM:
{json.dumps(problem, indent=2) if isinstance(problem, dict) else problem}

STUDENT'S CURRENT CODE ({language}):
```{language}
{code}
```

CONVERSATION HISTORY:
{history_text}

STUDENT'S MESSAGE: {message}

Respond naturally as a mentor. Use markdown formatting for code blocks.
Keep your response focused and educational. Do not use JSON formatting — respond in plain markdown text."""

    fallback = "I'm having trouble connecting to my AI brain. Please check your API keys."
    return call_llm(prompt, is_json=False, fallback_mock=fallback)


async def estimate_user_level(stats):
    """Estimate user skill level based on their history."""
    problems_solved = stats.get("problems_solved", 0)
    hints_used = stats.get("total_hints_used", 0)
    avg_time = stats.get("avg_solve_time_seconds", 0)

    if problems_solved == 0:
        return "Beginner"

    hint_ratio = hints_used / max(problems_solved, 1)

    if problems_solved >= 20 and hint_ratio < 1.5 and avg_time < 1200:
        return "Advanced"
    elif problems_solved >= 5 and hint_ratio < 3:
        return "Intermediate"
    else:
        return "Beginner"
