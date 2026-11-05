from datetime import date, datetime, timezone

from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def utcnow() -> datetime:
    """Naive UTC (SQLite timezone saqlamaydi)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)  # +998901234567
    telegram_chat_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class PhoneVerification(Base):
    """Telegram bot orqali raqamni tasdiqlash jarayoni."""

    __tablename__ = "phone_verifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)  # t.me/bot?start=<token>
    purpose: Mapped[str] = mapped_column(String(16), default="register")  # register | reset
    phone: Mapped[str] = mapped_column(String(20), index=True)
    chat_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    code_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    code_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class DailyLog(Base):
    __tablename__ = "daily_logs"
    __table_args__ = (UniqueConstraint("user_id", "date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date)
    gratitudes: Mapped[str] = mapped_column(Text, default="")
    affirmation: Mapped[str] = mapped_column(Text, default="")
    daily_plans: Mapped[str] = mapped_column(Text, default="")


class PrayerTracking(Base):
    __tablename__ = "prayers_tracking"
    __table_args__ = (UniqueConstraint("user_id", "date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date)
    fajr: Mapped[bool] = mapped_column(Boolean, default=False)
    dhuhr: Mapped[bool] = mapped_column(Boolean, default=False)
    asr: Mapped[bool] = mapped_column(Boolean, default=False)
    maghrib: Mapped[bool] = mapped_column(Boolean, default=False)
    isha: Mapped[bool] = mapped_column(Boolean, default=False)


# Zikr maqsadlari (TZ bo'yicha)
ADHKAR_TARGETS: dict[str, int] = {
    "salavat_count": 100,
    "zikr_count": 1000,
    "astagfirulloh_count": 1000,
    "la_ilaha_count": 100,
    "inshiroh_count": 100,
    "waqiah_count": 10,
}


class AdhkarTracking(Base):
    __tablename__ = "adhkar_tracking"
    __table_args__ = (UniqueConstraint("user_id", "date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date)
    salavat_count: Mapped[int] = mapped_column(Integer, default=0)
    zikr_count: Mapped[int] = mapped_column(Integer, default=0)
    astagfirulloh_count: Mapped[int] = mapped_column(Integer, default=0)
    la_ilaha_count: Mapped[int] = mapped_column(Integer, default=0)
    inshiroh_count: Mapped[int] = mapped_column(Integer, default=0)
    waqiah_count: Mapped[int] = mapped_column(Integer, default=0)
    duo_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    # TZ'dagi "istaklarni yozish maydoni" uchun qo'shimcha ustun
    duo_text: Mapped[str] = mapped_column(Text, default="")


class EveningReflection(Base):
    __tablename__ = "evening_reflections"
    __table_args__ = (UniqueConstraint("user_id", "date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date)
    feel_today: Mapped[str] = mapped_column(Text, default="")
    good_deeds: Mapped[str] = mapped_column(Text, default="")
    mistakes_to_fix: Mapped[str] = mapped_column(Text, default="")
    overall_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
