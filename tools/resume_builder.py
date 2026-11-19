"""简历生成：根据零散信息，按目标岗位产出一份可直接改的简历草案。"""
import json
import os
import re

from .resume import SKILL_DICT

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")


def _load_jobs() -> list[dict]:
    path = os.path.join(DATA_DIR, "jobs.jsonl")
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def _pick_job(target: str) -> dict | None:
    if not target:
        return None
    for job in _load_jobs():
        if job["title"] in target or target in job["title"]:
            return job
    return None


def _parse_skills(raw: str) -> dict[str, list[str]]:
    """把 '会 PS、剪映、3ds Max' 这类输入按能力类别归好。"""
    low = (raw or "").lower()
    grouped: dict[str, list[str]] = {}
    for cat, words in SKILL_DICT.items():
        hits = [w for w in words if w.lower() in low]
        if hits:
            grouped[cat] = hits
    return grouped


def _split_items(raw: str) -> list[str]:
    """经历按分隔符拆成条目，去掉空项和指令性噪音。"""
    parts = re.split(r"[、；;\n。]+", raw or "")
    noise = ("简历", "我叫", "生成", "帮我", "想投", "求职意向", "姓名")
    items = []
    for p in parts:
        p = p.strip(" ，,")
        if not p or any(n in p for n in noise):
            continue
        # 去掉残留的引导词
        p = re.sub(r"^(做过|负责过|参与过|参与|负责|实习|实践|作品[:：]?)", "", p).strip(" ，,：:")
        if len(p) >= 2:
            items.append(p)
    return items


def _starize(item: str) -> str:
    """把一句流水账经历补成 STAR 骨架。"""
    has_num = bool(re.search(r"\d", item))
    tail = "（结果待补：数量/涨粉/交付量/上线时间）" if not has_num else ""
    return f"- {item}{tail}"


def build_resume(name: str = "", edu: str = "", skills: str = "", experience: str = "",
                 target_job: str = "", contact: str = "", certs: str = "") -> str:
    """工具入口：生成简历草案。字段缺什么就留占位符，用户后续补。"""
    job = _pick_job(target_job)
    grouped = _parse_skills(skills)
    exp_items = _split_items(experience)

    lines = ["【简历草案】可直接复制到 Word / 超级简历后微调", ""]
    lines.append(f"{name or '【姓名】'}｜{edu or '【学历/学校/专业】'}｜求职意向：{target_job or '【目标岗位】'}")
    lines.append(f"联系方式：{contact or '【电话 / 邮箱 / 作品集链接】'}")
    lines.append("")

    lines.append("■ 核心技能")
    if grouped:
        for cat, words in grouped.items():
            lines.append(f"- {cat}：{'、'.join(w.upper() if len(w) <= 4 else w for w in words)}")
    else:
        lines.append("- 【按目标岗位补 4-6 个具体工具名，写熟练度：熟练 / 掌握 / 了解】")
    lines.append("")

    lines.append("■ 项目/实践经历（按 STAR 写，每段 2-3 行）")
    if exp_items:
        for item in exp_items[:5]:
            lines.append(_starize(item))
    else:
        lines.append("- 【项目名】：情境（什么背景）→ 任务（你负责什么）→ 行动（怎么做）→ 结果（带数字）")
    lines.append("")

    lines.append("■ 教育背景")
    lines.append(f"- {edu or '【学校 / 专业 / 起止时间 / 主修课程】'}")
    lines.append("")

    lines.append("■ 证书与荣誉")
    lines.append(f"- {certs or '【英语四级 / 普通话 / 职业技能等级证书 / 竞赛奖项】'}")
    lines.append("")

    if job:
        lines.append("■ 关键词投放（HR 系统按这些词搜人，务必出现在简历里）")
        lines.append("- 硬性：" + "、".join(job["must"]))
        lines.append("- 加分：" + "、".join(job["plus"]))
        lines.append(f"- 该岗位投递要点：{job['advice']}")
        lines.append("")
    else:
        lines.append("■ 关键词投放")
        lines.append("- 【告诉我目标岗位，我把该岗位的硬性关键词列给你，提高初筛通过率】")
        lines.append("")

    lines.append("■ 还差的材料（补齐后再投）")
    todo = []
    if not contact:
        todo.append("联系方式与作品集链接")
    if not exp_items:
        todo.append("至少 1 段可讲清流程的项目经历")
    if len(grouped) < 2:
        todo.append("技能分类太单薄，按目标岗位补 2 类能力")
    if not certs:
        todo.append("证书栏（没有就写正在备考的项目，如英语四级备考中）")
    if not job:
        todo.append("明确目标岗位，否则关键词无法投放")
    lines += [f"{i}. {t}" for i, t in enumerate(todo, 1)] if todo else ["- 暂无，可直接投递"]
    lines.append("")
    lines.append("写作提醒：每条经历控制在一行半以内，动词开头，结果带数字，不要写“熟悉办公软件”。")
    return "\n".join(lines)
