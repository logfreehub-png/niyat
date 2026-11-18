"""Foydalanuvchi zikrlari: ro'yxat, o'z zikrini qo'shish, defaultni o'zi uchun tahrirlash/yashirish."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import zikrs as zk
from ..auth import get_current_user
from ..database import get_db
from ..models import User, Zikr, ZikrOverride
from ..schemas import ZikrCreate, ZikrOut, ZikrPatch

router = APIRouter(prefix="/zikrs", tags=["zikrs"])

MAX_CUSTOM = 50


def _out(db: Session, user: User, zikr_id: int) -> ZikrOut:
    for z in zk.effective_zikrs(db, user.id):
        if z["id"] == zikr_id:
            return ZikrOut(**z)
    raise HTTPException(status_code=404, detail="Zikr topilmadi")


def _visible(db: Session, user: User, zikr_id: int) -> Zikr:
    z = db.get(Zikr, zikr_id)
    if z is None or not z.active or (z.user_id is not None and z.user_id != user.id):
        raise HTTPException(status_code=404, detail="Zikr topilmadi")
    return z


@router.get("", response_model=list[ZikrOut])
def list_zikrs(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return [ZikrOut(**z) for z in zk.effective_zikrs(db, user.id)]


@router.post("", response_model=ZikrOut, status_code=status.HTTP_201_CREATED)
def create_zikr(data: ZikrCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.scalar(select(func.count()).select_from(Zikr).where(Zikr.user_id == user.id))
    if n >= MAX_CUSTOM:
        raise HTTPException(status_code=400, detail=f"Ko'pi bilan {MAX_CUSTOM} ta shaxsiy zikr qo'shish mumkin")
    last = db.scalar(select(func.max(Zikr.sort_order)).where(Zikr.user_id == user.id)) or 0
    z = Zikr(user_id=user.id, sort_order=last + 1, **data.model_dump())
    z.title = z.title.strip()
    db.add(z)
    db.commit()
    return _out(db, user, z.id)


@router.patch("/{zikr_id}", response_model=ZikrOut)
def update_zikr(
    zikr_id: int, data: ZikrPatch, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    z = _visible(db, user, zikr_id)
    values = data.model_dump(exclude_none=True)
    if z.user_id == user.id:
        # O'z zikri — to'g'ridan-to'g'ri o'zgartiramiz
        for k, v in values.items():
            setattr(z, k, v.strip() if k == "title" else v)
    else:
        # Default zikr — faqat shu foydalanuvchi uchun nom, matn va maqsadni o'zgartiramiz
        o = db.scalar(select(ZikrOverride).where(ZikrOverride.user_id == user.id, ZikrOverride.zikr_id == z.id))
        if o is None:
            o = ZikrOverride(user_id=user.id, zikr_id=z.id)
            db.add(o)
        o.hidden = False
        for k in ("title", "text", "target"):
            if k in values:
                setattr(o, k, values[k].strip() if k == "title" else values[k])
    db.commit()
    return _out(db, user, z.id)


@router.delete("/{zikr_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_zikr(zikr_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """O'z zikri — o'chiriladi; default zikr — faqat shu foydalanuvchi uchun yashiriladi."""
    z = _visible(db, user, zikr_id)
    if z.user_id == user.id:
        db.delete(z)
    else:
        o = db.scalar(select(ZikrOverride).where(ZikrOverride.user_id == user.id, ZikrOverride.zikr_id == z.id))
        if o is None:
            db.add(ZikrOverride(user_id=user.id, zikr_id=z.id, hidden=True))
        else:
            o.hidden = True
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{zikr_id}/reset", response_model=ZikrOut)
def reset_zikr(zikr_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Default zikrni asl holiga qaytarish (shaxsiy o'zgartirishlarni o'chirish)."""
    z = _visible(db, user, zikr_id)
    o = db.scalar(select(ZikrOverride).where(ZikrOverride.user_id == user.id, ZikrOverride.zikr_id == z.id))
    if o is not None:
        db.delete(o)
        db.commit()
    return _out(db, user, z.id)


@router.post("/restore-hidden", response_model=list[ZikrOut])
def restore_hidden(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Yashirilgan barcha default zikrlarni qaytarish."""
    for o in db.scalars(select(ZikrOverride).where(ZikrOverride.user_id == user.id, ZikrOverride.hidden.is_(True))):
        o.hidden = False
    db.commit()
    return [ZikrOut(**z) for z in zk.effective_zikrs(db, user.id)]
