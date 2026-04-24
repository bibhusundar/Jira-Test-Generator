from pydantic import BaseModel
from typing import List, Optional

class TestCaseBase(BaseModel):
    id: str
    title: str
    type: str
    priority: str
    preconditions: str
    steps: List[str]
    test_data: str
    expected_result: str
    linked_jira_id: str

class GenerateRequest(BaseModel):
    jira_url: str
    email: str
    api_token: str
    jira_id: str
    template_name: str = "default.yaml"
    provider: str = "ollama"
    groq_api_key: Optional[str] = None

class JiraAuthTest(BaseModel):
    jira_url: str
    email: str
    api_token: str

class WriteBackRequest(BaseModel):
    jira_url: str
    email: str
    api_token: str
    jira_id: str
    test_cases: List[TestCaseBase]

class JiraIssueContext(BaseModel):
    summary: str
    description: str
    issue_type: str
    priority: str
    acceptance_criteria: Optional[str] = None
    components: List[str]
