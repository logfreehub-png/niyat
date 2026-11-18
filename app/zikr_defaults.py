"""Boshlang'ich (default) zikrlar. Bazada umumiy zikr bo'lmasa, server ishga tushganda qo'shiladi.

Keyin ularni admin paneldan o'zgartirish mumkin — bu fayl faqat birinchi to'ldirish uchun.
"""

DEFAULT_ZIKRS = [
    {
        "legacy_key": "salavat_count",
        "title": "Salovat",
        "arabic": "اللّٰهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ",
        "text": "Allohumma solli ʼalaa Muhammad.\n\nMa'nosi: Ey Alloh, Muhammad (s.a.v.)ga salovat (rahmat) yo'llagin.",
        "icon": "heart-outline",
        "target": 100,
    },
    {
        "legacy_key": "zikr_count",
        "title": "Zikr",
        "arabic": "ذِكْرُ اللّٰهِ",
        "text": "Subhanalloh · Alhamdulillah · La ilaha illalloh · Allohu akbar.\n\n"
        "Ma'nosi: Alloh pokdir · Allohga hamd bo'lsin · Allohdan o'zga iloh yo'q · Alloh buyukdir.",
        "icon": "star-four-points-outline",
        "target": 1000,
    },
    {
        "legacy_key": "astagfirulloh_count",
        "title": "Astag'firulloh",
        "arabic": "أَسْتَغْفِرُ اللّٰهَ",
        "text": "Astag'firulloh.\n\nMa'nosi: Allohdan mag'firat (gunohlarim kechirilishini) so'rayman.",
        "icon": "water-outline",
        "target": 1000,
    },
    {
        "legacy_key": "la_ilaha_count",
        "title": "Laa ilaaha illallohul malikul haqqul mubiin",
        "arabic": "لَا إِلٰهَ إِلَّا اللّٰهُ الْمَلِكُ الْحَقُّ الْمُبِينُ",
        "text": "Laa ilaaha illallohul malikul haqqul mubiyn.\n\n"
        "Ma'nosi: Allohdan o'zga iloh yo'q, U haq va ochiq-oydin Podshohdir.",
        "icon": "shield-star-outline",
        "target": 100,
    },
    {
        "legacy_key": "inshiroh_count",
        "title": "Alam nashroh (Inshiroh surasi)",
        "arabic": "سُورَةُ الشَّرْحِ",
        "text": "Bismillahir rohmanir rohiym.\n"
        "1. Alam nashroh laka sodrok.\n"
        "2. Va voda'naa 'anka vizrok.\n"
        "3. Allaziy anqoza zohrok.\n"
        "4. Va rofa'naa laka zikrok.\n"
        "5. Fa inna ma'al 'usri yusroo.\n"
        "6. Inna ma'al 'usri yusroo.\n"
        "7. Fa izaa farog'ta fansob.\n"
        "8. Va ilaa robbika farg'ab.",
        "icon": "book-open-variant",
        "target": 100,
    },
    {
        "legacy_key": "waqiah_count",
        "title": "Voqea surasi",
        "arabic": "سُورَةُ الْوَاقِعَةِ",
        "text": "Voqea surasi — Qur'onning 56-surasi, 96 oyat.\n"
        "Bismillahir rohmanir rohiym. Izaa vaqo'atil vaaqi'ah…",
        "icon": "book-open-page-variant-outline",
        "target": 10,
    },
]

# Ilovada tanlash mumkin bo'lgan ikonkalar (MaterialCommunityIcons nomlari)
ZIKR_ICONS = [
    "heart-outline",
    "star-four-points-outline",
    "water-outline",
    "shield-star-outline",
    "book-open-variant",
    "book-open-page-variant-outline",
    "star-crescent",
    "hands-pray",
    "flower-outline",
    "white-balance-sunny",
    "weather-night",
    "leaf",
]
