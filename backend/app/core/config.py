import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "").strip(' "\'')
    SUPABASE_KEY: str = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY", "")).strip(' "\'')
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "").strip(' "\'')

    # AI Keys
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY")

    # External APIs
    GOOGLE_BOOKS_API_KEY: str = os.getenv("GOOGLE_BOOKS_API_KEY")

    # Email
    SMTP_HOST: str = os.getenv("SMTP_HOST")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", 587))
    SMTP_USER: str = os.getenv("SMTP_USER")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM")


settings = Settings()
