
from typing import Dict, Any, Tuple, List
import re
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
import joblib
import os
from urllib.parse import urlparse
import tldextract

# Rule-based features
SUSPICIOUS_KEYWORDS = [
    "urgent", "verify", "password", "suspended", "invoice", "payment", 
    "account", "security", "update", "confirm", "immediately", "expired",
    "click here", "verify now", "unusual activity", "suspicious login",
    "reset password", "account locked", "verify identity", "tax refund",
    "lottery winner", "congratulations", "free money", "act now"
]

SUSPICIOUS_DOMAINS = [
    "paypa1.com", "apple-id.support", "microsofft.com", "amazom.com",
    "goog1e.com", "faceb00k.com", "twitt3r.com", "instagr4m.com"
]

SUSPICIOUS_TLDS = [".tk", ".ml", ".ga", ".cf", ".bit", ".onion"]

LOOKALIKE_PATTERNS = [
    r'[0-9]+[a-z]+[0-9]+',  # Numbers mixed with letters
    r'[a-z]+[0-9]+[a-z]+',  # Letters mixed with numbers
    r'(.)\1{2,}',  # Repeated characters
]

class RiskScorer:
    def __init__(self):
        self.vectorizer = None
        self.model = None
        self.scaler = None
        self.load_model()
    
    def load_model(self):
        """Load pre-trained model or create a baseline."""
        model_path = "./models/risk_scorer_model.pkl"
        
        if os.path.exists(model_path):
            try:
                model_data = joblib.load(model_path)
                self.model = model_data['model']
                self.vectorizer = model_data['vectorizer']
                self.scaler = model_data['scaler']
            except Exception:
                self._create_baseline_model()
        else:
            self._create_baseline_model()
    
    def _create_baseline_model(self):
        """Create a baseline logistic regression model."""
        self.vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            ngram_range=(1, 2)
        )
        self.scaler = StandardScaler()
        
        # Create a simple baseline model
        self.model = LogisticRegression(random_state=42)
        
        # Train on synthetic data for baseline
        synthetic_texts = [
            "Your account has been suspended. Click here to verify.",
            "Congratulations! You won $1000. Claim now!",
            "Urgent: Verify your password immediately.",
            "Hello, how are you doing today?",
            "Meeting scheduled for tomorrow at 2 PM.",
            "Please find attached the report you requested."
        ]
        synthetic_labels = [1, 1, 1, 0, 0, 0]  # 1 = phishing, 0 = legitimate
        
        X = self.vectorizer.fit_transform(synthetic_texts)
        X_scaled = self.scaler.fit_transform(X.toarray())
        self.model.fit(X_scaled, synthetic_labels)
    
    def extract_rule_features(self, parsed: Dict[str, Any]) -> Dict[str, float]:
        """Extract rule-based features."""
        features = {}
        
        # Get text content
        subject = parsed.get("headers", {}).get("subject", "").lower()
        body_text = parsed.get("body_text", "").lower()
        full_text = f"{subject} {body_text}"
        
    urls = parsed.get("urls", [])
    entities = parsed.get("entities", [])
        
        # Keyword-based features
        features['suspicious_keyword_count'] = sum(1 for kw in SUSPICIOUS_KEYWORDS if kw in full_text)
        features['suspicious_keyword_ratio'] = features['suspicious_keyword_count'] / max(len(full_text.split()), 1)
        
        # URL-based features
        features['url_count'] = len(urls)
        features['suspicious_domain_count'] = 0
        features['suspicious_tld_count'] = 0
        features['shortened_url_count'] = 0
        features['lookalike_domain_count'] = 0
        
        for url_data in urls:
            domain = url_data.get('domain', '').lower()
            
            # Check for suspicious domains
            if any(sd in domain for sd in SUSPICIOUS_DOMAINS):
                features['suspicious_domain_count'] += 1
            
            # Check for suspicious TLDs
            if any(tld in domain for tld in SUSPICIOUS_TLDS):
                features['suspicious_tld_count'] += 1
            
            # Check for shortened URLs
            if url_data.get('is_shortened', False):
                features['shortened_url_count'] += 1
            
            # Check for lookalike patterns
            if any(re.search(pattern, domain) for pattern in LOOKALIKE_PATTERNS):
                features['lookalike_domain_count'] += 1
        
        # Entity-based features
        features['entity_count'] = len(entities)
        features['person_entity_count'] = sum(1 for e in entities if e.get('type') == 'PERSON')
        features['org_entity_count'] = sum(1 for e in entities if e.get('type') == 'ORG')
        
        # Email structure features
        features['has_html'] = parsed.get("metadata", {}).get("has_html", False)
        features['is_multipart'] = parsed.get("metadata", {}).get("is_multipart", False)
        features['attachment_count'] = parsed.get("metadata", {}).get("attachment_count", 0)
        
        # Text-based features
        features['text_length'] = len(full_text)
        features['exclamation_count'] = full_text.count('!')
        features['question_count'] = full_text.count('?')
        features['caps_ratio'] = sum(1 for c in full_text if c.isupper()) / max(len(full_text), 1)
        
        # Urgency indicators
        urgency_words = ['urgent', 'immediately', 'asap', 'now', 'today', 'expires']
        features['urgency_score'] = sum(1 for word in urgency_words if word in full_text)
        
        return features
    
    def extract_ml_features(self, parsed: Dict[str, Any]) -> np.ndarray:
        """Extract ML features using TF-IDF."""
        text = f"{parsed.get('headers', {}).get('subject', '')} {parsed.get('body_text', '')}"
        
        if self.vectorizer is None:
            return np.zeros(1000)  # Fallback
        
        try:
            X = self.vectorizer.transform([text])
            return X.toarray()[0]
        except Exception:
            return np.zeros(1000)
    
    def combine_features(self, rule_features: Dict[str, float], ml_features: np.ndarray) -> np.ndarray:
        """Combine rule-based and ML features."""
        # Convert rule features to array
        rule_array = np.array(list(rule_features.values()))
        
        # Combine features
        combined = np.concatenate([rule_array, ml_features])
        
        # Pad or truncate to fixed size
        target_size = 1100  # Adjust based on your feature count
        if len(combined) < target_size:
            combined = np.pad(combined, (0, target_size - len(combined)))
        elif len(combined) > target_size:
            combined = combined[:target_size]
        
        return combined
    
    def predict_risk(self, parsed: Dict[str, Any]) -> Tuple[float, str, str]:
        """Predict phishing risk using hybrid approach."""
        # Extract features
        rule_features = self.extract_rule_features(parsed)
        ml_features = self.extract_ml_features(parsed)
        combined_features = self.combine_features(rule_features, ml_features)
        
        # Get ML prediction
        if self.model is not None and self.scaler is not None:
            try:
                X_scaled = self.scaler.transform(combined_features.reshape(1, -1))
                ml_score = self.model.predict_proba(X_scaled)[0][1]  # Probability of phishing
            except Exception:
                ml_score = 0.5  # Fallback
        else:
            ml_score = 0.5
        
        # Calculate rule-based score
        rule_score = 0.0
        
        # Keyword penalty
        rule_score += min(rule_features['suspicious_keyword_count'] * 0.1, 0.4)
        
        # URL penalties
        rule_score += min(rule_features['suspicious_domain_count'] * 0.3, 0.3)
        rule_score += min(rule_features['suspicious_tld_count'] * 0.2, 0.2)
        rule_score += min(rule_features['lookalike_domain_count'] * 0.15, 0.15)
        
        # Structure penalties
        if rule_features['has_html'] and rule_features['url_count'] > 0:
            rule_score += 0.1
        
        if rule_features['urgency_score'] > 2:
            rule_score += 0.1
        
        # Caps ratio penalty
        if rule_features['caps_ratio'] > 0.3:
            rule_score += 0.1
        
        rule_score = min(rule_score, 1.0)
        
        # Combine ML and rule-based scores (weighted average)
        final_score = 0.6 * ml_score + 0.4 * rule_score
        
        # Determine risk level and reason
        if final_score >= 0.8:
        level = "High"
            reason = "Multiple indicators suggest this is likely phishing"
        elif final_score >= 0.4:
        level = "Medium"
            reason = "Some indicators suggest potential phishing risk"
    else:
        level = "Low"
            reason = "Few or no indicators of phishing detected"
        
        # Add specific reasons
        reasons = []
        if rule_features['suspicious_keyword_count'] > 0:
            reasons.append(f"{rule_features['suspicious_keyword_count']} suspicious keywords")
        if rule_features['suspicious_domain_count'] > 0:
            reasons.append(f"{rule_features['suspicious_domain_count']} suspicious domains")
        if rule_features['lookalike_domain_count'] > 0:
            reasons.append(f"{rule_features['lookalike_domain_count']} lookalike domains")
        if rule_features['urgency_score'] > 2:
            reasons.append("high urgency language")
        
        if reasons:
            reason += f" ({', '.join(reasons)})"
        
        return final_score, level, reason

# Global instance
risk_scorer = RiskScorer()

def score(parsed: Dict[str, Any]) -> Tuple[float, str, str]:
    """
    Score email for phishing risk using hybrid ML + rules approach.
    
    Args:
        parsed: Parsed email data from email_parser
        
    Returns:
        Tuple of (score, level, reason)
    """
    return risk_scorer.predict_risk(parsed)
