import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from .schemas import GenerateRequest, JiraAuthTest, WriteBackRequest, TestCaseBase
from .jira_client import test_connection, fetch_issue, write_back_to_jira
from .llm_client import generate_test_cases
from .database import SessionLocal, TestCaseRecord
from sqlalchemy.orm import Session

app = FastAPI(title="Jira Test Case Generator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/api/jira/test-connection")
async def api_test_connection(auth: JiraAuthTest):
    success = await test_connection(auth.jira_url, auth.email, auth.api_token)
    if not success:
        raise HTTPException(status_code=401, detail="Authentication failed")
    return {"status": "success"}

@app.post("/api/jira/fetch-issue")
async def api_fetch_issue(req: GenerateRequest):
    try:
        context = await fetch_issue(req.jira_url, req.email, req.api_token, req.jira_id)
        return context
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/testcases/generate")
async def api_generate(req: GenerateRequest, db: Session = Depends(get_db)):
    try:
        context = await fetch_issue(req.jira_url, req.email, req.api_token, req.jira_id)
        test_cases = await generate_test_cases(context, req.template_name, req.provider, req.groq_api_key)
        
        for tc in test_cases:
            record = TestCaseRecord(
                tc_id=tc.id,
                title=tc.title,
                tc_type=tc.type,
                priority=tc.priority,
                preconditions=tc.preconditions,
                steps=tc.steps,
                test_data=tc.test_data,
                expected_result=tc.expected_result,
                linked_jira_id=tc.linked_jira_id
            )
            db.add(record)
        db.commit()

        return test_cases
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/testcases/export")
async def api_export(req: WriteBackRequest):
    successes = 0
    for tc in req.test_cases:
        res = await write_back_to_jira(req.jira_url, req.email, req.api_token, req.jira_id, tc)
        if res:
            successes += 1
    return {"status": "success", "written": successes}
