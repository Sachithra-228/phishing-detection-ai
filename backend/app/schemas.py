
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class AnalyzeRequest(BaseModel):
    email_text: str

class AnalyzeResponse(BaseModel):
    score: float
    level: str
    reason: str
    alert_summary: str
    parsed: Optional[Dict[str, Any]]

class EmailRecord(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    user_id: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    parsed_data: Optional[Dict[str, Any]] = None
    risk_score: Optional[float] = None
    risk_level: Optional[str] = None
    alert_summary: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        validate_by_name = True
