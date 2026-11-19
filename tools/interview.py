"""模拟面试：出题 + 按 STAR 结构给分。"""
import json
import os

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")


def _load() -> dict:
    with open(os.path.join(DATA_DIR, "questions.json"), encoding="utf-8") as f:
        return json.load(f)


def _pick_role(role: str, bank: dict) -> str:
    if not role:
        return "通用"
    for key in bank:
        if key != "通用" and (key in role or role in key):
            return key
    return "通用"


def interview_question(role: str = "通用", index: int = 0) -> str:
    """工具入口：按岗位出面试题。role 为岗位名，index 从 0 开始。"""
    bank = _load()
    key = _pick_role(role, bank)
    items = bank[key]
    q = items[index % len(items)]
    return (
        f"【模拟面试 · {key}】第 {index + 1} 题（考察：{q['focus']}）\n"
        f"问题：{q['q']}\n"
        f"提示：回答用 STAR 结构 —— 情境(Situation)、任务(Task)、行动(Action)、结果(Result)。"
    )


STAR_WORDS = {
    "S 情境": ["当时", "背景", "我在", "期间", "那会儿", "项目里"],
    "T 任务": ["负责", "目标", "需要", "要求", "任务", "要解决"],
    "A 行动": ["于是", "我先", "然后", "通过", "用了", "做了", "尝试", "协调"],
    "R 结果": ["结果", "最终", "提升", "下降", "完成", "拿到", "上线", "涨了"],
}

QUANT_WORDS = ["%", "倍", "元", "万", "千", "个", "篇", "条", "天", "人"]


def evaluate_answer(question: str = "", answer: str = "") -> str:
    """工具入口：按 STAR 结构给面试回答打分。"""
    text = (answer or "").strip()
    if len(text) < 15:
        return "回答过短（少于 15 字），先按『背景-任务-我做了什么-结果如何』说完整。"

    parts = {k: any(w in text for w in v) for k, v in STAR_WORDS.items()}
    covered = sum(parts.values())
    has_num = any(w in text for w in QUANT_WORDS) or any(ch.isdigit() for ch in text)
    length_ok = 80 <= len(text) <= 400

    score = covered * 18 + (10 if has_num else 0) + (10 if length_ok else 0)
    score = min(100, score)

    lines = [f"【面试回答点评】STAR 得分 {score}/100（题目：{question or '未提供'}）"]
    lines.append("结构覆盖：" + "、".join(f"{k} {'✓' if v else '✗'}" for k, v in parts.items()))
    lines.append(f"量化结果：{'有' if has_num else '无'}")
    lines.append(f"篇幅：{'合适' if length_ok else ('偏短，展开细节' if len(text) < 80 else '偏长，压缩到 2 分钟内')}")

    advice = []
    for k, v in parts.items():
        if not v:
            advice.append({
                "S 情境": "补一句背景：什么时间、什么场景、规模多大",
                "T 任务": "说清你的目标和你承担的那部分，别只说团队",
                "A 行动": "用动词讲你具体做了什么，突出只有你做的部分",
                "R 结果": "给一个可量化的结果：涨了多少、省了多少、上线了没",
            }[k])
    if not has_num:
        advice.append("结果一定要带数字，哪怕是自己估的（如 20 张海报、3 天完成）")
    if score >= 80:
        lines.append("评价：结构完整，可以直接用于真实面试。")
    elif score >= 55:
        lines.append("评价：骨架有了，把缺的部分补上就能明显提分。")
    else:
        lines.append("评价：目前更像流水账，重写一遍，按 STAR 四段各一句。")
    if advice:
        lines.append("改进建议：")
        lines += [f"{i}. {a}" for i, a in enumerate(advice, 1)]
    return "\n".join(lines)
