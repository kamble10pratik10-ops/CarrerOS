import { saveApplication } from './datastore';
import { saveTailoredResume } from './docstore';

/**
 * Orchestrates the full agentic job application workflow:
 * 1. Takes the parsed Job Description and the Candidate's Resume.
 * 2. Triggers the AI logic to extract details, score the fit, tailor the resume, draft outreach messages, and generate prep packs.
 * 3. Saves the compiled application to the datastore (Kanban pipeline).
 */
export async function triggerApplicationWorkflow({ jdText, resumeText, companyName, roleName, aiProvider }) {
  try {
    // 1. Call our Next.js API route that handles the AI reasoning chain
    // (We will call the API relative to the server host or directly run the reasoning helper function)
    
    // In a Next.js server context, we can import and run the reasoning logic directly 
    // to avoid HTTP overhead. We'll import it from our API routes / services layer.
    const { generateApplicationAnalysis } = await import('../../services/aiService');
    
    console.log(`Starting Workflow for: ${roleName || 'Unknown Role'} at ${companyName || 'Unknown Company'}`);
    
    // 2. Run the AI reasoning engines (Groq + Gemini)
    const analysisResult = await generateApplicationAnalysis({
      jdText,
      resumeText,
      companyName,
      roleName
    });

    // 3. Construct the application entry
    const appEntry = {
      id: `app_${Date.now()}`,
      company: analysisResult.company || companyName || 'Unknown Company',
      role: analysisResult.role || roleName || 'Software Engineer',
      status: 'Applied', // Default status in Kanban
      dateApplied: new Date().toISOString(),
      matchScore: analysisResult.signalScore.fitScore || 50,
      effort: analysisResult.signalScore.effort || 'Medium',
      flag: analysisResult.signalScore.flag || 'Green',
      flagReason: analysisResult.signalScore.flagReason || '',
      jdText: jdText,
      tailoredBullets: JSON.stringify(analysisResult.tailoredBullets || []),
      outreachMessages: analysisResult.outreachMessages || { confident: '', curious: '', concise: '' },
      interviewQuestions: analysisResult.interviewQuestions || [],
      gaps: analysisResult.gaps || [],
    };

    // 4. Save to Lemma DataStore & DocStore
    const savedApp = saveApplication(appEntry);
    if (savedApp) {
      saveTailoredResume(savedApp.id, appEntry.tailoredBullets);
    }

    return savedApp;
  } catch (error) {
    console.error('Lemma Workflow Engine Error:', error);
    throw error;
  }
}
