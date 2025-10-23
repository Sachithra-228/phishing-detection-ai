
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.schemas import AnalyzeRequest, AnalyzeResponse, EmailRecord
from app.db import get_db
from app.agents.email_parser import parse_email
from app.agents.risk_scorer import score
from app.agents.alert_generator import make_alert
from datetime import datetime
from typing import List, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Phishing Detection AI Backend",
    description="AI-powered phishing detection system with ML and rule-based analysis",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {
        "ok": True, 
        "timestamp": datetime.utcnow().isoformat(),
        "service": "phishing-detection-ai"
    }

@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(payload: AnalyzeRequest, db=Depends(get_db)):
    """
    Analyze email for phishing risk.
    
    Args:
        payload: Email text to analyze
        db: MongoDB database connection
        
    Returns:
        Analysis results with risk score, level, and alert summary
    """
    try:
        # Parse email
        logger.info("Starting email analysis")
        parsed = parse_email(payload.email_text)
        
        # Score risk
        score_value, level, reason = score(parsed)
        
        # Generate alert
        summary = make_alert(score_value, level, reason, parsed)
        
        # Store in MongoDB
        email_record = {
            "subject": parsed.get("headers", {}).get("subject"),
            "body": parsed.get("body_text"),
            "parsed_data": parsed,
            "risk_score": score_value,
            "risk_level": level,
            "alert_summary": summary,
            "timestamp": datetime.utcnow(),
            "user_id": None  # Will be added when user auth is implemented
        }
        
        try:
            result = await db.emails.insert_one(email_record)
            logger.info(f"Email analysis stored with ID: {result.inserted_id}")
        except Exception as e:
            logger.warning(f"Failed to store email analysis: {e}")
            # Continue without failing the request
        
        return AnalyzeResponse(
            score=score_value,
            level=level,
            reason=reason,
            alert_summary=summary,
            parsed=parsed
        )
        
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/api/gmail/parse", response_model=AnalyzeResponse)
async def gmail_parse(payload: AnalyzeRequest, db=Depends(get_db)):
    """
    Parse Gmail content for phishing analysis.
    
    This endpoint is designed for Chrome extension integration.
    Future implementation will include OAuth token verification and Gmail API integration.
    
    Args:
        payload: Gmail content to analyze
        db: MongoDB database connection
        
    Returns:
        Analysis results
    """
    # For now, reuse the same analyzer
    # Future: verify OAuth tokens, fetch via Gmail API
    return await analyze(payload, db)

@app.get("/api/emails", response_model=List[EmailRecord])
async def get_emails(
    limit: int = 50,
    skip: int = 0,
    risk_level: Optional[str] = None,
    db=Depends(get_db)
):
    """
    Retrieve analyzed emails with optional filtering.
    
    Args:
        limit: Maximum number of emails to return
        skip: Number of emails to skip
        risk_level: Filter by risk level (Low/Medium/High)
        db: MongoDB database connection
        
    Returns:
        List of email records
    """
    try:
        query = {}
        if risk_level:
            query["risk_level"] = risk_level
        
        cursor = db.emails.find(query).sort("timestamp", -1).skip(skip).limit(limit)
        emails = await cursor.to_list(length=limit)
        
        # Convert ObjectId to string for JSON serialization
        for email in emails:
            email["id"] = str(email["_id"])
            del email["_id"]
        
        return emails
        
    except Exception as e:
        logger.error(f"Failed to retrieve emails: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve emails")

@app.get("/api/stats")
async def get_stats(db=Depends(get_db)):
    """
    Get analysis statistics.
    
    Args:
        db: MongoDB database connection
        
    Returns:
        Statistics about analyzed emails
    """
    try:
        total_emails = await db.emails.count_documents({})
        
        # Count by risk level
        high_count = await db.emails.count_documents({"risk_level": "High"})
        medium_count = await db.emails.count_documents({"risk_level": "Medium"})
        low_count = await db.emails.count_documents({"risk_level": "Low"})
        
        # Average risk score
        pipeline = [
            {"$group": {"_id": None, "avg_score": {"$avg": "$risk_score"}}}
        ]
        avg_score_result = await db.emails.aggregate(pipeline).to_list(1)
        avg_score = avg_score_result[0]["avg_score"] if avg_score_result else 0.0
        
        return {
            "total_emails": total_emails,
            "risk_levels": {
                "high": high_count,
                "medium": medium_count,
                "low": low_count
            },
            "average_risk_score": round(avg_score, 3)
        }
        
    except Exception as e:
        logger.error(f"Failed to get stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get statistics")
