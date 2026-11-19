"""会话档案：把用户说过的信息记成结构化槽位，缺什么就追问什么。"""
import re
from dataclasses import asdict, dataclass, field

JOB_TITLES = ["新媒体运营", "短视频编导", "平面设计师", "电商美工",
              "前端开发工程师", "AI训练师", "数字媒体设计师", "UI设计助理",
              "内容运营助理", "短视频剪辑", "数据标注员", "直播运营",
              "文创产品设计", "视觉设计实习生"]

EDU_WORDS = ["博士", "硕士", "本科", "大专", "专科", "高职", "中专"]

SLOT_LABELS = {
    "name": "姓名",
    "edu": "学历/学校",
    "skills": "技能",
    "projects": "项目经历",
    "certs": "证书",
    "target_job": "目标岗位",
    "contact": "联系方式",
}


@dataclass
class Profile:
    name: str = ""
    edu: str = ""
    major: str = ""
    skills: str = ""
    projects: str = ""
    certs: str = ""
    target_job: str = ""
    contact: str = ""
    hours: str = ""

    # ---------------------------------------------------------------- 写入
    def merge(self, text: str) -> "Profile":
        """从一段话里抽取槽位，已有的非空值不被覆盖。"""
        for slot, value in extract(text).items():
            if value and not getattr(self, slot, ""):
                setattr(self, slot, value)
        return self

    # ---------------------------------------------------------------- 查询
    def filled(self) -> dict:
        return {k: v for k, v in asdict(self).items() if v}

    def missing(self) -> list[tuple[str, str]]:
        """返回 (槽位, 追问话术)，按补充优先级排序。"""
        ask = {
            "target_job": "你想投哪个岗位？这决定简历关键词和匹配度怎么算。",
            "skills": "会哪些工具？写具体名字（如 PS、剪映、3ds Max），别写“熟悉办公软件”。",
            "projects": "做过什么项目或实践？一句话说清“做了什么 + 结果”。",
            "edu": "什么学历、哪所学校、什么专业？",
            "certs": "有证书吗？四级、普通话、职业技能等级都算。",
            "name": "简历上署什么名字？",
        }
        order = ["target_job", "skills", "projects", "edu", "certs", "name"]
        return [(k, ask[k]) for k in order if not getattr(self, k, "")]

    def summary(self) -> str:
        if not self.filled():
            return "档案为空，先说一句你的学历、技能和目标岗位。"
        parts = []
        for k, label in SLOT_LABELS.items():
            v = getattr(self, k, "")
            if v:
                parts.append(f"{label}：{v}")
        return "｜".join(parts)

    def to_dict(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------- 抽取规则
def extract(text: str) -> dict:
    t = (text or "").strip()
    if not t:
        return {}
    return {
        "name": _name(t),
        "edu": _edu(t),
        "major": _major(t),
        "skills": _skills(t),
        "projects": _projects(t),
        "certs": _certs(t),
        "target_job": _target_job(t),
        "contact": _contact(t),
        "hours": _hours(t),
    }


def _name(t: str) -> str:
    m = re.search(r"(?:我叫|姓名[:：]?|名字[:：]?)\s*([\u4e00-\u9fa5]{2,4})", t)
    return m.group(1) if m else ""


def _edu(t: str) -> str:
    m = re.search(r"([\u4e00-\u9fa5]{2,15}(?:大学|学院|职业技术学院))", t)
    level = next((w for w in EDU_WORDS if w in t), "")
    if m and level:
        return f"{m.group(1)}　{level}"
    return m.group(1) if m else level


def _major(t: str) -> str:
    for m in ["数字媒体技术", "数字媒体艺术", "数字媒体", "视觉传达", "广告学",
              "计算机", "软件技术", "环境设计", "美术"]:
        if m in t:
            return m
    return ""


def _skills(t: str) -> str:
    from tools.resume import SKILL_DICT
    low = t.lower()
    hits: list[str] = []
    for words in SKILL_DICT.values():
        for w in words:
            if w.lower() in low and w not in hits:
                hits.append(w)
    return "、".join(hits)


def _projects(t: str) -> str:
    keys = ["做过", "负责过", "参与过", "实习", "实践", "作品"]
    pos = max((t.rfind(k) for k in keys), default=-1)
    if pos < 0:
        return ""
    seg = t[pos:]
    for cut in ["想投", "目标岗位", "求职意向", "英语四级", "四级", "六级", "备考"]:
        if cut in seg:
            seg = seg.split(cut)[0]
    seg = re.sub(r"^(做过|负责过|参与过|实习|实践|作品[:：]?)", "", seg).strip(" ：:，,")
    return seg.rstrip("。，, ")


def _certs(t: str) -> str:
    words = ["英语四级", "英语六级", "四级", "六级", "普通话", "计算机等级",
             "教师资格", "职业资格", "职业技能等级"]
    hits = [w for w in words if w in t]
    hits.sort(key=len, reverse=True)
    kept: list[str] = []
    for h in hits:
        if not any(h in k for k in kept):
            kept.append(h)
    return "、".join(kept)


def _target_job(t: str) -> str:
    for job in JOB_TITLES:
        if job in t:
            return job
    return ""


def _contact(t: str) -> str:
    m = re.search(r"(1[3-9]\d{9})", t)
    if m:
        return m.group(1)
    m = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", t)
    return m.group(0) if m else ""


def _hours(t: str) -> str:
    m = re.search(r"(\d+)\s*(?:小时|h|H)", t)
    return m.group(1) if m else ""
