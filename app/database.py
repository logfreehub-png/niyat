import logging

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

db_url = settings.database_url
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

is_sqlite = db_url.startswith("sqlite")

if is_sqlite and settings.render_external_url:
    # Render'da disk vaqtinchalik: server uxlab-uyg'onganda yoki deploy'da SQLite fayli o'chadi,
    # foydalanuvchilar yo'qoladi va ilova hammani hisobdan chiqarib yuboradi.
    logging.getLogger("niyat.db").error(
        "DIQQAT: Render'da SQLite ishlatilmoqda — ma'lumotlar saqlanmaydi! DATABASE_URL (Postgres) ni sozlang."
    )

engine = create_engine(
    db_url,
    connect_args={"check_same_thread": False} if is_sqlite else {},
    # Bulutli Postgres (Neon va h.k.) bo'sh ulanishlarni uzadi — ishlatishdan oldin tekshiramiz
    pool_pre_ping=not is_sqlite,
    pool_recycle=300 if not is_sqlite else -1,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
