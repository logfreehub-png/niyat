from datetime import date, timedelta
from typing import TypeVar

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import Base, get_db
from ..models import ADHKAR_TARGETS, AdhkarTracking, DailyLog, EveningReflection, PrayerTracking, User
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


def adhkar_progress(a: AdhkarTracking | None) -> int:
    """Har bir zikrning bajarilish ulushi o'rtachasi (0..100)."""
    if a is None:
        return 0
    ratios = [min(getattr(a, k) or 0, t) / t for k, t in ADHKAR_TARGETS.items()]
    return round(100 * sum(ratios) / len(ratios))


def _prayers_done(p: PrayerTracking | None) -> int:
    return sum(bool(getattr(p, f)) for f in PRAYER_FIELDS) if p else 0


def _day(db: Session, user: User, d: date) -> DayOut:
    log = _find(db, DailyLog, user.id, d)
    prayers = _find(db, PrayerTracking, user.id, d)
    adhkar = _find(db, AdhkarTracking, user.id, d)
    refl = _find(db, EveningReflection, user.id, d)
    progress = adhkar_progress(adhkar)
    return DayOut(
        date=d,
        log=DailyLogOut.model_validate(log) if log else DailyLogOut(),
        prayers=PrayersOut.model_validate(prayers) if prayers else PrayersOut(),
        adhkar=AdhkarOut.model_validate(adhkar) if adhkar else AdhkarOut(),
        reflection=ReflectionOut.model_validate(refl) if refl else ReflectionOut(),
        adhkar_targets=ADHKAR_TARGETS,
        adhkar_progress=progress,
        adhkar_all_done=progress == 100,
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
    affirmation = db.scalar(
        select(DailyLog.affirmation)
        .where(DailyLog.user_id == user.id, DailyLog.date <= d, DailyLog.affirmation != "")
        .order_by(DailyLog.date.desc())
        .limit(1)
    )
    return SummaryOut(
        date=d,
        adhkar_progress=adhkar_progress(_find(db, AdhkarTracking, user.id, d)),
        prayers=PrayersOut.model_validate(prayers) if prayers else PrayersOut(),
        prayers_done=_prayers_done(prayers),
        affirmation=affirmation or "",
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

    prayers, adhkar, refl = by_date(PrayerTracking), by_date(AdhkarTracking), by_date(EveningReflection)
    out = []
    for i in range(days):
        d = start + timedelta(days=i)
        r = refl.get(d)
        out.append(
            HistoryItem(
                date=d,
                prayers_done=_prayers_done(prayers.get(d)),
                adhkar_progress=adhkar_progress(adhkar.get(d)),
                overall_score=r.overall_score if r else None,
            )
        )
    return out
