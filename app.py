"""
app.py — Flask Application Entry Point
========================================
Creates and configures the Flask application instance.
Run this file to start the DoctorTalk web server.
"""

import os
import logging
from flask import Flask
from flask_cors import CORS
from config import config

# ── Logging Configuration ─────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO if not config.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)


def create_app() -> Flask:
    """Application factory — creates and configures the Flask app."""
    app = Flask(__name__, template_folder="templates", static_folder="static")

    # Core configuration
    app.secret_key = config.SECRET_KEY
    app.config["MAX_CONTENT_LENGTH"] = config.MAX_CONTENT_LENGTH
    app.config["UPLOAD_FOLDER"] = config.UPLOAD_FOLDER
    app.config["DEBUG"] = config.DEBUG

    # Enable CORS for API endpoints
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Ensure upload directory exists
    os.makedirs(config.UPLOAD_FOLDER, exist_ok=True)

    # Initialize the private server-side SQLite database
    from database import init_db
    init_db()

    # Register blueprints
    from routes import main_bp, api_bp
    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp)

    # Inject global template variables
    @app.context_processor
    def inject_globals():
        return {
            "app_name": config.APP_NAME,
            "app_version": config.APP_VERSION,
        }

    display_host = "127.0.0.1" if config.HOST == "0.0.0.0" else config.HOST
    logger.info("DoctorTalk started — http://%s:%d", display_host, config.PORT)
    return app


# ── Application Instance ──────────────────────────────────────────────────────
app = create_app()

if __name__ == "__main__":
    app.run(host=config.HOST, port=config.PORT, debug=config.DEBUG)
