"""离线评测：python scripts/evaluate.py

用 12 条带标注的样例跑规则引擎，统计两件事：
1. 意图路由准确率（该调哪个工具）
2. 岗位推荐 Top-1 命中率
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent import CareerAgent
from agent.react import _route
from agent.profile import Profile
from tools.job_match import rank_jobs

# (用户话术, 期望首个工具)
CASES = [
    ("我叫张明，大专数媒，会 PS 和剪映，想投新媒体运营", "match_job"),
    ("帮我生成一份简历", "build_resume"),
    ("我这份简历能打几分", "analyze_resume"),
    ("我投平面设计师还差什么", "match_job"),
    ("我什么岗位都能投，帮我看看适合什么", "rank_jobs"),
    ("新媒体运营面试会问什么", "interview_question"),
    ("这是我面试的回答：我负责排期……帮我点评", "evaluate_answer"),
    ("我想在 8 周内准备好就业，每周 12 小时", "career_plan"),
    ("我目标是升本，帮我排计划", "career_plan"),
    ("我会剪映，想投短视频剪辑", "match_job"),
    ("简历里要不要写证书", "analyze_resume"),
    ("帮我改简历，投 UI设计助理", "build_resume"),
]


def route_accuracy() -> tuple[int, int, list[str]]:
    ok, detail = 0, []
    for text, expect in CASES:
        p = Profile().merge(text)
        plan = _route(text, p)
        got = plan[0][0] if plan else "(未识别)"
        if got == expect or (expect in ("match_job", "analyze_resume") and got in ("match_job", "analyze_resume")):
            ok += 1
        else:
            # build_resume 与改简历、面试点评这类近似意图按严格标准算错
            detail.append(f"  ✗ {text[:18]}…  期望 {expect}  实际 {got}")
    return ok, len(CASES), detail


def rank_top1() -> tuple[int, int, list[str]]:
    samples = [
        ("我是大专数媒专业，会文案、新媒体运营、公众号，做过 8 篇推文，也会剪映", "新媒体运营"),
        ("我会 HTML、CSS、JavaScript，做过两个网页项目", "前端开发工程师"),
        ("我是数媒专业，会剪映、PR，会调色和分镜，做过 3 支短片", "短视频剪辑"),
    ]
    ok, detail = 0, []
    for text, expect in samples:
        out = rank_jobs(text, top=1)
        first = out.split("\n")[1] if "\n" in out else out
        hit = expect in first
        ok += 1 if hit else 0
        if not hit:
            detail.append(f"  ✗ {text[:16]}…  期望 {expect}  实际 {first.strip()}")
    return ok, len(samples), detail


def main() -> None:
    a, n, d1 = route_accuracy()
    b, m, d2 = rank_top1()
    print("== 意图路由 ==")
    print(f"准确率：{a}/{n} = {a / n:.0%}")
    print("\n".join(d1))
    print("\n== 岗位推荐 Top-1 ==")
    print(f"命中率：{b}/{m} = {b / m:.0%}")
    print("\n".join(d2))
    print("\n（样例为人工标注的小集，用于回归而非指标宣传。）")


if __name__ == "__main__":
    main()
