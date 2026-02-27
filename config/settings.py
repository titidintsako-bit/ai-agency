"""
config/settings.py

Global application settings, loaded from environment variables via pydantic-settings.
Provides type validation, default values, and a single cached Settings instance.

Usage:
    from config.settings import get_settings

    settings = get_settings()
    print(settings.anthropic_api_key)
"""

from functools import lru_cache
from pydantic import ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

# Maps pydantic field name → the env var name Railway/production must have set.
_REQUIRED_ENV_VARS: dict[str, str] = {
    "anthropic_api_key":        "ANTHROPIC_API_KEY",
    "supabase_url":             "SUPABASE_URL",
    "supabase_service_role_key":"SUPABASE_SERVICE_ROLE_KEY",
}


class Settings(BaseSettings):
    """
    All environment variables the platform needs to operate.
    Variables are read from the .env file in the project root,
    then overridden by actual environment variables if both exist.
    """

    # ------------------------------------------------------------------
    # Anthropic
    # ------------------------------------------------------------------
    anthropic_api_key: str

    # ------------------------------------------------------------------
    # Supabase
    # The service_role key bypasses Row Level Security.
    # It must ONLY be used server-side — never in frontend code.
    # ------------------------------------------------------------------
    supabase_url: str
    supabase_service_role_key: str

    # ------------------------------------------------------------------
    # Twilio — WhatsApp integration
    # These default to empty strings so the app starts without Twilio.
    # Twilio features will raise a clear error if keys are missing when used.
    # ------------------------------------------------------------------
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_whatsapp_number: str = ""

    # ------------------------------------------------------------------
    # Currency
    # USD → ZAR conversion rate used when writing cost_zar to token_usage.
    # Stored in env so we can update it without redeploying.
    # ------------------------------------------------------------------
    usd_zar_exchange_rate: float = 18.50

    # ------------------------------------------------------------------
    # Dashboard auth
    # Single-user credentials for the personal admin dashboard.
    # Set these in .env — do NOT commit real values to version control.
    # ------------------------------------------------------------------
    dashboard_email: str    = "admin@youragency.com"
    dashboard_password: str = "changeme"          # Override in .env
    jwt_secret: str         = "CHANGE_ME_generate_64_random_chars_openssl_rand_hex_32"
    jwt_expire_hours: int   = 24

    # ------------------------------------------------------------------
    # Dashboard CORS
    # CORS origin for the Vercel admin dashboard frontend.
    # ------------------------------------------------------------------
    dashboard_origin: str = ""         # e.g. https://ai-agency-dashboard.vercel.app

    # ------------------------------------------------------------------
    # Application
    # ------------------------------------------------------------------
    environment: str = "development"   # development | production
    log_level: str = "INFO"            # DEBUG | INFO | WARNING | ERROR

    model_config = SettingsConfigDict(
        env_file=".env",               # Used locally; silently skipped if file absent (Railway/Vercel)
        env_file_encoding="utf-8",
        case_sensitive=False,           # ANTHROPIC_API_KEY == anthropic_api_key
        env_ignore_empty=True,          # Treat blank env vars as unset (Railway template vars)
        extra="ignore",                 # Silently ignore unknown env vars
    )

    @property
    def is_production(self) -> bool:
        """True when running in the production environment."""
        return self.environment.lower() == "production"

    @property
    def has_twilio(self) -> bool:
        """True when all three Twilio credentials are configured."""
        return bool(
            self.twilio_account_sid
            and self.twilio_auth_token
            and self.twilio_whatsapp_number
        )


@lru_cache()
def get_settings() -> Settings:
    """
    Return the cached Settings singleton.

    Using @lru_cache means the .env file is only read once per process.
    Call get_settings() freely — it is cheap after the first call.

    Raises RuntimeError (not pydantic ValidationError) if required env vars
    are missing, with a clear message naming the exact variable(s) to set.
    """
    try:
        return Settings()
    except ValidationError as exc:
        missing = [
            _REQUIRED_ENV_VARS.get(str(err["loc"][0]), str(err["loc"][0]).upper())
            for err in exc.errors()
            if err["type"] == "missing"
        ]
        if missing:
            raise RuntimeError(
                "Missing required environment variables: "
                + ", ".join(missing)
                + "\n\nSet these in Railway → Variables tab (or your local .env file)."
                "\nSee .env.example for the full list of variables."
            ) from exc
        raise  # re-raise original if it's a different validation problem
