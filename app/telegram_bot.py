"""Telegram bot (long polling): foydalanuvchi raqamini kontakt orqali tasdiqlaydi va kod yuboradi."""

import asyncio
import logging
from datetime import timedelta

import httpx
from sqlalchemy import select

from .config import settings
from .database import SessionLocal
from .models import PhoneVerification, utcnow
from .phone import hash_code, new_code, normalize_phone

log = logging.getLogger("niyat.bot")

CONTACT_KEYBOARD = {
    "keyboard": [[{"text": "📱 Raqamni yuborish", "request_contact": True}]],
    "resize_keyboard": True,
    "one_time_keyboard": True,
}
REMOVE_KEYBOARD = {"remove_keyboard": True}


class TelegramBot:
    def __init__(self, token: str):
        self.token = token
        self.username: str | None = None
        self._client: httpx.AsyncClient | None = None

    async def api(self, method: str, **params):
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=40)
        r = await self._client.post(f"https://api.telegram.org/bot{self.token}/{method}", json=params)
        data = r.json()
        if not data.get("ok"):
            raise RuntimeError(f"Telegram {method}: {data.get('description')}")
        return data["result"]

    async def send(self, chat_id: int, text: str, reply_markup: dict | None = None):
        params = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
        if reply_markup:
            params["reply_markup"] = reply_markup
        await self.api("sendMessage", **params)

    def link(self, token: str) -> str:
        return f"https://t.me/{self.username}?start={token}"

    @staticmethod
    def issue_code(v: PhoneVerification) -> str:
        """Yangi kod yaratib, verification'ga xeshini yozadi (commit chaqiruvchida)."""
        code = new_code()
        v.code_hash = hash_code(code)
        v.code_expires_at = utcnow() + timedelta(minutes=settings.code_ttl_minutes)
        v.attempts = 0
        return code

    async def send_code(self, chat_id: int, code: str, purpose: str) -> None:
        if purpose == "reset":
            head = "🔑 <b>Parolni tiklash</b>"
        else:
            head = "✅ <b>Raqamingiz tasdiqlandi</b>"
        await self.send(
            chat_id,
            f"{head}\n\n"
            f"Niyat ilovasi uchun kodingiz:\n"
            f"<code>{code}</code>\n\n"
            f"👆 Kodni nusxalash uchun ustiga bosing.\n"
            f"⏳ {settings.code_ttl_minutes} daqiqa amal qiladi.\n"
            f"🔒 Kodni hech kimga bermang — Niyat xodimlari uni hech qachon so'ramaydi.",
            REMOVE_KEYBOARD,
        )

    # ---------- Xabarlarni qayta ishlash ----------
    async def handle_update(self, update: dict) -> None:
        msg = update.get("message")
        if not msg or msg.get("chat", {}).get("type") != "private":
            return
        chat_id = msg["chat"]["id"]
        text = msg.get("text") or ""

        if text.startswith("/start"):
            parts = text.split(maxsplit=1)
            await self._on_start(chat_id, parts[1].strip() if len(parts) > 1 else "")
        elif "contact" in msg:
            await self._on_contact(chat_id, msg["from"]["id"], msg["contact"])
        else:
            await self.send(chat_id, "Ro'yxatdan o'tish uchun Niyat ilovasidagi <b>Telegram orqali tasdiqlash</b> tugmasini bosing.")

    async def _on_start(self, chat_id: int, token: str) -> None:
        with SessionLocal() as db:
            v = db.scalar(select(PhoneVerification).where(PhoneVerification.token == token)) if token else None
            if v is None or v.used or utcnow() - v.created_at > timedelta(minutes=settings.verification_ttl_minutes):
                await self.send(
                    chat_id,
                    "Assalomu alaykum! 🌙\nHavola eskirgan yoki noto'g'ri. Ilovada raqamingizni qaytadan kiriting.",
                )
                return
            v.chat_id = chat_id
            db.commit()
            phone, purpose = v.phone, v.purpose
        action = "parolni tiklash" if purpose == "reset" else "raqamini tasdiqlash"
        await self.send(
            chat_id,
            f"Assalomu alaykum! 🌙\n<b>{phone}</b> {action} uchun pastdagi tugmani bosing.",
            CONTACT_KEYBOARD,
        )

    async def _on_contact(self, chat_id: int, from_id: int, contact: dict) -> None:
        if contact.get("user_id") != from_id:
            await self.send(chat_id, "Iltimos, <b>o'zingizning</b> raqamingizni tugma orqali yuboring.", CONTACT_KEYBOARD)
            return
        phone = normalize_phone(contact.get("phone_number", ""))
        with SessionLocal() as db:
            v = db.scalar(
                select(PhoneVerification)
                .where(PhoneVerification.chat_id == chat_id, PhoneVerification.used.is_(False))
                .order_by(PhoneVerification.created_at.desc())
                .limit(1)
            )
            if v is None or utcnow() - v.created_at > timedelta(minutes=settings.verification_ttl_minutes):
                await self.send(chat_id, "Faol so'rov topilmadi. Ilovada raqamingizni qaytadan kiriting.", REMOVE_KEYBOARD)
                return
            if phone != v.phone:
                await self.send(
                    chat_id,
                    f"Telegram raqamingiz ({phone}) ilovada kiritilgan <b>{v.phone}</b> raqamiga mos emas.\n"
                    "Ilovada Telegram'dagi raqamingizni kiriting.",
                    REMOVE_KEYBOARD,
                )
                return
            code = self.issue_code(v)
            purpose = v.purpose
            db.commit()
        await self.send_code(chat_id, code, purpose)

    # ---------- Long polling ----------
    async def run(self) -> None:
        offset = None
        while True:
            try:
                if self.username is None:
                    await self.api("deleteWebhook")
                    self.username = (await self.api("getMe"))["username"]
                    log.info("Telegram bot ishga tushdi: @%s", self.username)
                updates = await self.api("getUpdates", offset=offset, timeout=25, allowed_updates=["message"])
                for u in updates:
                    offset = u["update_id"] + 1
                    try:
                        await self.handle_update(u)
                    except Exception:
                        log.exception("Update'ni qayta ishlashda xato")
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("Telegram bilan aloqa xatosi, 5 soniyadan keyin qayta urinish")
                await asyncio.sleep(5)

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()


bot: TelegramBot | None = TelegramBot(settings.telegram_bot_token) if settings.telegram_bot_token else None
