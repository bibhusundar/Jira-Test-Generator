from sqlalchemy import create_engine, Column, Integer, String, Text, JSON
from sqlalchemy.orm import sessionmaker, declarative_base

SQLALCHEMY_DATABASE_URL = "sqlite:///./testcases.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class TestCaseRecord(Base):
    __tablename__ = "test_cases"

    id = Column(Integer, primary_key=True, index=True)
    tc_id = Column(String, index=True)
    title = Column(String)
    tc_type = Column(String)
    priority = Column(String)
    preconditions = Column(Text)
    steps = Column(JSON)
    test_data = Column(Text)
    expected_result = Column(Text)
    linked_jira_id = Column(String, index=True)

Base.metadata.create_all(bind=engine)
