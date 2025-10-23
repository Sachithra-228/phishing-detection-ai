
from typing import Dict, Any, List, Optional
import re
import email
import faiss
import numpy as np
from urllib.parse import urlparse
from bs4 import BeautifulSoup
import os

# Global variables for spaCy (will be loaded lazily)
nlp = None
spacy = None

def extract_headers(email_text: str) -> Dict[str, str]:
    """Extract email headers using Python's email module."""
    try:
        msg = email.message_from_string(email_text)
        headers = {}
        
        # Extract common headers
        for header in ['subject', 'from', 'to', 'date', 'message-id', 'reply-to']:
            value = msg.get(header)
            if value:
                headers[header] = str(value)
        
        return headers
    except Exception:
        # Fallback to regex if email parsing fails
        headers = {}
        subject_match = re.search(r"Subject:\s*(.*)", email_text, re.IGNORECASE | re.MULTILINE)
        if subject_match:
            headers['subject'] = subject_match.group(1).strip()
        return headers

def extract_urls(text: str) -> List[Dict[str, Any]]:
    """Extract URLs with additional metadata."""
    url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
    urls = re.findall(url_pattern, text)
    
    url_data = []
    for url in urls:
        try:
            parsed = urlparse(url)
            url_data.append({
                "url": url,
                "domain": parsed.netloc,
                "path": parsed.path,
                "scheme": parsed.scheme,
                "is_shortened": len(url) < 30,  # Basic heuristic
                "has_suspicious_tld": any(tld in parsed.netloc.lower() for tld in ['.tk', '.ml', '.ga', '.cf'])
            })
        except Exception:
            url_data.append({"url": url, "domain": "", "path": "", "scheme": "", "is_shortened": False, "has_suspicious_tld": False})
    
    return url_data

def extract_attachments(email_text: str) -> List[Dict[str, str]]:
    """Extract attachment information from email."""
    attachments = []
    
    # Look for Content-Disposition: attachment
    attachment_pattern = r'Content-Disposition:\s*attachment[^;]*filename[=:]\s*["\']?([^"\'\s]+)["\']?'
    matches = re.findall(attachment_pattern, email_text, re.IGNORECASE)
    
    for filename in matches:
        attachments.append({
            "name": filename,
            "type": filename.split('.')[-1] if '.' in filename else "unknown"
        })
    
    return attachments

def extract_entities(text: str) -> List[Dict[str, Any]]:
    """Extract named entities using spaCy NER."""
    global nlp, spacy
    
    # Load spaCy lazily if not already loaded
    if nlp is None:
        try:
            import spacy
            nlp = spacy.load("en_core_web_sm")
        except (OSError, ImportError, ModuleNotFoundError):
            # Fallback if spaCy or model not available
            return []
    
    try:
        doc = nlp(text)
        entities = []
        
        for ent in doc.ents:
            entities.append({
                "type": ent.label_,
                "text": ent.text,
                "start": ent.start_char,
                "end": ent.end_char,
                "confidence": 0.8  # spaCy doesn't provide confidence by default
            })
        
        return entities
    except Exception:
        return []

def extract_body_text(email_text: str) -> str:
    """Extract clean body text from email."""
    try:
        msg = email.message_from_string(email_text)
        
        if msg.is_multipart():
            body_parts = []
            for part in msg.walk():
                if part.get_content_type() == "text/plain":
                    body_parts.append(part.get_payload(decode=True).decode('utf-8', errors='ignore'))
                elif part.get_content_type() == "text/html":
                    # Extract text from HTML
                    html_content = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                    soup = BeautifulSoup(html_content, 'html.parser')
                    body_parts.append(soup.get_text())
            
            return "\n".join(body_parts)
        else:
            content_type = msg.get_content_type()
            if content_type == "text/html":
                soup = BeautifulSoup(msg.get_payload(decode=True).decode('utf-8', errors='ignore'), 'html.parser')
                return soup.get_text()
            else:
                return msg.get_payload(decode=True).decode('utf-8', errors='ignore')
    except Exception:
        # Fallback: return original text
        return email_text

def get_faiss_similarity(body_text: str) -> Optional[Dict[str, Any]]:
    """Get similarity scores from FAISS index if available."""
    index_path = "./data/phishing_corpus.index"
    
    if not os.path.exists(index_path):
        return None
    
    try:
        # Load FAISS index
        index = faiss.read_index(index_path)
        
        # Simple TF-IDF vectorization for similarity
        # In production, you'd want to use the same vectorizer as training
        from sklearn.feature_extraction.text import TfidfVectorizer
        vectorizer = TfidfVectorizer(max_features=1000, stop_words='english')
        
        # This is a simplified approach - in production you'd have pre-computed vectors
        vectors = vectorizer.fit_transform([body_text]).toarray()
        
        # Search for similar documents
        scores, indices = index.search(vectors.astype(np.float32), k=5)
        
        return {
            "similarity_scores": scores[0].tolist(),
            "top_matches": indices[0].tolist(),
            "max_similarity": float(np.max(scores))
        }
    except Exception:
        return None

def parse_email(raw: str) -> Dict[str, Any]:
    """
    Parse email with comprehensive extraction of headers, URLs, entities, and attachments.
    
    Args:
        raw: Raw email text
        
    Returns:
        Dictionary containing parsed email data
    """
    # Extract headers
    headers = extract_headers(raw)
    
    # Extract body text
    body_text = extract_body_text(raw)
    
    # Extract URLs with metadata
    urls = extract_urls(body_text)
    
    # Extract attachments
    attachments = extract_attachments(raw)
    
    # Extract named entities
    entities = extract_entities(body_text)
    
    # Get FAISS similarity if available
    faiss_context = get_faiss_similarity(body_text)
    
    parsed = {
        "headers": headers,
        "body_text": body_text,
        "urls": urls,
        "attachments": attachments,
        "entities": entities,
        "context": faiss_context,
        "metadata": {
            "has_html": "text/html" in raw.lower(),
            "is_multipart": "multipart" in raw.lower(),
            "url_count": len(urls),
            "attachment_count": len(attachments),
            "entity_count": len(entities)
        }
    }
    
    return parsed
