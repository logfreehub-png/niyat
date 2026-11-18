import asyncio
import os
import re

os.environ["DATABASE_URL"] = "sqlite:///./test_niyat.db"
os.environ["TELEGRAM_BOT_TOKEN"] = ""  # testda haqiqiy bot ishga tushmasin
os.environ["ADMIN_PASSWORD"] = "admin-test-pass"

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


def test_known_number_gets_code_without_contact(client):
    """Kontakt bir marta yuborilgach, bot raqamni eslab qoladi va keyingi safar kodni darhol yuboradi."""
    bot: FakeBot = telegram_bot.bot
    phone = "+998901212121"
    # 1-safar: odatdagi oqim (kontakt yuboriladi), lekin ro'yxatdan o'tish tugallanmaydi
    first = client.post("/auth/phone/start", json={"phone": phone}).json()
    assert first["code_sent"] is False
    bot.feed(1212, text=f"/start {first['token']}")
    bot.feed(1212, contact={"phone_number": phone, "user_id": 1212})
    assert _code_from(bot.last_text())

    # 2-safar (1 daqiqa o'tmasidan): spamdan himoya
    assert client.post("/auth/phone/start", json={"phone": phone}).status_code == 429

    # 1 daqiqadan keyin: kod Telegram'ga darhol boradi, kontakt so'ralmaydi
    from app.database import SessionLocal
    from app.models import PhoneVerification
    from datetime import timedelta

    with SessionLocal() as db:
        for v in db.query(PhoneVerification).all():
            v.created_at -= timedelta(minutes=2)
        db.commit()
    sent_before = len(bot.sent)
    r = client.post("/auth/phone/start", json={"phone": phone})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["code_sent"] is True
    assert len(bot.sent) == sent_before + 1 and bot.sent[-1]["chat_id"] == 1212
    code = _code_from(bot.last_text())
    # eski so'rov bekor qilingan
    assert client.post("/auth/register", json={"token": first["token"], "code": code, "password": "secret123"}).status_code == 400
    r = client.post("/auth/register", json={"token": body["token"], "code": code, "password": "secret123"})
    assert r.status_code == 201, r.text


def test_known_chat_start_link_sends_code(client):
    """Tanish chat bot havolasini ochsa — kontakt tugmasi o'rniga darhol kod keladi."""
    bot: FakeBot = telegram_bot.bot
    phone = "+998903434343"
    first = client.post("/auth/phone/start", json={"phone": phone}).json()
    bot.feed(3434, text=f"/start {first['token']}")
    bot.feed(3434, contact={"phone_number": phone, "user_id": 3434})

    from app.database import SessionLocal
    from app.models import PhoneVerification
    from datetime import timedelta

    with SessionLocal() as db:
        for v in db.query(PhoneVerification).all():
            v.created_at -= timedelta(minutes=2)
        db.commit()
    bot.fail = True  # darhol yuborish muvaffaqiyatsiz bo'ldi (masalan, tarmoq)
    body = client.post("/auth/phone/start", json={"phone": phone}).json()
    assert body["code_sent"] is False
    bot.fail = False
    bot.feed(3434, text=f"/start {body['token']}")
    assert "reply_markup" not in bot.sent[-1] or "keyboard" not in bot.sent[-1]["reply_markup"]
    code = _code_from(bot.last_text())
    r = client.post("/auth/register", json={"token": body["token"], "code": code, "password": "secret123"})
    assert r.status_code == 201, r.text


# ---------------- Zikrlar ----------------
def test_default_zikrs_seeded_and_counts(client):
    h = _auth(client)
    zs = client.get("/zikrs", headers=h).json()
    assert [z["legacy_key"] for z in zs][:2] == ["salavat_count", "zikr_count"]
    assert len(zs) == 6 and all(z["text"] for z in zs)
    salovat = zs[0]
    d = client.put(f"/days/{DAY}/zikrs", json={"counts": {str(salovat["id"]): 250}}, headers=h).json()
    item = next(z for z in d["zikrs"] if z["id"] == salovat["id"])
    assert item["count"] == 100  # maqsaddan oshmaydi
    assert d["adhkar"]["salavat_count"] == 100  # eski ustunga ham yoziladi
    assert d["adhkar_progress"] == round(100 / 6)
    # Eski API orqali yozilsa — yangi jadvalda ham ko'rinadi
    d = client.put(f"/days/{DAY}/adhkar", json={"waqiah_count": 5}, headers=h).json()
    assert next(z for z in d["zikrs"] if z["legacy_key"] == "waqiah_count")["count"] == 5
    assert client.put(f"/days/{DAY}/zikrs", json={"counts": {"99999": 1}}, headers=h).status_code == 404
    # Bir so'rovda bir nechta zikr — yangi kun uchun ham (eski jadvalda takror qator bo'lmasin)
    ids = [z["id"] for z in zs]
    d = client.put("/days/2026-11-07/zikrs", json={"counts": {str(i): 10 for i in ids}}, headers=h).json()
    assert all(z["count"] == 10 for z in d["zikrs"])


def test_custom_zikr_and_overrides(client):
    h = _auth(client)
    h2 = _auth(client, phone="+998907777777", chat_id=222)
    r = client.post("/zikrs", json={"title": "Subhanalloh", "text": "Alloh pokdir", "target": 33}, headers=h)
    assert r.status_code == 201, r.text
    mine = r.json()
    assert mine["is_custom"] is True
    # Boshqa foydalanuvchiga ko'rinmaydi
    assert all(z["id"] != mine["id"] for z in client.get("/zikrs", headers=h2).json())
    assert client.patch(f"/zikrs/{mine['id']}", json={"target": 5}, headers=h2).status_code == 404

    d = client.put(f"/days/{DAY}/zikrs", json={"counts": {str(mine["id"]): 33}}, headers=h).json()
    assert len(d["zikrs"]) == 7 and d["adhkar_progress"] == round(100 / 7)

    # Default zikr matnini faqat o'zi uchun o'zgartirish
    default = client.get("/zikrs", headers=h).json()[0]
    z = client.patch(f"/zikrs/{default['id']}", json={"text": "Mening matnim", "target": 50}, headers=h).json()
    assert z["text"] == "Mening matnim" and z["target"] == 50 and z["edited"] is True
    other = next(x for x in client.get("/zikrs", headers=h2).json() if x["id"] == default["id"])
    assert other["text"] != "Mening matnim" and other["target"] == 100
    z = client.post(f"/zikrs/{default['id']}/reset", headers=h).json()
    assert z["edited"] is False and z["target"] == 100

    # Default zikrni yashirish va qaytarish; o'z zikrini o'chirish
    assert client.delete(f"/zikrs/{default['id']}", headers=h).status_code == 204
    assert all(x["id"] != default["id"] for x in client.get("/zikrs", headers=h).json())
    assert len(client.post("/zikrs/restore-hidden", headers=h).json()) == 7
    assert client.delete(f"/zikrs/{mine['id']}", headers=h).status_code == 204
    assert len(client.get("/zikrs", headers=h).json()) == 6


def test_summary_has_plans(client):
    h = _auth(client)
    client.put(f"/days/{DAY}/log", json={"daily_plans": "Kitob o'qish\nSport"}, headers=h)
    s = client.get(f"/summary/{DAY}", headers=h).json()
    assert s["daily_plans"] == "Kitob o'qish\nSport"


# ---------------- Admin ----------------
def _admin(client):
    assert client.post("/admin/api/login", json={"password": "wrong"}).status_code == 401
    r = client.post("/admin/api/login", json={"password": "admin-test-pass"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_admin_requires_login(client):
    assert client.get("/admin/api/stats").status_code == 401
    h = _auth(client)
    assert client.get("/admin/api/stats", headers=h).status_code == 401  # oddiy foydalanuvchi tokeni
    a = _admin(client)
    assert client.get("/auth/me", headers=a).status_code == 401  # admin tokeni oddiy API'da ishlamaydi
    assert client.get("/admin").status_code == 200


def test_admin_manage_default_zikrs(client):
    a = _admin(client)
    h = _auth(client)
    zs = client.get("/admin/api/zikrs", headers=a).json()["zikrs"]
    assert len(zs) == 6
    r = client.post("/admin/api/zikrs", json={"title": "Hasbunalloh", "target": 70, "text": "Alloh bizga kifoya"}, headers=a)
    assert r.status_code == 201
    new = r.json()
    assert any(z["id"] == new["id"] for z in client.get("/zikrs", headers=h).json())
    # Defaultni o'zgartirish hammaga ta'sir qiladi
    client.patch(f"/admin/api/zikrs/{zs[0]['id']}", json={"target": 300, "title": "Salovat sharif"}, headers=a)
    first = client.get("/zikrs", headers=h).json()[0]
    assert first["target"] == 300 and first["title"] == "Salovat sharif"
    # Faolsizlantirish — foydalanuvchida ko'rinmaydi
    client.patch(f"/admin/api/zikrs/{new['id']}", json={"active": False}, headers=a)
    assert all(z["id"] != new["id"] for z in client.get("/zikrs", headers=h).json())
    assert client.delete(f"/admin/api/zikrs/{new['id']}", headers=a).status_code == 204


def test_admin_stats_and_users(client):
    a = _admin(client)
    h = _auth(client)
    client.get("/auth/me", headers=h)
    from app.routers.admin import _today

    today = _today().isoformat()
    client.put(f"/days/{today}/prayers", json={"fajr": True, "dhuhr": True}, headers=h)
    s = client.get("/admin/api/stats", headers=a).json()
    assert s["users_total"] == 1 and s["active_today"] == 1 and s["prayers_marked_today"] == 2
    assert s["online_15m"] == 1 and len(s["series"]) == 14
    users = client.get("/admin/api/users?q=9012", headers=a).json()
    assert users["total"] == 1 and users["items"][0]["prayers_today"] == 2
    assert client.get("/admin/api/users?q=555", headers=a).json()["total"] == 0
    uid = users["items"][0]["id"]
    det = client.get(f"/admin/api/users/{uid}", headers=a).json()
    assert det["history"][-1]["prayers_done"] == 2 and len(det["zikrs"]) == 6
