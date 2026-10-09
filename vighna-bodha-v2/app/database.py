import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

# Load .env from the app directory
ENV_FILE = Path(__file__).resolve().parent / ".env"
load_dotenv(ENV_FILE)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError(
        "Missing SUPABASE_URL or SUPABASE_KEY in app/.env"
    )

supabase = create_client(
    SUPABASE_URL,
    SUPABASE_KEY
)

print("Supabase client initialized successfully!")