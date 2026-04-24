import httpx
import base64
from typing import Dict, Any
from .schemas import JiraIssueContext

def get_auth_header(email: str, api_token: str) -> str:
    auth_str = f"{email}:{api_token}"
    b64_auth = base64.b64encode(auth_str.encode()).decode()
    return f"Basic {b64_auth}"

async def test_connection(jira_url: str, email: str, api_token: str) -> bool:
    url = f"{jira_url.rstrip('/')}/rest/api/3/myself"
    headers = {
        "Authorization": get_auth_header(email, api_token),
        "Accept": "application/json"
    }
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, timeout=10.0)
        return response.status_code == 200

async def fetch_issue(jira_url: str, email: str, api_token: str, jira_id: str) -> JiraIssueContext:
    url = f"{jira_url.rstrip('/')}/rest/api/3/issue/{jira_id}"
    headers = {
        "Authorization": get_auth_header(email, api_token),
        "Accept": "application/json"
    }
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, timeout=15.0)
        response.raise_for_status()
        data = response.json()
        
        url_v2 = f"{jira_url.rstrip('/')}/rest/api/2/issue/{jira_id}"
        resp_v2 = await client.get(url_v2, headers=headers, timeout=15.0)
        data_v2 = resp_v2.json() if resp_v2.status_code == 200 else data
        fields_v2 = data_v2.get("fields", {})

        description = fields_v2.get("description", "")
        if not isinstance(description, str):
            description = str(description)

        acceptance_criteria = ""
        for k, v in fields_v2.items():
            if isinstance(v, str) and "acceptance" in str(k).lower():
                acceptance_criteria = v
                break
        
        return JiraIssueContext(
            summary=fields_v2.get("summary", ""),
            description=description,
            issue_type=fields_v2.get("issuetype", {}).get("name", "Unknown"),
            priority=fields_v2.get("priority", {}).get("name", "Unknown"),
            acceptance_criteria=acceptance_criteria if acceptance_criteria else None,
            components=[comp.get("name") for comp in fields_v2.get("components", [])]
        )

async def write_back_to_jira(jira_url: str, email: str, api_token: str, jira_id: str, test_case: Any) -> bool:
    url = f"{jira_url.rstrip('/')}/rest/api/2/issue/{jira_id}/comment"
    headers = {
        "Authorization": get_auth_header(email, api_token),
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    
    body = (
        f"Generated Test Case: {test_case.title}\\n"
        f"Type: {test_case.type} | Priority: {test_case.priority}\\n"
        f"Preconditions: {test_case.preconditions}\\n"
        f"Steps: {', '.join(test_case.steps)}\\n"
        f"Expected: {test_case.expected_result}"
    )
    payload = {"body": body}
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload, timeout=10.0)
        return response.status_code in (200, 201)
