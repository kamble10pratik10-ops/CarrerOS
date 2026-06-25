import { Groq } from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Groq client
const getGroqClient = () => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Groq({ apiKey });
};

// Initialize Gemini client
const getGeminiClient = () => {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
};

/**
 * Extracts text from files (PDF/TXT) or images (Screenshot JDs) using Gemini Vision.
 */
export async function parseFileWithGemini(fileBuffer, mimeType, fileName) {
  const genAI = getGeminiClient();
  if (!genAI) {
    throw new Error('Gemini API key (GOOGLE_API_KEY) is not set in environment.');
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const base64Data = fileBuffer.toString('base64');

  const part = {
    inlineData: {
      data: base64Data,
      mimeType: mimeType
    }
  };

  let prompt = '';
  if (mimeType.startsWith('image/')) {
    prompt = 'Extract the full job description text, company name, and job role from this screenshot. Do not format as a chat response, just provide the parsed text clearly.';
  } else if (mimeType === 'application/pdf') {
    prompt = 'Extract the complete text contents of this document (which is a resume or job description). Maintain structure where possible.';
  } else {
    prompt = 'Extract all readable text from this file.';
  }

  const result = await model.generateContent([part, prompt]);
  return result.response.text();
}

/**
 * Main reasoning endpoint: analyzes the JD and Resume, scores the fit, tails resume, drafts outreach, and prep sheets.
 */
export async function generateApplicationAnalysis({ jdText, resumeText, companyName, roleName }) {
  const groq = getGroqClient();
  const genAI = getGeminiClient();

  const prompt = `
You are Career Command, an elite AI Agent that helps students optimize their job applications.
Analyze the following Job Description and the Candidate's Resume.

---
JOB DESCRIPTION:
${jdText}
---
CANDIDATE'S RESUME:
${resumeText}
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
6. Generate an "Interview Prep Pack" containing 3 key questions tailored to the company's domain (e.g., Stripe's payments system) and this role, with categories "CASE STUDY", "STRATEGY", or "CULTURE", estimated prep duration, and AI-suggested talking points.

Return ONLY a valid JSON object matching the exact structure below. Do not include markdown code block syntax (like \`\`\`json) or any wrapping text.

Expected JSON format:
{
  "company": "Company Name",
  "role": "Job Role",
  "signalScore": {
    "fitScore": 85,
    "effort": "Medium",
    "flag": "Green",
    "flagReason": "Reason for the flag"
  },
  "gaps": [
    {"type": "MISSING KEYWORD", "text": "Description of gap"},
    {"type": "SKILL MISMATCH", "text": "Description of mismatch"},
    {"type": "OPPORTUNITY", "text": "Description of opportunity"}
  ],
  "tailoredBullets": [
    {
      "original": "Original resume bullet point",
      "tailored": "Tailored resume bullet point",
      "reason": "AI optimization explanation"
    }
  ],
  "outreachMessages": {
    "confident": "Confident message draft",
    "curious": "Curious message draft",
    "concise": "Concise message draft"
  },
  "interviewQuestions": [
    {
      "type": "CASE STUDY",
      "duration": "15 MINS",
      "question": "The interview question",
      "suggestion": "AI suggestion for talking points"
    }
  ]
}
`;

  // Fallback pattern: use Groq if available, else use Gemini
  if (groq) {
    try {
      console.log('Using Groq API (llama-3.3-70b) for analysis...');
      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' }
      });
      const responseText = chatCompletion.choices[0].message.content;
      return JSON.parse(responseText);
    } catch (error) {
      console.error('Groq API Error, falling back to Gemini:', error);
      return await generateAnalysisWithGemini(prompt, genAI);
    }
  } else {
    console.log('Groq API key not set or invalid, using Gemini API...');
    return await generateAnalysisWithGemini(prompt, genAI);
  }
}

async function generateAnalysisWithGemini(prompt, genAI) {
  if (!genAI) {
    throw new Error('Neither Groq nor Gemini API keys are configured correctly.');
  }
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-1.5-flash',
    generationConfig: { responseMimeType: 'application/json' }
  });
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return JSON.parse(text);
}

/**
 * Handles conversational chat interactions.
 */
export async function chatWithAgent({ message, chatHistory, resumeText, currentJdText }) {
  const groq = getGroqClient();
  const genAI = getGeminiClient();

  const systemPrompt = `
You are Career Concierge, the personal career agent of the user. You are running inside the "Career Command" AI Job Application Command Centre.
You help candidates improve their resumes, prepare for interviews, write cold outreach emails, and evaluate job fit.
Your personality is professional, encouraging, extremely sharp, and analytical.

Current Candidate Resume:
${resumeText || 'No resume uploaded yet.'}

Current Job Description Under Review:
${currentJdText || 'No job description under review yet.'}

Instructions:
1. Provide actionable, concise advice.
2. Keep responses brief (under 3 paragraphs) to fit the chat bubble UI.
3. Use bullet points for structural readability.
4. When asked to write or tailor text, focus on highlighting real achievements without fabrication.
`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message }
  ];

  if (groq) {
    try {
      console.log('Using Groq API for chat...');
      const chatCompletion = await groq.chat.completions.create({
        messages,
        model: 'llama-3.3-70b-versatile'
      });
      return chatCompletion.choices[0].message.content;
    } catch (error) {
      console.error('Groq Chat Error, falling back to Gemini:', error);
      return await chatWithGemini(messages, genAI);
    }
  } else {
    console.log('Using Gemini API for chat...');
    return await chatWithGemini(messages, genAI);
  }
}

async function chatWithGemini(messages, genAI) {
  if (!genAI) {
    throw new Error('No LLM client is available. Set GROQ_API_KEY or GOOGLE_API_KEY.');
  }
  
  const systemInstruction = messages.find(m => m.role === 'system')?.content || '';
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-1.5-flash',
    systemInstruction: systemInstruction
  });
  
  // Format history for Gemini
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  const historyContents = contents.slice(0, -1);
  const firstUserIndex = historyContents.findIndex(c => c.role === 'user');
  const slicedHistory = firstUserIndex !== -1 ? historyContents.slice(firstUserIndex) : [];

  const chat = model.startChat({
    history: slicedHistory
  });

  const lastMessage = contents[contents.length - 1].parts[0].text;
  const result = await chat.sendMessage(lastMessage);
  return result.response.text();
}
