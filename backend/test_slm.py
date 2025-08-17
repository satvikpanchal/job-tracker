#!/usr/bin/env python3
"""
Quick test script for SLM classifier
"""

import sys
import os

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from slm_classifier import SLMClassifier

def test_slm():
    print("🧪 Testing SLM Classifier...")
    
    # Create classifier with your available model
    classifier = SLMClassifier(model_name="gemma3:1b")
    
    # Test connection
    print("\n1. Testing Ollama connection...")
    status = classifier.test_connection()
    print(f"Status: {status}")
    
    if not status.get('ollama_running'):
        print("❌ Ollama is not running or accessible")
        return False
    
    # Test with a simple email
    print("\n2. Testing email classification...")
    test_emails = [
        {
            "subject": "Thank you for your application",
            "sender": "hr@company.com",
            "body": "We received your application for Software Engineer position. We will review and get back to you soon."
        }
    ]
    
    try:
        result = classifier.classify_emails(test_emails)
        if result:
            print(f"✅ Classification successful: {result}")
            return True
        else:
            print("❌ Classification failed")
            return False
    except Exception as e:
        print(f"❌ Error during classification: {e}")
        return False

if __name__ == "__main__":
    success = test_slm()
    if success:
        print("\n🎉 SLM classifier is working! You can now run your main app.")
    else:
        print("\n❌ SLM classifier test failed. Check the errors above.")
