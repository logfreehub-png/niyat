import asyncio
import os
import re

os.environ["DATABASE_URL"] = "sqlite:///./test_niyat.db"
os.environ["TELEGRAM_BOT_TOKEN"] = ""  # testda haqiqiy bot ishga tushmasin

import pytest
from fastapi.testclient import TestClient

from app import telegram_bot
from app.database import Base, engine
from app.main import app
from app.phone import normalize_phone

DAY = "2026-11-05"


class FakeBot(telegram_bot.TelegramBot):
    """Telegram API o'rniga yuborilgan xabarlarni yozib boradi."""

    def __init__(self):
        super().__init__("test")
        self.username = "niyat_auth_bot"
        self.sent: list[dict] = []
        self.fail = False  # True: foydalanuvchi botni bloklagandek

    async def api(self, method, **params):
        if self.fail:
            raise RuntimeError("Forbidden: bot was blocked by the user")
        self.sent.append({"method": method, **params})
        return {}

    def last_text(self) -> str:
        return self.sent[-1]["text"]

    def feed(self, chat_id: int, **message):
        update = {"update_id": 1, "message": {"chat": {"id": chat_id, "type": "private"}, "from": {"id": chat_id}, **message}}
        asyncio.run(self.handle_update(update))


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    with TestClient(app) as c:
        telegram_bot.bot = FakeBot()
        yield c
    telegram_bot.bot = None
    Base.metadata.drop_all(bind=engine)


def _verify_via_bot(client, phone: str, chat_id: int, telegram_phone: str | None = None) -> tuple[str, str]:
    r = client.post("/auth/phone/start", json={"phone": phone})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["bot_url"] == f"https://t.me/niyat_auth_bot?start={body['token']}"
    bot: FakeBot = telegram_bot.bot
    bot.feed(chat_id, text=f"/start {body['token']}")
    assert bot.sent[-1]["reply_markup"]["keyboard"][0][0]["request_contact"] is True
    bot.feed(chat_id, contact={"phone_number": telegram_phone or phone, "user_id": chat_id})
    m = re.search(r"<code>(\d{6})</code>", bot.last_text())
    return body["token"], m.group(1) if m else ""


def _auth(client, phone="+998901234567", chat_id=111):
    token, code = _verify_via_bot(client, phone, chat_id)
    r = client.post("/auth/register", json={"token": token, "code": code, "password": "secret123"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_normalize_phone():
    assert normalize_phone("90 123 45 67") == "+998901234567"
    assert normalize_phone("+998 (90) 123-45-67") == "+998901234567"
    assert normalize_phone("998901234567") == "+998901234567"
    assert normalize_phone("123") is None


def test_register_login_me(client):
    _auth(client)
    # takroriy ro'yxat
    assert client.post("/auth/phone/start", json={"phone": "901234567"}).status_code == 409
    # kirish: raqam istalgan formatda
    r = client.post("/auth/login", data={"username": "90 123 45 67", "password": "secret123"})
    assert r.status_code == 200, r.text
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert client.get("/auth/me", headers=h).json()["phone"] == "+998901234567"
    assert client.post("/auth/login", data={"username": "+998901234567", "password": "xato"}).status_code == 401
    assert client.get("/auth/me").status_code == 401


def test_verification_rejections(client):
    bot: FakeBot = telegram_bot.bot
    # Telegram raqami mos emas -> kod yuborilmaydi
    token, code = _verify_via_bot(client, "+998901111111", 222, telegram_phone="+998902222222")
    assert code == "" and "mos emas" in bot.last_text()

    # Begona kontakt
    r = client.post("/auth/phone/start", json={"phone": "+998903333333"}).json()
    bot.feed(333, text=f"/start {r['token']}")
    bot.feed(333, contact={"phone_number": "+998903333333", "user_id": 999})
    assert "o'zingizning" in bot.last_text()
    # kontakt yuborilmagan bo'lsa ro'yxatdan o'tib bo'lmaydi
    assert client.post("/auth/register", json={"token": r["token"], "code": "000000", "password": "secret123"}).status_code == 400

    # Noto'g'ri kod va urinishlar chegarasi
    token, code = _verify_via_bot(client, "+998904444444", 444)
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(5):
        assert client.post("/auth/register", json={"token": token, "code": wrong, "password": "secret123"}).status_code == 400
    assert client.post("/auth/register", json={"token": token, "code": code, "password": "secret123"}).status_code == 429

    # Noto'g'ri raqam formati
    assert client.post("/auth/phone/start", json={"phone": "12"}).status_code == 422


def test_code_single_use(client):
    token, code = _verify_via_bot(client, "+998905555555", 555)
    body = {"token": token, "code": code, "password": "secret123"}
    assert client.post("/auth/register", json=body).status_code == 201
    assert client.post("/auth/register", json=body).status_code == 400


def _code_from(text: str) -> str:
    return re.search(r"<code>(\d{6})</code>", text).group(1)


def _login(client, phone, password):
    return client.post("/auth/login", data={"username": phone, "password": password}).status_code


def test_password_reset_direct(client):
    bot: FakeBot = telegram_bot.bot
    _auth(client, "+998901234567", 111)

    r = client.post("/auth/password/forgot", json={"phone": "90 123 45 67"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["code_sent"] is True
    assert bot.sent[-1]["chat_id"] == 111 and "Parolni tiklash" in bot.last_text()
    code = _code_from(bot.last_text())

    # ro'yxat tokeni bilan tiklab bo'lmaydi va aksincha
    assert client.post("/auth/register", json={"token": body["token"], "code": code, "password": "x" * 6}).status_code == 400

    r = client.post("/auth/password/reset", json={"token": body["token"], "code": code, "password": "yangiparol"})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["phone"] == "+998901234567"
    assert _login(client, "+998901234567", "secret123") == 401
    assert _login(client, "+998901234567", "yangiparol") == 200
    # kod qayta ishlamaydi
    assert client.post("/auth/password/reset", json={"token": body["token"], "code": code, "password": "boshqa123"}).status_code == 400


def test_password_reset_cooldown_and_unknown(client):
    _auth(client, "+998901234567", 111)
    assert client.post("/auth/password/forgot", json={"phone": "+998909999999"}).status_code == 404
    assert client.post("/auth/password/forgot", json={"phone": "+998901234567"}).status_code == 200
    assert client.post("/auth/password/forgot", json={"phone": "+998901234567"}).status_code == 429


def test_password_reset_when_bot_blocked(client):
    bot: FakeBot = telegram_bot.bot
    _auth(client, "+998901234567", 111)
    bot.fail = True
    body = client.post("/auth/password/forgot", json={"phone": "+998901234567"}).json()
    assert body["code_sent"] is False and body["bot_url"].endswith(body["token"])
    bot.fail = False
    # foydalanuvchi botni qayta ochib, kontakt yuboradi (yangi chat bo'lishi ham mumkin)
    bot.feed(777, text=f"/start {body['token']}")
    assert "parolni tiklash" in bot.last_text()
    bot.feed(777, contact={"phone_number": "998901234567", "user_id": 777})
    code = _code_from(bot.last_text())
    r = client.post("/auth/password/reset", json={"token": body["token"], "code": code, "password": "yangiparol"})
    assert r.status_code == 200
    assert _login(client, "+998901234567", "yangiparol") == 200


def test_day_flow(client):
    h = _auth(client)
    d = client.get(f"/days/{DAY}", headers=h).json()
    assert d["adhkar_progress"] == 0 and d["prayers"]["fajr"] is False

    d = client.put(f"/days/{DAY}/prayers", json={"fajr": True, "asr": True}, headers=h).json()
    assert d["prayers"]["fajr"] and d["prayers"]["asr"] and not d["prayers"]["dhuhr"]

    d = client.put(f"/days/{DAY}/adhkar", json={"salavat_count": 500, "waqiah_count": 5}, headers=h).json()
    assert d["adhkar"]["salavat_count"] == 100
    assert d["adhkar_progress"] == round(100 * (1 + 0.5) / 6)

    d = client.put(f"/days/{DAY}/adhkar", json=dict(d["adhkar_targets"]), headers=h).json()
    assert d["adhkar_all_done"] is True

    d = client.put(f"/days/{DAY}/log", json={"affirmation": "Men sabrli insonman"}, headers=h).json()
    assert d["log"]["affirmation"] == "Men sabrli insonman"

    assert client.put(f"/days/{DAY}/reflection", json={"overall_score": 11}, headers=h).status_code == 422
    d = client.put(f"/days/{DAY}/reflection", json={"overall_score": 8, "feel_today": "Yaxshi"}, headers=h).json()
    assert d["reflection"]["overall_score"] == 8

    s = client.get("/summary/2026-11-06", headers=h).json()
    assert s["affirmation"] == "Men sabrli insonman"
    assert s["prayers_done"] == 0

    hist = client.get(f"/history?end={DAY}&days=3", headers=h).json()
    assert len(hist) == 3 and hist[-1]["prayers_done"] == 2 and hist[-1]["overall_score"] == 8


def test_users_isolated(client):
    h1 = _auth(client, "+998901234567", 111)
    h2 = _auth(client, "+998907654321", 222)
    client.put(f"/days/{DAY}/prayers", json={"fajr": True}, headers=h1)
    assert client.get(f"/days/{DAY}", headers=h2).json()["prayers"]["fajr"] is False


def test_telegram_webhook(client):
    bot: FakeBot = telegram_bot.bot
    update = {"update_id": 7, "message": {"chat": {"id": 777, "type": "private"}, "from": {"id": 777}, "text": "/start"}}
    # Secret token'siz — rad etiladi
    assert client.post(telegram_bot.WEBHOOK_PATH, json=update).status_code == 403
    assert client.post(
        telegram_bot.WEBHOOK_PATH, json=update, headers={"X-Telegram-Bot-Api-Secret-Token": "wrong"}
    ).status_code == 403
    r = client.post(
        telegram_bot.WEBHOOK_PATH, json=update, headers={"X-Telegram-Bot-Api-Secret-Token": bot.webhook_secret}
    )
    assert r.status_code == 200
    assert bot.sent[-1]["chat_id"] == 777 and "Assalomu alaykum" in bot.last_text()


def test_root_ok(client):
    assert client.get("/").status_code == 200
    assert client.head("/").status_code == 200
