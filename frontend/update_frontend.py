import sys
import re

file_path = r'c:\Users\prati\Downloads\CareerOS\frontend\src\app\components\CodingMentorPage.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove the PROBLEMS array
content = re.sub(r'const PROBLEMS = \[.*?\];', '', content, flags=re.DOTALL)

# 2. Add state and useEffect for fetching problems
state_code = """  const [selTopic, setSelTopic] = useState('All');

  const [problems, setProblems] = useState([]);
  const [isLoadingProblems, setIsLoadingProblems] = useState(true);

  useEffect(() => {
    const fetchProblems = async () => {
      setIsLoadingProblems(true);
      try {
        const queryParams = new URLSearchParams();
        if (selDifficulty !== 'All') queryParams.append('difficulty', selDifficulty);
        if (selTopic !== 'All') queryParams.append('topic', selTopic);
        
        const res = await fetch(`${BACKEND_URL}/api/codelab/questions?${queryParams.toString()}`);
        const data = await res.json();
        if (data.success) {
          setProblems(data.questions);
        }
      } catch (err) {
        console.error("Failed to fetch problems", err);
      } finally {
        setIsLoadingProblems(false);
      }
    };
    fetchProblems();
  }, [selDifficulty, selTopic]);
"""
content = content.replace("  const [selTopic, setSelTopic] = useState('All');", state_code)

# 3. Replace filteredProblems logic
filter_logic = r'''  const filteredProblems = PROBLEMS\.filter\(p => \{
    if \(selDifficulty !== 'All' && p\.difficulty !== selDifficulty\) return false;
    if \(selTopic !== 'All' && p\.topic !== selTopic\) return false;
    return true;
  \}\);'''
  
content = re.sub(filter_logic, '  const filteredProblems = problems;', content)

# 4. Replace length checks
content = content.replace('PROBLEMS.length', 'problems.length')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Frontend updated successfully.')
