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
    # Admin panelda kuzatish uchun: oxirgi marta ilovadan foydalangan vaqti
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Profil: foydalanuvchi o'zi to'ldiradi
    name: Mapped[str] = mapped_column(String(100), default="")
    avatar: Mapped[str] = mapped_column(Text, default="")  # data:image/jpeg;base64,... (kichik, ilovada siqiladi)


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


class TelegramContact(Base):
    """Bot orqali tasdiqlangan "raqam ↔ Telegram chat" bog'lanishi.

    Foydalanuvchi bir marta "Raqamni yuborish" tugmasi orqali o'z kontaktini yuborgach,
    keyingi safar kod so'ralganda bot uni qayta so'ramaydi — kodni to'g'ridan-to'g'ri yuboradi.
    """

    __tablename__ = "telegram_contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    chat_id: Mapped[int] = mapped_column(BigInteger, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


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


class Zikr(Base):
    """Zikr/salovat ta'rifi.

    user_id = NULL — admin boshqaradigan umumiy (default) zikr, hamma foydalanuvchida ko'rinadi.
    user_id = N    — foydalanuvchining o'zi qo'shgan zikri.
    legacy_key     — eski ``adhkar_tracking`` ustuni (masalan ``salavat_count``) bilan bog'lanish.
    """

    __tablename__ = "zikrs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    arabic: Mapped[str] = mapped_column(Text, default="")
    text: Mapped[str] = mapped_column(Text, default="")  # o'zbekcha o'qilishi / ma'nosi
    icon: Mapped[str] = mapped_column(String(64), default="star-four-points-outline")
    target: Mapped[int] = mapped_column(Integer, default=100)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    legacy_key: Mapped[str | None] = mapped_column(String(32), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ZikrOverride(Base):
    """Foydalanuvchi default zikrni o'zi uchun o'zgartirsa (matn, nom, maqsad) yoki yashirsa."""

    __tablename__ = "zikr_overrides"
    __table_args__ = (UniqueConstraint("user_id", "zikr_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    zikr_id: Mapped[int] = mapped_column(ForeignKey("zikrs.id", ondelete="CASCADE"), index=True)
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    target: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)


class ZikrCount(Base):
    """Kunlik sanoq: (foydalanuvchi, sana, zikr) → son."""

    __tablename__ = "zikr_counts"
    __table_args__ = (UniqueConstraint("user_id", "date", "zikr_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    zikr_id: Mapped[int] = mapped_column(ForeignKey("zikrs.id", ondelete="CASCADE"), index=True)
    count: Mapped[int] = mapped_column(Integer, default=0)
