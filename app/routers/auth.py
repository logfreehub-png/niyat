import logging
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import telegram_bot
from ..auth import create_access_token, get_current_user, hash_password, verify_password
from ..config import settings
from ..database import get_db
from ..models import PhoneVerification, User, utcnow
from ..phone import check_code, normalize_phone
from ..schemas import ForgotIn, ForgotOut, PhoneStartIn, PhoneStartOut, RegisterIn, ResetIn, Token, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
log = logging.getLogger("niyat.auth")

RESEND_COOLDOWN_SECONDS = 60


def _token_for(user: User) -> Token:
    return Token(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


def _phone_or_422(raw: str) -> str:
    phone = normalize_phone(raw)
    if phone is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Telefon raqam noto'g'ri")
    return phone


def _bot_or_503() -> telegram_bot.TelegramBot:
    bot = telegram_bot.bot
    if bot is None or bot.username is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Telegram bot hozircha ishlamayapti")
    return bot


def _user_by_phone(db: Session, phone: str) -> User | None:
    return db.scalar(select(User).where(User.phone == phone))


def _consume_code(db: Session, token: str, code: str, purpose: str) -> PhoneVerification:
    """Kodni tekshiradi; to'g'ri bo'lsa verification'ni ishlatilgan deb belgilaydi (commit chaqiruvchida)."""
    v = db.scalar(select(PhoneVerification).where(PhoneVerification.token == token))
    if v is None or v.used or v.purpose != purpose:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Tasdiqlash so'rovi topilmadi. Qaytadan boshlang")
    if v.code_hash is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Avval Telegram botda raqamingizni yuboring")
    if v.attempts >= settings.code_max_attempts:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Urinishlar soni tugadi. Qaytadan boshlang")
    if v.code_expires_at is None or utcnow() > v.code_expires_at:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Kod muddati o'tgan. Yangi kod oling")
    if not check_code(code, v.code_hash):
        v.attempts += 1
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Kod noto'g'ri")
    v.used = True
    return v


# ---------------- Ro'yxatdan o'tish ----------------
@router.post("/phone/start", response_model=PhoneStartOut)
def phone_start(data: PhoneStartIn, db: Session = Depends(get_db)):
    """1-qadam: raqam qabul qilinadi va Telegram botga havola qaytariladi."""
    phone = _phone_or_422(data.phone)
    bot = _bot_or_503()
    if _user_by_phone(db, phone):
        raise HTTPException(status.HTTP_409_CONFLICT, "Bu raqam allaqachon ro'yxatdan o'tgan. Kirish bo'limidan foydalaning")
    v = PhoneVerification(token=secrets.token_urlsafe(24), phone=phone, purpose="register")
    db.add(v)
    db.commit()
    return PhoneStartOut(
        token=v.token, phone=phone, bot_url=bot.link(v.token), expires_in=settings.verification_ttl_minutes * 60
    )


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    """2-qadam: Telegram'dan kelgan kod va parol bilan hisob ochiladi."""
    v = _consume_code(db, data.token, data.code, "register")
    if _user_by_phone(db, v.phone):
        raise HTTPException(status.HTTP_409_CONFLICT, "Bu raqam allaqachon ro'yxatdan o'tgan")
    user = User(phone=v.phone, telegram_chat_id=v.chat_id, password_hash=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return _token_for(user)


# ---------------- Parolni tiklash ----------------
@router.post("/password/forgot", response_model=ForgotOut)
async def password_forgot(data: ForgotIn, db: Session = Depends(get_db)):
    """Kodni foydalanuvchining Telegram chatiga to'g'ridan-to'g'ri yuboradi.

    Yuborib bo'lmasa (botni bloklagan va h.k.) — bot havolasi qaytadi va
    ro'yxatdan o'tishdagi kabi "Raqamni yuborish" orqali kod olinadi.
    """
    phone = _phone_or_422(data.phone)
    bot = _bot_or_503()
    user = _user_by_phone(db, phone)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bu raqam ro'yxatdan o'tmagan")

    last = db.scalar(
        select(PhoneVerification)
        .where(PhoneVerification.phone == phone, PhoneVerification.purpose == "reset")
        .order_by(PhoneVerification.created_at.desc())
        .limit(1)
    )
    if last and utcnow() - last.created_at < timedelta(seconds=RESEND_COOLDOWN_SECONDS):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Biroz kuting va qayta urinib ko'ring (1 daqiqa)")
    # Eski tiklash so'rovlarini bekor qilamiz
    for old in db.scalars(
        select(PhoneVerification).where(
            PhoneVerification.phone == phone, PhoneVerification.purpose == "reset", PhoneVerification.used.is_(False)
        )
    ):
        old.used = True

    v = PhoneVerification(token=secrets.token_urlsafe(24), phone=phone, purpose="reset", chat_id=user.telegram_chat_id)
    db.add(v)
    code_sent = False
    if user.telegram_chat_id:
        code = bot.issue_code(v)
        db.commit()
        try:
            await bot.send_code(user.telegram_chat_id, code, "reset")
            code_sent = True
        except Exception:
            log.warning("Tiklash kodini yuborib bo'lmadi (chat %s)", user.telegram_chat_id)
            v.code_hash = None
            v.code_expires_at = None
    db.commit()
    return ForgotOut(
        token=v.token,
        phone=phone,
        code_sent=code_sent,
        bot_url=bot.link(v.token),
        expires_in=settings.verification_ttl_minutes * 60,
    )


@router.post("/password/reset", response_model=Token)
def password_reset(data: ResetIn, db: Session = Depends(get_db)):
    v = _consume_code(db, data.token, data.code, "reset")
    user = _user_by_phone(db, v.phone)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Foydalanuvchi topilmadi")
    user.password_hash = hash_password(data.password)
    if v.chat_id:
        user.telegram_chat_id = v.chat_id
    db.commit()
    return _token_for(user)


# ---------------- Kirish ----------------
@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Kirish: username maydoniga telefon raqam yoziladi."""
    phone = normalize_phone(form.username)
    user = _user_by_phone(db, phone) if phone else None
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Raqam yoki parol noto'g'ri")
    return _token_for(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
