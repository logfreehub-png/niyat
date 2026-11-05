import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import telegram_bot
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
