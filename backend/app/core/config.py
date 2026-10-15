import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List

# Locate and load .env from workspace or backend directory
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
for env_path in [
    os.path.join(BASE_DIR, ".env"),
    os.path.join(BASE_DIR, "backend", ".env"),
    os.path.join(os.path.dirname(__file__), ".env"),
    ".env",
]:
    if os.path.exists(env_path):
        load_dotenv(env_path, override=True)

# Support both GOOGLE_API_KEY and GEMINI_API_KEY, strip any accidental trailing spaces
def get_gemini_api_key() -> str:
    key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY") or ""
    # In case the key in os.environ has trailing whitespace in the key name
    if not key:
        for k, v in os.environ.items():
            if k.strip() in ("GOOGLE_API_KEY", "GEMINI_API_KEY") and v:
                key = v
                break
    return key.strip()


class Settings(BaseSettings):
    PROJECT_NAME: str = "Text-to-SQL with Clarification Engine"
    API_V1_STR: str = "/api/v1"
    
    # LLM Settings
    GEMINI_API_KEY: str = get_gemini_api_key()
    DEFAULT_LLM_MODEL: str = "gemini-3.5-flash"
    LLM_FALLBACK_MODELS: List[str] = [
        "gemini-3.5-flash",
        "gemini-3.7-flash",
        "gemini-3-flash-preview",
        "gemini-3.5-flash-lite",
        "gemini-3.8-flash"
    ]
    
    # Security & Encryption
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-default-key-for-dev-change-in-prod-32bytes!")
    ENCRYPTION_KEY: Optional[str] = os.getenv("ENCRYPTION_KEY", None)
    
    # Execution Limits
    DEFAULT_QUERY_LIMIT: int = 100
    MAX_QUERY_LIMIT: int = 1000
    DEFAULT_QUERY_TIMEOUT_SECONDS: int = 20
    MAX_REPAIR_ATTEMPTS: int = 2

    # Demo Database
    DEMO_DB_PATH: str = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "demo_data", "ecommerce.db")
    )

    model_config = SettingsConfigDict(extra="ignore")


settings = Settings()
