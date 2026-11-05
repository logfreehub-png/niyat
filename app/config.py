from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./niyat.db"
    # Production'da .env orqali albatta almashtiring!
    jwt_secret: str = "change-me-in-production-please-use-32+chars"
    jwt_algorithm: str = "HS256"
    access_token_expire_days: int = 30

    # Telefon raqamni tasdiqlash uchun Telegram bot tokeni (bo'sh bo'lsa bot ishga tushmaydi)
    telegram_bot_token: str = ""
    verification_ttl_minutes: int = 15  # botga o'tish havolasining amal qilish muddati
    code_ttl_minutes: int = 5  # tasdiqlash kodining amal qilish muddati
    code_max_attempts: int = 5


settings = Settings()
