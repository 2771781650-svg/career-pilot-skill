"""技能图谱：解决"简历里没写这个词，但能力其实有"的匹配问题。"""
from .resume import SKILL_DICT

# 同一技能的不同叫法
ALIAS: dict[str, list[str]] = {
    "ps": ["photoshop", "adobe ps"],
    "ai": ["illustrator", "ai作图"],
    "pr": ["premiere", "premiere pro"],
    "ae": ["after effects"],
    "3ds max": ["3dmax", "3d max"],
    "c4d": ["cinema 4d"],
    "剪映": ["capcut"],
    "javascript": ["js"],
    "html": ["html5"],
    "新媒体": ["自媒体", "公众号", "运营"],
    "文案": ["写稿", "脚本", "撰稿"],
    "数据标注": ["标注", "打标"],
    "提示词": ["prompt", "提示工程"],
}

# 能力类别之间的可迁移度（0~1）：做视频的，做抖音算半个会
CAT_LINK: dict[tuple[str, str], float] = {
    ("视频剪辑", "内容运营"): 0.45,
    ("视觉设计", "内容运营"): 0.30,
    ("视觉设计", "视频剪辑"): 0.35,
    ("三维动效", "视觉设计"): 0.40,
    ("三维动效", "视频剪辑"): 0.30,
    ("内容运营", "AI应用"): 0.20,
    ("前端开发", "AI应用"): 0.30,
}

SAME_CAT = 0.55      # 同类别但不是同一个词
EXACT = 1.0


def _norm(word: str) -> str:
    return (word or "").strip().lower()


def category_of(skill: str) -> str:
    s = _norm(skill)
    for cat, words in SKILL_DICT.items():
        for w in words:
            if _norm(w) == s or s in [_norm(a) for a in ALIAS.get(w, [])]:
                return cat
    return ""


def hits(text: str) -> dict[str, list[str]]:
    """返回 {能力类别: [命中的技能词]}。"""
    low = (text or "").lower()
    out: dict[str, list[str]] = {}
    for cat, words in SKILL_DICT.items():
        matched = [w for w in words if w.lower() in low]
        if matched:
            out[cat] = matched
    return out


def coverage(requirement: str, text: str, cat_hits: dict[str, list[str]] | None = None) -> float:
    """某个岗位要求被满足的程度：1.0 完全具备，0 完全没有。"""
    req = _norm(requirement)
    low = (text or "").lower()
    hits_ = cat_hits if cat_hits is not None else hits(text)

    # 1) 原词命中
    if req in low:
        return EXACT
    # 2) 别名命中
    for canonical, aliases in ALIAS.items():
        group = [_norm(canonical)] + [_norm(a) for a in aliases]
        if req in group and any(g in low for g in group):
            return EXACT

    req_cat = category_of(requirement)
    if not req_cat:
        return 0.0
    # 3) 同类别有命中
    if hits_.get(req_cat):
        return SAME_CAT
    # 4) 相邻类别有命中
    best = 0.0
    for (a, b), w in CAT_LINK.items():
        if req_cat == a and hits_.get(b):
            best = max(best, w)
        elif req_cat == b and hits_.get(a):
            best = max(best, w)
    return best


def explain(requirement: str, text: str) -> str:
    """给匹配结果一句人话解释。"""
    score = coverage(requirement, text)
    if score >= 1.0:
        return f"「{requirement}」已具备"
    if score >= 0.5:
        return f"「{requirement}」可从现有作品延伸（半具备）"
    if score > 0:
        return f"「{requirement}」能力可迁移，但需要补作品证明"
    return f"「{requirement}」目前没有证据"
