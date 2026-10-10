import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "Text-to-SQL with Clarification Engine"
    API_V1_STR: str = "/api/v1"
    
    # LLM Settings
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY", "")
    DEFAULT_LLM_MODEL: str = "gemini-1.5-flash"
    
    # Security & Encryption
    # In production, pass ENCRYPTION_KEY as an env variable
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-default-key-for-dev-change-in-prod-32bytes!")
    ENCRYPTION_KEY: Optional[str] = os.getenv("ENCRYPTION_KEY", None)
    
    # SQL Execution Guardrails
    DEFAULT_QUERY_LIMIT: int = 100
    MAX_QUERY_LIMIT: int = 1000
    DEFAULT_QUERY_TIMEOUT_SECONDS: int = 15
    MAX_REPAIR_ATTEMPTS: int = 2

    # Demo Database
    DEMO_DB_PATH: str = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "demo_data", "ecommerce.db")
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
