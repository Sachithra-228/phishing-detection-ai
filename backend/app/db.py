
from motor.motor_asyncio import AsyncIOMotorClient
from os import getenv
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# MongoDB Atlas configuration
MONGO_URI = getenv("MONGODB_URL", "mongodb+srv://wijesinghesachithra_db_user:m1voiRa2Fokbg9yd@phishing-detection01.io6hcx8.mongodb.net/?retryWrites=true&w=majority&appName=phishing-detection01")
DB_NAME = getenv("DATABASE_NAME", "phishing_ai")

# Initialize MongoDB client
client = AsyncIOMotorClient(MONGO_URI)
db = client[DB_NAME]

async def get_db():
    """Get database instance"""
    return db

async def test_connection():
    """Test MongoDB connection"""
    try:
        await client.admin.command('ping')
        print("✅ MongoDB Atlas connection successful!")
        return True
    except Exception as e:
        print(f"❌ MongoDB Atlas connection failed: {e}")
        return False
