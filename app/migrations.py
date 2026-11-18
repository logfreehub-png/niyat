"""Juda oddiy migratsiya: modelda bor, lekin bazada yo'q ustunlarni qo'shadi (SQLite).

Ma'lumotlar o'chmaydi. Murakkab o'zgarishlar (ustun o'chirish/turini o'zgartirish) uchun
keyinchalik Alembic'ga o'tish kerak.
"""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from .database import Base

ADDED_COLUMNS = {
    # jadval: {ustun: SQL ta'rifi}
    "phone_verifications": {"purpose": "VARCHAR(16) NOT NULL DEFAULT 'register'"},
    "users": {"last_seen_at": "TIMESTAMP"},
}


def run_migrations(engine: Engine) -> None:
    Base.metadata.create_all(bind=engine)
    insp = inspect(engine)
    with engine.begin() as conn:
        for table, columns in ADDED_COLUMNS.items():
            existing = {c["name"] for c in insp.get_columns(table)}
            for name, ddl in columns.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))

    # Default zikrlarni qo'shish va eski sanoqlarni yangi jadvalga ko'chirish
    from sqlalchemy.orm import Session

    from .zikrs import seed_and_migrate

    with Session(engine) as db:
        seed_and_migrate(db)
