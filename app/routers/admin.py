"""Admin panel API: default zikrlarni boshqarish va foydalanuvchilarni kuzatish.

Kirish: ``ADMIN_PASSWORD`` (.env / Render env). Parol bo'sh bo'lsa admin panel o'chiq.
"""

import hmac
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import zikrs as zk
from ..config import settings
from ..database import get_db
from ..models import DailyLog, EveningReflection, PrayerTracking, User, Zikr, ZikrCount, utcnow
from ..schemas import AdminLoginIn, AdminZikrIn, AdminZikrPatch
from ..zikr_defaults import ZIKR_ICONS

router = APIRouter(prefix="/admin", tags=["admin"])
bearer = HTTPBearer(auto_error=False)

ADMIN_HTML = Path(__file__).resolve().parent.parent / "static" / "admin.html"
PRAYER_FIELDS = ("fajr", "dhuhr", "asr", "maghrib", "isha")
ACTIVITY_MODELS = (PrayerTracking, ZikrCount, DailyLog, EveningReflection)


def _today() -> date:
    return (datetime.now(timezone.utc) + timedelta(hours=settings.tz_offset_hours)).date()


def _local(dt: datetime | None) -> str | None:
    return (dt + timedelta(hours=settings.tz_offset_hours)).isoformat(timespec="minutes") if dt else None


def require_admin(cred: HTTPAuthorizationCredentials | None = Depends(bearer)) -> None:
    if not settings.admin_password:
        raise HTTPException(status_code=403, detail="Admin panel o'chiq: ADMIN_PASSWORD sozlanmagan")
    if cred is None:
        raise HTTPException(status_code=401, detail="Admin sifatida kiring")
    try:
        payload = jwt.decode(cred.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Sessiya tugadi, qayta kiring")
    if not payload.get("adm"):
        raise HTTPException(status_code=401, detail="Admin huquqi yo'q")


# ---------- Sahifa va kirish ----------
@router.get("", response_class=HTMLResponse, include_in_schema=False)
def admin_page():
    return HTMLResponse(ADMIN_HTML.read_text(encoding="utf-8"))


@router.post("/api/login")
def admin_login(data: AdminLoginIn):
    if not settings.admin_password:
        raise HTTPException(status_code=403, detail="Admin panel o'chiq: ADMIN_PASSWORD sozlanmagan")
    if not hmac.compare_digest(data.password.encode(), settings.admin_password.encode()):
        raise HTTPException(status_code=401, detail="Parol noto'g'ri")
    exp = datetime.now(timezone.utc) + timedelta(hours=12)
    token = jwt.encode({"sub": "admin", "adm": True, "exp": exp}, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return {"token": token}


# ---------- Default zikrlar ----------
def _zikr_dict(z: Zikr, users_count: int = 0) -> dict:
    return {
        "id": z.id,
        "title": z.title,
        "arabic": z.arabic,
        "text": z.text,
        "icon": z.icon,
        "target": z.target,
        "sort_order": z.sort_order,
        "active": z.active,
        "legacy_key": z.legacy_key,
        "users_today": users_count,
    }


@router.get("/api/zikrs", dependencies=[Depends(require_admin)])
def admin_zikrs(db: Session = Depends(get_db)):
    today = _today()
    used = dict(
        db.execute(
            select(ZikrCount.zikr_id, func.count(func.distinct(ZikrCount.user_id)))
            .where(ZikrCount.date == today, ZikrCount.count > 0)
            .group_by(ZikrCount.zikr_id)
        ).all()
    )
    rows = db.scalars(select(Zikr).where(Zikr.user_id.is_(None)).order_by(Zikr.sort_order, Zikr.id)).all()
    return {"zikrs": [_zikr_dict(z, used.get(z.id, 0)) for z in rows], "icons": ZIKR_ICONS}


@router.post("/api/zikrs", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def admin_create_zikr(data: AdminZikrIn, db: Session = Depends(get_db)):
    z = Zikr(user_id=None, **data.model_dump())
    z.title = z.title.strip()
    if not data.sort_order:
        z.sort_order = (db.scalar(select(func.max(Zikr.sort_order)).where(Zikr.user_id.is_(None))) or 0) + 10
    db.add(z)
    db.commit()
    return _zikr_dict(z)


def _global(db: Session, zikr_id: int) -> Zikr:
    z = db.get(Zikr, zikr_id)
    if z is None or z.user_id is not None:
        raise HTTPException(status_code=404, detail="Zikr topilmadi")
    return z


@router.patch("/api/zikrs/{zikr_id}", dependencies=[Depends(require_admin)])
def admin_update_zikr(zikr_id: int, data: AdminZikrPatch, db: Session = Depends(get_db)):
    z = _global(db, zikr_id)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(z, k, v.strip() if k == "title" else v)
    db.commit()
    return _zikr_dict(z)


@router.delete("/api/zikrs/{zikr_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def admin_delete_zikr(zikr_id: int, db: Session = Depends(get_db)):
    """Butunlay o'chiradi (barcha foydalanuvchilarning shu zikr bo'yicha sanoqlari bilan)."""
    db.delete(_global(db, zikr_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- Statistika ----------
def _active_users_on(db: Session, start: date, end: date) -> dict[date, set[int]]:
    out: dict[date, set[int]] = {}
    for model in ACTIVITY_MODELS:
        for d, uid in db.execute(select(model.date, model.user_id).where(model.date >= start, model.date <= end)).all():
            out.setdefault(d, set()).add(uid)
    return out


@router.get("/api/stats", dependencies=[Depends(require_admin)])
def admin_stats(db: Session = Depends(get_db)):
    today = _today()
    start = today - timedelta(days=13)
    now = utcnow()
    day_start_utc = datetime.combine(today, datetime.min.time()) - timedelta(hours=settings.tz_offset_hours)

    total = db.scalar(select(func.count()).select_from(User)) or 0
    new_today = db.scalar(select(func.count()).select_from(User).where(User.created_at >= day_start_utc)) or 0
    new_7d = (
        db.scalar(select(func.count()).select_from(User).where(User.created_at >= day_start_utc - timedelta(days=6)))
        or 0
    )
    online_15m = (
        db.scalar(select(func.count()).select_from(User).where(User.last_seen_at >= now - timedelta(minutes=15))) or 0
    )
    seen_today = db.scalar(select(func.count()).select_from(User).where(User.last_seen_at >= day_start_utc)) or 0

    active = _active_users_on(db, start, today)
    prayers_today = db.scalars(select(PrayerTracking).where(PrayerTracking.date == today)).all()
    prayers_done = sum(sum(bool(getattr(p, f)) for f in PRAYER_FIELDS) for p in prayers_today)
    zikr_total_today = db.scalar(select(func.coalesce(func.sum(ZikrCount.count), 0)).where(ZikrCount.date == today))
    reflections_today = (
        db.scalar(
            select(func.count()).select_from(EveningReflection).where(
                EveningReflection.date == today, EveningReflection.overall_score.is_not(None)
            )
        )
        or 0
    )

    signups = {}
    for (created,) in db.execute(select(User.created_at).where(User.created_at >= day_start_utc - timedelta(days=13))):
        d = (created + timedelta(hours=settings.tz_offset_hours)).date()
        signups[d] = signups.get(d, 0) + 1

    series = []
    for i in range(14):
        d = start + timedelta(days=i)
        series.append({"date": d.isoformat(), "active": len(active.get(d, set())), "signups": signups.get(d, 0)})

    return {
        "today": today.isoformat(),
        "users_total": total,
        "users_new_today": new_today,
        "users_new_7d": new_7d,
        "online_15m": online_15m,
        "seen_today": seen_today,
        "active_today": len(active.get(today, set())),
        "prayers_marked_today": prayers_done,
        "zikr_total_today": int(zikr_total_today or 0),
        "reflections_today": reflections_today,
        "custom_zikrs": db.scalar(select(func.count()).select_from(Zikr).where(Zikr.user_id.is_not(None))) or 0,
        "series": series,
    }


# ---------- Foydalanuvchilar ----------
def _user_today(db: Session, u: User, today: date) -> dict:
    p = db.scalar(select(PrayerTracking).where(PrayerTracking.user_id == u.id, PrayerTracking.date == today))
    zikrs = zk.effective_zikrs(db, u.id)
    return {
        "prayers_today": sum(bool(getattr(p, f)) for f in PRAYER_FIELDS) if p else 0,
        "zikr_progress_today": zk.progress(zikrs, zk.counts_for(db, u.id, today)),
    }


@router.get("/api/users", dependencies=[Depends(require_admin)])
def admin_users(
    q: str = "",
    sort: str = Query(default="last_seen", pattern="^(last_seen|created)$"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=30, ge=1, le=200),
    db: Session = Depends(get_db),
):
    today = _today()
    stmt = select(User)
    count_stmt = select(func.count()).select_from(User)
    digits = "".join(ch for ch in q if ch.isdigit())
    if digits:
        stmt = stmt.where(User.phone.contains(digits))
        count_stmt = count_stmt.where(User.phone.contains(digits))
    order = (
        [User.last_seen_at.is_(None), User.last_seen_at.desc(), User.id.desc()]
        if sort == "last_seen"
        else [User.created_at.desc(), User.id.desc()]
    )
    users = db.scalars(stmt.order_by(*order).offset(offset).limit(limit)).all()

    since = today - timedelta(days=29)
    active30: dict[int, set[date]] = {}
    ids = [u.id for u in users]
    if ids:
        for model in ACTIVITY_MODELS:
            for d, uid in db.execute(
                select(model.date, model.user_id).where(model.user_id.in_(ids), model.date >= since)
            ).all():
                active30.setdefault(uid, set()).add(d)
    custom = (
        dict(db.execute(select(Zikr.user_id, func.count()).where(Zikr.user_id.in_(ids)).group_by(Zikr.user_id)).all())
        if ids
        else {}
    )

    items = []
    for u in users:
        days = active30.get(u.id, set())
        items.append(
            {
                "id": u.id,
                "phone": u.phone,
                "created_at": _local(u.created_at),
                "last_seen_at": _local(u.last_seen_at),
                "telegram": u.telegram_chat_id is not None,
                "active_days_30": len(days),
                "last_active_day": max(days).isoformat() if days else None,
                "custom_zikrs": custom.get(u.id, 0),
                **_user_today(db, u, today),
            }
        )
    return {"total": db.scalar(count_stmt) or 0, "items": items}


@router.get("/api/users/{user_id}", dependencies=[Depends(require_admin)])
def admin_user_detail(user_id: int, db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if u is None:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")
    today = _today()
    start = today - timedelta(days=13)

    def by_date(model):
        return {
            r.date: r
            for r in db.scalars(select(model).where(model.user_id == u.id, model.date >= start, model.date <= today))
        }

    prayers, refl = by_date(PrayerTracking), by_date(EveningReflection)
    zikrs = zk.effective_zikrs(db, u.id)
    counts = zk.counts_between(db, u.id, start, today)
    history = []
    for i in range(14):
        d = start + timedelta(days=i)
        p, r = prayers.get(d), refl.get(d)
        history.append(
            {
                "date": d.isoformat(),
                "prayers_done": sum(bool(getattr(p, f)) for f in PRAYER_FIELDS) if p else 0,
                "zikr_progress": zk.progress(zikrs, counts.get(d, {})),
                "score": r.overall_score if r else None,
            }
        )
    today_counts = counts.get(today, {})
    return {
        "id": u.id,
        "phone": u.phone,
        "created_at": _local(u.created_at),
        "last_seen_at": _local(u.last_seen_at),
        "telegram": u.telegram_chat_id is not None,
        "history": history,
        "zikrs": [
            {
                "title": z["title"],
                "target": z["target"],
                "today": today_counts.get(z["id"], 0),
                "is_custom": z["is_custom"],
                "edited": z["edited"],
            }
            for z in zikrs
        ],
    }
