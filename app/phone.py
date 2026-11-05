import hashlib
import hmac
import re
import secrets

from .config import settings


def normalize_phone(raw: str) -> str | None:
    """Raqamni +XXXXXXXXXXX ko'rinishiga keltiradi. Noto'g'ri bo'lsa None.

    "90 123 45 67" (9 xonali O'zbekiston raqami) -> +998901234567
    """
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 9:
        digits = "998" + digits
    if not 10 <= len(digits) <= 15:
        return None
    return "+" + digits


def new_code() -> str:
    return f"{secrets.randbelow(10**6):06d}"


def hash_code(code: str) -> str:
    return hmac.new(settings.jwt_secret.encode(), code.encode(), hashlib.sha256).hexdigest()


def check_code(code: str, code_hash: str) -> bool:
    return hmac.compare_digest(hash_code(code.strip()), code_hash)
