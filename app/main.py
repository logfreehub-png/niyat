import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from . import telegram_bot
from .config import settings
from .database import engine
from .migrations import run_migrations
from .routers import auth, days

logging.basicConfig(level=logging.INFO)
# httpx so'rov URL'ini (ichida bot tokeni bor) logga yozmasin
logging.getLogger("httpx").setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(_: FastAPI):
    run_migrations(engine)
    task = None
    if telegram_bot.bot is not None:
        base_url = settings.webhook_base_url
        if base_url:
            # Production: webhook (bir nechta instansiya / deploy paytida Conflict bo'lmaydi)
            task = asyncio.create_task(telegram_bot.bot.setup_webhook(base_url))
        else:
            # Lokal: long polling
            task = asyncio.create_task(telegram_bot.bot.run())
    else:
        logging.warning("TELEGRAM_BOT_TOKEN berilmagan — raqam tasdiqlash ishlamaydi")
    yield
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
        await telegram_bot.bot.close()


app = FastAPI(title="Niyat — Ma'naviy Kundalik API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(days.router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
def root():
    return {"status": "ok"}


@app.post(telegram_bot.WEBHOOK_PATH, include_in_schema=False)
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
):
    bot = telegram_bot.bot
    if bot is None or x_telegram_bot_api_secret_token != bot.webhook_secret:
        raise HTTPException(status_code=403)
    if bot.username is None:
        with contextlib.suppress(Exception):
            bot.username = (await bot.api("getMe"))["username"]
    try:
        await bot.handle_update(await request.json())
    except Exception:
        # 200 qaytaramiz, aks holda Telegram shu update'ni qayta-qayta yuboradi
        logging.getLogger("niyat.bot").exception("Webhook update'ni qayta ishlashda xato")
    return {"ok": True}
