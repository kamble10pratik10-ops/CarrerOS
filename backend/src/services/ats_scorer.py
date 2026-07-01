import re
from typing import Dict, Any, Tuple

def calculate_ats_score(resume_text: str, jd_text: str) -> Tuple[int, Dict[str, Any]]:
    """
    Calculates a deterministic ATS score based on measurable factors.
    Returns a tuple of (final_score, factors_dict).
    """
    score = 0
    max_score = 100
    factors = {}

    resume_lower = resume_text.lower() if resume_text else ""
    jd_lower = jd_text.lower() if jd_text else ""

    # 1. Contact Information Completeness (10 pts)
    contact_score = 0
    email_pattern = r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+'
    phone_pattern = r'(\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}'
    linkedin_pattern = r'linkedin\.com/in/[a-zA-Z0-9_-]+'
    github_pattern = r'github\.com/[a-zA-Z0-9_-]+'

    has_email = bool(re.search(email_pattern, resume_lower))
    has_phone = bool(re.search(phone_pattern, resume_lower))
    has_linkedin = bool(re.search(linkedin_pattern, resume_lower))
    has_github = bool(re.search(github_pattern, resume_lower))

    if has_email: contact_score += 3
    if has_phone: contact_score += 3
    if has_linkedin: contact_score += 2
    if has_github: contact_score += 2
    
    score += contact_score
    factors['contact_info'] = {
        'score': contact_score,
        'max': 10,
        'details': f"Email: {has_email}, Phone: {has_phone}, LinkedIn: {has_linkedin}, GitHub: {has_github}"
    }

    # 2. Resume Structure / Organization (15 pts)
    structure_score = 0
    common_sections = ['experience', 'education', 'skills', 'projects']
    found_sections = []
    
    for section in common_sections:
        # Look for section headers (often capitalized or starting a line)
        pattern = rf'(?i)^[#\s]*{section}\b'
        if re.search(pattern, resume_lower, re.MULTILINE) or section in resume_lower:
            structure_score += 3.75  # 15 / 4
            found_sections.append(section)
            
    score += structure_score
    factors['structure'] = {
        'score': structure_score,
        'max': 15,
        'details': f"Found sections: {', '.join(found_sections)}"
    }

    # 3. Readability & Length (10 pts)
    length_score = 10
    word_count = len(resume_lower.split())
    if word_count < 200:
        length_score = 4 # Too short
    elif word_count > 1000:
        length_score = 6 # Too long
        
    score += length_score
    factors['readability'] = {
        'score': length_score,
        'max': 10,
        'details': f"Word count: {word_count}"
    }

    # 4. Action Verbs (15 pts)
    action_verbs = ['developed', 'designed', 'implemented', 'led', 'managed', 'created', 'built', 
                    'optimized', 'improved', 'reduced', 'increased', 'integrated', 'architected', 'spearheaded']
    verbs_found = sum(1 for verb in action_verbs if verb in resume_lower)
    verbs_score = min(15, verbs_found * 1.5)
    
    score += verbs_score
    factors['action_verbs'] = {
        'score': verbs_score,
        'max': 15,
        'details': f"Found {verbs_found} strong action verbs."
    }

    # 5. Quantified Achievements (20 pts)
    # Look for numbers, percentages, or dollar signs followed/preceded by words indicating impact
    quant_pattern = r'\b(\d+%|\$?\d+(?:k|m|b)?)\b'
    quant_matches = len(re.findall(quant_pattern, resume_lower))
    quant_score = min(20, quant_matches * 4)
    
    score += quant_score
    factors['quantified_achievements'] = {
        'score': quant_score,
        'max': 20,
        'details': f"Found {quant_matches} quantified metrics (%, $, numbers)."
    }

    # 6. Keyword Matching vs JD (30 pts)
    jd_score = 0
    if jd_text:
        # Simple extraction of potential keywords from JD (words > 4 chars, ignoring common stop words)
        stop_words = {'about', 'their', 'there', 'which', 'would', 'could', 'should', 'these', 'those', 'requirements', 'experience', 'company', 'working', 'years', 'skills', 'team'}
        jd_words = re.findall(r'\b[a-z]{4,}\b', jd_lower)
        jd_keywords = set([w for w in jd_words if w not in stop_words])
        
        # We cap at the top 30 most unique words for matching
        match_count = 0
        matched_keywords = []
        for kw in list(jd_keywords)[:50]:
            if kw in resume_lower:
                match_count += 1
                matched_keywords.append(kw)
                
        # Calculate percentage match based on a reasonable expectation (e.g. hitting 15 key terms is excellent)
        jd_score = min(30, (match_count / 15.0) * 30) if len(jd_keywords) > 0 else 30
        
        factors['jd_match'] = {
            'score': jd_score,
            'max': 30,
            'details': f"Matched {match_count} keywords from JD."
        }
    else:
        jd_score = 30
        factors['jd_match'] = {
            'score': 30,
            'max': 30,
            'details': "No JD provided. Granted default score."
        }
        
    score += jd_score

    final_score = int(min(100, max(0, score)))
    return final_score, factors
