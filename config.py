"""
config.py — Application Configuration
"""

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # Flask
    SECRET_KEY = os.getenv(
        "FLASK_SECRET_KEY",
        "dev-secret-key-change-in-production"
    )
    DEBUG = os.getenv("FLASK_DEBUG", "False").lower() == "true"
    HOST = os.getenv("FLASK_HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", os.getenv("FLASK_PORT", "5000")))

    # IBM watsonx.ai (AI Studio)
    IBM_API_KEY    = os.getenv("IBM_API_KEY", "")
    IBM_PROJECT_ID = os.getenv("IBM_PROJECT_ID", "")
    IBM_MODEL_ID   = os.getenv("IBM_MODEL_ID", "ibm/granite-3-3b-a800m-instruct")
    IBM_URL        = os.getenv("IBM_URL", "https://au-syd.ml.cloud.ibm.com")

    # Uploads
    UPLOAD_FOLDER = os.path.join(
        os.path.dirname(__file__),
        os.getenv("UPLOAD_FOLDER", "uploads")
    )
    MAX_CONTENT_LENGTH = int(
        os.getenv("MAX_CONTENT_LENGTH", "16777216")
    )
    ALLOWED_EXTENSIONS = {"pdf", "docx", "txt"}

    # App
    APP_NAME = os.getenv("APP_NAME", "DoctorTalk")
    APP_VERSION = os.getenv("APP_VERSION", "1.0.0")


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


config = ProductionConfig() if os.getenv("RENDER") else DevelopmentConfig()
