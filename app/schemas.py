from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class PhoneStartIn(BaseModel):
    phone: str = Field(max_length=32)


class PhoneStartOut(BaseModel):
    token: str
    phone: str
    bot_url: str
    expires_in: int  # soniya
    code_sent: bool = False  # True: raqam botga avval tanish — kod darhol Telegram'ga yuborildi


class RegisterIn(BaseModel):
    token: str = Field(max_length=64)
    code: str = Field(min_length=6, max_length=6)
    password: str = Field(min_length=6, max_length=128)


class ForgotIn(BaseModel):
    phone: str = Field(max_length=32)


class ForgotOut(BaseModel):
    token: str
    phone: str
    code_sent: bool  # True: kod Telegram'ga yuborildi; False: avval botda raqamni yuborish kerak
    bot_url: str
    expires_in: int


class ResetIn(RegisterIn):
    pass


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    phone: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---- Daily log ----
class DailyLogIn(BaseModel):
    gratitudes: str | None = None
    affirmation: str | None = None
    daily_plans: str | None = None


class DailyLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    gratitudes: str = ""
    affirmation: str = ""
    daily_plans: str = ""


# ---- Prayers ----
class PrayersIn(BaseModel):
    fajr: bool | None = None
    dhuhr: bool | None = None
    asr: bool | None = None
    maghrib: bool | None = None
    isha: bool | None = None


class PrayersOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    fajr: bool = False
    dhuhr: bool = False
    asr: bool = False
    maghrib: bool = False
    isha: bool = False


# ---- Adhkar ----
class AdhkarIn(BaseModel):
    salavat_count: int | None = Field(default=None, ge=0)
    zikr_count: int | None = Field(default=None, ge=0)
    astagfirulloh_count: int | None = Field(default=None, ge=0)
    la_ilaha_count: int | None = Field(default=None, ge=0)
    inshiroh_count: int | None = Field(default=None, ge=0)
    waqiah_count: int | None = Field(default=None, ge=0)
    duo_completed: bool | None = None
    duo_text: str | None = None


class AdhkarOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    salavat_count: int = 0
    zikr_count: int = 0
    astagfirulloh_count: int = 0
    la_ilaha_count: int = 0
    inshiroh_count: int = 0
    waqiah_count: int = 0
    duo_completed: bool = False
    duo_text: str = ""


# ---- Reflection ----
class ReflectionIn(BaseModel):
    feel_today: str | None = None
    good_deeds: str | None = None
    mistakes_to_fix: str | None = None
    overall_score: int | None = Field(default=None, ge=1, le=10)


class ReflectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    feel_today: str = ""
    good_deeds: str = ""
    mistakes_to_fix: str = ""
    overall_score: int | None = None


# ---- Zikrlar ----
class ZikrOut(BaseModel):
    id: int
    title: str
    arabic: str = ""
    text: str = ""
    icon: str
    target: int
    is_custom: bool  # foydalanuvchi o'zi qo'shgan
    edited: bool = False  # default zikr foydalanuvchi tomonidan o'zgartirilgan
    legacy_key: str | None = None


class ZikrDayItem(ZikrOut):
    count: int = 0


class ZikrCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    arabic: str = Field(default="", max_length=4000)
    text: str = Field(default="", max_length=20000)
    icon: str = Field(default="star-four-points-outline", max_length=64)
    target: int = Field(default=100, ge=1, le=100000)


class ZikrPatch(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    arabic: str | None = Field(default=None, max_length=4000)
    text: str | None = Field(default=None, max_length=20000)
    icon: str | None = Field(default=None, max_length=64)
    target: int | None = Field(default=None, ge=1, le=100000)


class ZikrCountsIn(BaseModel):
    counts: dict[int, int]  # zikr_id → sanoq


# ---- Aggregates ----
class DayOut(BaseModel):
    date: date
    log: DailyLogOut
    prayers: PrayersOut
    adhkar: AdhkarOut
    reflection: ReflectionOut
    adhkar_targets: dict[str, int]
    adhkar_progress: int  # 0..100 %
    adhkar_all_done: bool
    zikrs: list[ZikrDayItem] = []


class SummaryOut(BaseModel):
    """Vidjetlar uchun ixcham ma'lumot."""
    date: date
    adhkar_progress: int
    prayers: PrayersOut
    prayers_done: int
    affirmation: str
    daily_plans: str = ""


class HistoryItem(BaseModel):
    date: date
    prayers_done: int
    adhkar_progress: int
    overall_score: int | None


# ---- Admin ----
class AdminLoginIn(BaseModel):
    password: str = Field(max_length=200)


class AdminZikrIn(ZikrCreate):
    sort_order: int = 0
    active: bool = True


class AdminZikrPatch(ZikrPatch):
    sort_order: int | None = None
    active: bool | None = None
