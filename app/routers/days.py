from datetime import date, timedelta
from typing import TypeVar

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import Base, get_db
from ..models import ADHKAR_TARGETS, AdhkarTracking, DailyLog, EveningReflection, PrayerTracking, User
from .. import zikrs as zk
from ..schemas import (
    AdhkarIn,
    AdhkarOut,
    DailyLogIn,
    DailyLogOut,
    DayOut,
    HistoryItem,
    PrayersIn,
    PrayersOut,
    ReflectionIn,
    ReflectionOut,
    SummaryOut,
    ZikrCountsIn,
    ZikrDayItem,
)

router = APIRouter(tags=["days"])

M = TypeVar("M", bound=Base)
PRAYER_FIELDS = ("fajr", "dhuhr", "asr", "maghrib", "isha")


def _find(db: Session, model: type[M], user_id: int, d: date) -> M | None:
    return db.scalar(select(model).where(model.user_id == user_id, model.date == d))


def _get_or_create(db: Session, model: type[M], user_id: int, d: date) -> M:
    row = _find(db, model, user_id, d)
    if row is None:
        row = model(user_id=user_id, date=d)
        db.add(row)
        db.flush()
    return row


def _apply(row, data) -> None:
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(row, key, value)


def day_progress(db: Session, user_id: int, d: date, zikrs: list[dict] | None = None) -> int:
    zikrs = zikrs if zikrs is not None else zk.effective_zikrs(db, user_id)
    return zk.progress(zikrs, zk.counts_for(db, user_id, d))


def _prayers_done(p: PrayerTracking | None) -> int:
    return sum(bool(getattr(p, f)) for f in PRAYER_FIELDS) if p else 0


def _day(db: Session, user: User, d: date) -> DayOut:
    log = _find(db, DailyLog, user.id, d)
    prayers = _find(db, PrayerTracking, user.id, d)
    adhkar = _find(db, AdhkarTracking, user.id, d)
    refl = _find(db, EveningReflection, user.id, d)
    zikrs = zk.effective_zikrs(db, user.id)
    counts = zk.counts_for(db, user.id, d)
    progress = zk.progress(zikrs, counts)
    return DayOut(
        date=d,
        log=DailyLogOut.model_validate(log) if log else DailyLogOut(),
        prayers=PrayersOut.model_validate(prayers) if prayers else PrayersOut(),
        adhkar=AdhkarOut.model_validate(adhkar) if adhkar else AdhkarOut(),
        reflection=ReflectionOut.model_validate(refl) if refl else ReflectionOut(),
        adhkar_targets=ADHKAR_TARGETS,
        adhkar_progress=progress,
        adhkar_all_done=progress == 100,
        zikrs=[ZikrDayItem(**z, count=min(counts.get(z["id"], 0), z["target"])) for z in zikrs],
    )


@router.get("/days/{d}", response_model=DayOut)
def get_day(d: date, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _day(db, user, d)


@router.put("/days/{d}/log", response_model=DayOut)
def put_log(d: date, data: DailyLogIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _apply(_get_or_create(db, DailyLog, user.id, d), data)
    db.commit()
    return _day(db, user, d)


@router.put("/days/{d}/prayers", response_model=DayOut)
def put_prayers(d: date, data: PrayersIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _apply(_get_or_create(db, PrayerTracking, user.id, d), data)
    db.commit()
    return _day(db, user, d)


@router.put("/days/{d}/adhkar", response_model=DayOut)
def put_adhkar(d: date, data: AdhkarIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = _get_or_create(db, AdhkarTracking, user.id, d)
    values = data.model_dump(exclude_none=True)
    # Sanoq maqsaddan oshmasin
    for key, target in ADHKAR_TARGETS.items():
        if key in values:
            values[key] = min(values[key], target)
    for key, value in values.items():
        setattr(row, key, value)
    zk.mirror_legacy(db, user.id, d, values)
    db.commit()
    return _day(db, user, d)


@router.put("/days/{d}/zikrs", response_model=DayOut)
def put_zikr_counts(
    d: date, data: ZikrCountsIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Zikr sanoqlari: {"counts": {"<zikr_id>": son}}. Maqsaddan oshsa kesiladi."""
    by_id = {z["id"]: z for z in zk.effective_zikrs(db, user.id)}
    unknown = [i for i in data.counts if i not in by_id]
    if unknown:
        raise HTTPException(status_code=404, detail="Zikr topilmadi")
    for zid, n in data.counts.items():
        zk.set_count(db, user.id, d, by_id[zid], n)
    db.commit()
    return _day(db, user, d)


@router.put("/days/{d}/reflection", response_model=DayOut)
def put_reflection(
    d: date, data: ReflectionIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    _apply(_get_or_create(db, EveningReflection, user.id, d), data)
    db.commit()
    return _day(db, user, d)


@router.get("/summary/{d}", response_model=SummaryOut)
def summary(d: date, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Vidjetlar uchun: zikr foizi, namozlar holati, affirmatsiya.

    Affirmatsiya bugun yozilmagan bo'lsa, oxirgi yozilgani ko'rsatiladi.
    """
    prayers = _find(db, PrayerTracking, user.id, d)
    log = _find(db, DailyLog, user.id, d)
    affirmation = db.scalar(
        select(DailyLog.affirmation)
        .where(DailyLog.user_id == user.id, DailyLog.date <= d, DailyLog.affirmation != "")
        .order_by(DailyLog.date.desc())
        .limit(1)
    )
    zikrs = zk.effective_zikrs(db, user.id)
    counts = zk.counts_for(db, user.id, d)
    return SummaryOut(
        date=d,
        adhkar_progress=zk.progress(zikrs, counts),
        zikrs=[{"title": z["title"], "count": min(counts.get(z["id"], 0), z["target"]), "target": z["target"]} for z in zikrs],
        prayers=PrayersOut.model_validate(prayers) if prayers else PrayersOut(),
        prayers_done=_prayers_done(prayers),
        affirmation=affirmation or "",
        daily_plans=log.daily_plans if log else "",
    )


@router.get("/history", response_model=list[HistoryItem])
def history(
    end: date,
    days: int = Query(default=7, ge=1, le=366),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    start = end - timedelta(days=days - 1)

    def by_date(model):
        rows = db.scalars(select(model).where(model.user_id == user.id, model.date >= start, model.date <= end))
        return {r.date: r for r in rows}

    prayers, refl = by_date(PrayerTracking), by_date(EveningReflection)
    zikrs = zk.effective_zikrs(db, user.id)
    counts = zk.counts_between(db, user.id, start, end)
    out = []
    for i in range(days):
        d = start + timedelta(days=i)
        r = refl.get(d)
        out.append(
            HistoryItem(
                date=d,
                prayers_done=_prayers_done(prayers.get(d)),
                adhkar_progress=zk.progress(zikrs, counts.get(d, {})),
                overall_score=r.overall_score if r else None,
            )
        )
    return out
