"""岗位匹配：用技能图谱算加权覆盖率，并给缺口补法。"""
import json
import os

from .resume import SKILL_DICT, _hit, analyze
from .skills_graph import coverage, explain, hits

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
CORE_WEIGHT = 1.5


def _load_jobs() -> list[dict]:
    path = os.path.join(DATA_DIR, "jobs.jsonl")
    jobs = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                jobs.append(json.loads(line))
    return jobs


def _find_job(keyword: str) -> dict | None:
    jobs = _load_jobs()
    if not keyword:
        return None
    kw = keyword.strip().lower()
    for job in jobs:
        if kw == job["title"].lower():
            return job
    for job in jobs:
        if kw in job["title"].lower() or job["title"].lower() in kw:
            return job
    hit = _hit(keyword, [j["title"] for j in jobs])
    if hit:
        for job in jobs:
            if job["title"] == hit[0]:
                return job
    return None


def list_jobs() -> str:
    jobs = _load_jobs()
    return "\n".join(f"- {j['title']}（{j['city']}，{j['salary']}）" for j in jobs)


def match_job(resume_text: str, job_title: str = "") -> str:
    """工具入口：简历 vs 岗位，输出加权匹配度与缺口。"""
    if not job_title:
        return "当前岗位库（共 %d 个）：\n%s\n请告诉我你想匹配哪一个。" % (
            len(_load_jobs()), list_jobs())

    job = _find_job(job_title)
    if job is None:
        return f"岗位库里没有『{job_title}』。当前可选：\n" + list_jobs()

    # 剥掉句子里的岗位名，避免"想投新媒体运营"里的"新媒体"被当成简历技能
    body = resume_text.replace(job["title"], " ")
    if job_title:
        body = body.replace(job_title, " ")

    r = analyze(body)
    if not r["ok"]:
        return r["reason"]

    low = body.lower()
    cat_hits = hits(body)
    for words in SKILL_DICT.values():          # 兜底：全文扫一遍
        for w in words:
            if w.lower() in low:
                cat = next((c for c, ws in SKILL_DICT.items() if w in ws), "")
                if cat and cat not in cat_hits:
                    cat_hits[cat] = [w]

    def score_of(req: str) -> float:
        return coverage(req, body, cat_hits)

    must = job["must"]
    core = set(job.get("core") or [])
    plus = job["plus"]

    total_w = sum(CORE_WEIGHT if m in core else 1.0 for m in must)
    got_w = sum((CORE_WEIGHT if m in core else 1.0) * score_of(m) for m in must)
    must_rate = got_w / total_w if total_w else 1.0

    plus_rate = sum(score_of(p) for p in plus) / len(plus) if plus else 0.0
    score = round(100 * (must_rate * 0.7 + plus_rate * 0.3))

    strong = [m for m in must if score_of(m) >= 1.0]
    half = [m for m in must if 0.5 <= score_of(m) < 1.0]
    gap = [m for m in must if score_of(m) < 0.5]
    plus_hit = [p for p in plus if score_of(p) >= 0.5]

    lines = [f"【岗位匹配】{job['title']}（{job['city']}，{job['salary']}）"]
    lines.append(f"加权匹配度：{score}/100（核心技能权重 {CORE_WEIGHT}x）")
    lines.append(f"完全具备：{'、'.join(strong) or '无'}")
    lines.append(f"半具备（可延伸）：{'、'.join(half) or '无'}")
    lines.append(f"明显缺口：{'、'.join(gap) or '无'}")
    lines.append(f"加分项命中：{'、'.join(plus_hit) or '无'}")
    verdict = (
        "可以直接投，重点是把已有经历写成该岗位的语言。" if score >= 75
        else "有基础，补 1-2 个缺口再投，通过率明显更高。" if score >= 50
        else "差距较大，建议先补核心技能，或改投相邻岗位。"
    )
    lines.append(f"结论：{verdict}")
    lines.append(f"投递要点：{job['advice']}")
    if gap:
        lines.append("补齐路径：")
        for g in gap[:3]:
            lines.append(f"- {explain(g, body)}；用 1 个小作品证明，写进简历项目栏")
    return "\n".join(lines)


def rank_jobs(resume_text: str, top: int = 3) -> str:
    """工具入口：不知道投什么时，按匹配度排出最合适的岗位。"""
    if len((resume_text or "").strip()) < 12:
        return "先告诉我 2-3 个技能（如 PS、剪映、文案），再加上学历，我才能给你排岗位。"
    jobs = _load_jobs()
    rows = []
    for job in jobs:
        body = resume_text.replace(job["title"], " ")
        r = analyze(body)
        if not r["ok"]:
            return r["reason"]
        ch = hits(body)
        must, core = job["must"], set(job.get("core") or [])
        tw = sum(CORE_WEIGHT if m in core else 1.0 for m in must)
        gw = sum((CORE_WEIGHT if m in core else 1.0) * coverage(m, body, ch) for m in must)
        mr = gw / tw if tw else 1
        pr = sum(coverage(p, body, ch) for p in job["plus"]) / len(job["plus"]) if job["plus"] else 0
        rows.append((round(100 * (mr * 0.7 + pr * 0.3)), job))

    rows.sort(key=lambda x: x[0], reverse=True)
    lines = [f"【岗位推荐】按匹配度排序，前 {top} 个最适合你"]
    for score, job in rows[:top]:
        lines.append(f"- {job['title']}（{job['city']}，{job['salary']}）匹配度 {score}")
    lines.append(f"下一步：选一个，用「{rows[0][1]['title']}」问我“差什么技能”，我给补齐清单。")
    return "\n".join(lines)
