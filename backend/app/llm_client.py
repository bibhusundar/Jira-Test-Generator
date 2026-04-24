import httpx
import os
import json
import yaml
from .schemas import JiraIssueContext, TestCaseBase
from typing import List

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3:latest")

async def generate_test_cases(context: JiraIssueContext, template_name: str, provider: str = "ollama", groq_api_key: str = None) -> List[TestCaseBase]:
    template_path = os.path.join(os.path.dirname(__file__), "..", "templates", template_name)
    if not os.path.exists(template_path):
        template_path = os.path.join(os.path.dirname(__file__), "..", "templates", "default.yaml")
        
    with open(template_path, 'r') as f:
        template = yaml.safe_load(f)
        
    system_prompt = template.get("prompt", "Generate 5 test cases in JSON array format.")
    
    user_prompt = (
        f"Jira Issue Context:\\n"
        f"Summary: {context.summary}\\n"
        f"Type: {context.issue_type}\\n"
        f"Priority: {context.priority}\\n"
        f"Description: {context.description}\\n"
        f"Acceptance Criteria: {context.acceptance_criteria}\\n"
    )

    if provider == "groq":
        key = groq_api_key or os.getenv("GROQ_API_KEY")
        if not key:
            raise Exception("Groq API key is missing. Assign it from frontend or set GROQ_API_KEY.")
            
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": system_prompt + " Return a JSON object with a single 'test_cases' key that maps to an array of objects."},
                {"role": "user", "content": user_prompt}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            response_text = data["choices"][0]["message"]["content"]
            
            try:
                parsed = json.loads(response_text)
                
                # Extract array strictly from json_object wrapping
                if isinstance(parsed, dict) and "test_cases" in parsed:
                    parsed = parsed["test_cases"]
                elif isinstance(parsed, dict) and len(parsed.keys()) > 0:
                    parsed = list(parsed.values())[0]
                    
                cases = [TestCaseBase(**tc) for tc in parsed]
                return cases
            except Exception as e:
                print("Failed to parse JSON from Groq: ", e)
                print("Response was:", response_text)
                return []

    else:
        # Default Ollama behavior
        url = f"{OLLAMA_BASE_URL.rstrip('/')}/api/generate"
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": f"System: {system_prompt}\\n\\nUser: {user_prompt}",
            "stream": False,
            "format": "json"
        }
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            response_text = data.get("response", "[]")
            
            try:
                parsed = json.loads(response_text)
                if not isinstance(parsed, list):
                    if isinstance(parsed, dict) and len(parsed.keys()) == 1:
                        parsed = list(parsed.values())[0]
                
                cases = [TestCaseBase(**tc) for tc in parsed]
                return cases
            except Exception as e:
                print("Failed to parse JSON from LLM: ", e)
                print("Response was:", response_text)
                return []
