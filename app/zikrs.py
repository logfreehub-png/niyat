"""Zikrlar bilan ishlash: foydalanuvchi ko'radigan ro'yxat, kunlik sanoqlar va foiz."""

from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .models import ADHKAR_TARGETS, AdhkarTracking, Zikr, ZikrCount, ZikrOverride
from .zikr_defaults import DEFAULT_ZIKRS

CUSTOM_SORT_BASE = 10_000  # foydalanuvchi zikrlari defaultlardan keyin turadi


def effective_zikrs(db: Session, user_id: int) -> list[dict]:
    """Foydalanuvchi ko'radigan zikrlar: faol defaultlar (shaxsiy o'zgartirishlar bilan) + o'zi qo'shganlari."""
    rows = db.scalars(
        select(Zikr).where(Zikr.active.is_(True), or_(Zikr.user_id.is_(None), Zikr.user_id == user_id))
    ).all()
    overrides = {
        o.zikr_id: o for o in db.scalars(select(ZikrOverride).where(ZikrOverride.user_id == user_id)).all()
    }
    out = []
    for z in rows:
        o = overrides.get(z.id)
        if o is not None and o.hidden:
            continue
        is_custom = z.user_id is not None
        out.append(
            {
                "id": z.id,
                "title": (o.title if o and o.title else z.title),
                "arabic": z.arabic,
                "text": (o.text if o and o.text is not None else z.text),
                "icon": z.icon,
                "target": (o.target if o and o.target else z.target),
                "is_custom": is_custom,
                "edited": o is not None and not is_custom,
                "legacy_key": z.legacy_key,
                "sort": (CUSTOM_SORT_BASE + z.sort_order) if is_custom else z.sort_order,
            }
        )
    out.sort(key=lambda x: (x["sort"], x["id"]))
    return out


def counts_for(db: Session, user_id: int, d: date) -> dict[int, int]:
    rows = db.execute(
        select(ZikrCount.zikr_id, ZikrCount.count).where(ZikrCount.user_id == user_id, ZikrCount.date == d)
    ).all()
    return {zid: n for zid, n in rows}


def counts_between(db: Session, user_id: int, start: date, end: date) -> dict[date, dict[int, int]]:
    rows = db.execute(
        select(ZikrCount.date, ZikrCount.zikr_id, ZikrCount.count).where(
            ZikrCount.user_id == user_id, ZikrCount.date >= start, ZikrCount.date <= end
        )
    ).all()
    out: dict[date, dict[int, int]] = {}
    for d, zid, n in rows:
        out.setdefault(d, {})[zid] = n
    return out


def progress(zikrs: list[dict], counts: dict[int, int]) -> int:
    """Har bir zikrning bajarilish ulushi o'rtachasi (0..100)."""
    if not zikrs:
        return 0
    ratios = [min(counts.get(z["id"], 0), z["target"]) / z["target"] for z in zikrs if z["target"] > 0]
    return round(100 * sum(ratios) / len(ratios)) if ratios else 0


def set_count(db: Session, user_id: int, d: date, zikr: dict, value: int) -> None:
    """Sanoqni yozadi (maqsaddan oshmaydi). Default zikr eski ustunga ham ko'chiriladi — eski ilova versiyalari uchun."""
    value = max(0, min(int(value), zikr["target"]))
    row = db.scalar(
        select(ZikrCount).where(ZikrCount.user_id == user_id, ZikrCount.date == d, ZikrCount.zikr_id == zikr["id"])
    )
    if row is None:
        db.add(ZikrCount(user_id=user_id, date=d, zikr_id=zikr["id"], count=value))
        db.flush()
    else:
        row.count = value
    key = zikr.get("legacy_key")
    if key in ADHKAR_TARGETS:
        a = db.scalar(select(AdhkarTracking).where(AdhkarTracking.user_id == user_id, AdhkarTracking.date == d))
        if a is None:
            a = AdhkarTracking(user_id=user_id, date=d)
            db.add(a)
            db.flush()  # autoflush o'chiq — keyingi zikr shu qatorni topishi uchun
        setattr(a, key, min(value, ADHKAR_TARGETS[key]))


def mirror_legacy(db: Session, user_id: int, d: date, values: dict[str, int]) -> None:
    """Eski ilova ``/days/{d}/adhkar`` ga yozsa — yangi sanoq jadvalini ham yangilaymiz."""
    legacy = {k: v for k, v in values.items() if k in ADHKAR_TARGETS}
    if not legacy:
        return
    by_key = {z["legacy_key"]: z for z in effective_zikrs(db, user_id) if z["legacy_key"]}
    for key, value in legacy.items():
        z = by_key.get(key)
        if z is None:
            continue
        row = db.scalar(
            select(ZikrCount).where(ZikrCount.user_id == user_id, ZikrCount.date == d, ZikrCount.zikr_id == z["id"])
        )
        value = max(0, min(int(value), z["target"]))
        if row is None:
            db.add(ZikrCount(user_id=user_id, date=d, zikr_id=z["id"], count=value))
        else:
            row.count = value


def seed_and_migrate(db: Session) -> None:
    """1) Umumiy zikr bo'lmasa — defaultlarni qo'shadi.
    2) Sanoqlar jadvali bo'sh bo'lsa — eski ``adhkar_tracking`` ma'lumotlarini ko'chiradi (bir marta)."""
    has_global = db.scalar(select(func.count()).select_from(Zikr).where(Zikr.user_id.is_(None)))
    if not has_global:
        for i, z in enumerate(DEFAULT_ZIKRS):
            db.add(Zikr(user_id=None, sort_order=(i + 1) * 10, **z))
        db.flush()

    if db.scalar(select(func.count()).select_from(ZikrCount)):
        db.commit()
        return
    by_key = {
        z.legacy_key: z.id
        for z in db.scalars(select(Zikr).where(Zikr.user_id.is_(None), Zikr.legacy_key.is_not(None))).all()
    }
    for a in db.scalars(select(AdhkarTracking)).all():
        for key, zid in by_key.items():
            n = getattr(a, key, 0) or 0
            if n > 0:
                db.add(ZikrCount(user_id=a.user_id, date=a.date, zikr_id=zid, count=n))
    db.commit()
