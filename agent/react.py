"""CareerAgent：ReAct 主循环 + 无 Key 时的规则路由（双引擎降级）。

v2 变化：
1. 会话档案（Profile）贯穿多轮，缺信息就追问，不用用户重复说；
2. 规则路由支持"岗位推荐"，不知道投什么也能给答案；
3. 每次回答附带档案卡与下一步建议，让对话能自己往前走。
"""
import json
import re

from tools import build_registry, list_jobs
from tools.career import _is_upgrade
from tools.resume import SKILL_DICT

from .llm import LLM
from .memory import Memory
from .profile import JOB_TITLES, Profile
from .prompts import build_system_prompt

MAX_STEPS = 4

_RESET_WORDS = ["清空档案", "重置档案", "忘掉我的信息", "重新开始"]


class CareerAgent:
    def __init__(self) -> None:
        self.llm = LLM()
        self.registry = build_registry()
        self.memory = Memory()
        self.profile = Profile()

    # ---------------------------------------------------------------- 对外接口
    def run(self, question: str, history: list[dict] | None = None) -> dict:
        q = (question or "").strip()
        if not q:
            return {"answer": "说说你的情况吧：简历、目标岗位、或者你卡在哪一步。",
                    "steps": [], "mode": "empty", "engine": self.llm.mode_name,
                    "profile": self.profile.to_dict()}

        if any(w in q for w in _RESET_WORDS):
            self.profile = Profile()
            self.memory = Memory()
            return {"answer": "档案已清空，重新告诉我学历、技能和目标岗位就行。",
                    "steps": [], "mode": "rule", "engine": self.llm.mode_name,
                    "profile": self.profile.to_dict()}

        self.profile.merge(q)

        if self.llm.available:
            answer, steps, ok = self._llm_loop(q, history)
            mode = "llm"
            if not ok:                       # 大模型失败 → 降级到规则引擎，保证有结果
                answer, steps = self._rule_loop(q)
                mode = "rule_fallback"
        else:
            answer, steps = self._rule_loop(q)
            mode = "rule"

        self.memory.add(q, answer)
        return {
            "answer": answer,
            "steps": steps,
            "mode": mode,
            "llm_available": self.llm.available,
            "engine": self.llm.mode_name,
            "profile": self.profile.to_dict(),
        }

    # -------------------------------------------------------------- LLM 引擎
    def _llm_loop(self, question: str, history: list[dict] | None) -> tuple[str, list, bool]:
        system = build_system_prompt(self.registry.schema(), MAX_STEPS)
        system += "\n\n【用户已知信息】\n" + self.profile.summary()
        messages = [{"role": "system", "content": system}]
        messages += history if history else self.memory.as_messages(2)
        messages.append({"role": "user", "content": question})

        steps = []
        scratch = []
        for i in range(MAX_STEPS):
            payload = question if i == 0 else (
                question + "\n\n以下是已执行的工具与结果：\n" + "\n".join(scratch)
                + "\n请基于以上结果继续，或直接给出 final。"
            )
            messages[-1] = {"role": "user", "content": payload}
            raw = self.llm.chat(messages)
            if raw.startswith("__LLM_ERROR__"):
                return self._rule_loop(question)[0], [], False

            data = _parse_json(raw)
            if not data:
                return raw, steps, True

            if "final" in data:
                return str(data["final"]).strip(), steps, True

            name = data.get("action", "")
            args = data.get("action_input") or {}
            if not isinstance(args, dict):
                args = {}
            observation = self.registry.run(name, args)
            steps.append({
                "thought": data.get("thought", ""),
                "action": name,
                "input": args,
                "observation": observation,
            })
            scratch.append(
                f"[第{i + 1}步] 工具 {name} 输入 {json.dumps(args, ensure_ascii=False)}\n结果：\n{observation}"
            )

        if steps:
            return steps[-1]["observation"], steps, True
        return "我没能组织出有效结论，可以把简历或问题再具体一点。", steps, True

    # -------------------------------------------------------------- 规则引擎
    def _rule_loop(self, q: str) -> tuple[str, list]:
        plan = _route(q, self.profile)
        steps, outputs = [], []
        for action, args in plan:
            observation = self.registry.run(action, args)
            steps.append({"thought": _route_reason(action), "action": action,
                          "input": args, "observation": observation})
            outputs.append(observation)

        if not plan:
            return _HELP_TEXT + "\n\n" + self.profile.summary(), steps

        body = "\n\n".join(outputs)
        tail = "\n\n" + _advice_block(self.profile)
        tail += ("\n\n（规则引擎模式：未配置大模型 API Key，工具调用由内置意图识别完成；"
                 "配置 .env 后切大模型自主决策。）")
        return body + tail, steps


# ------------------------------------------------------------------ 规则路由
def _route(q: str, p: Profile) -> list[tuple[str, dict]]:
    """返回一条或多条工具调用，支持"先体检再匹配"的链式调用。"""
    low = q.lower()
    resume_text = _compose(p, q)

    # 0) 生成简历（要排在"简历体检"前面，避免"帮我写简历"被当成评估）
    wants_build = (
        any(w in q for w in ["生成简历", "写简历", "做简历", "简历生成", "改简历", "弄份简历", "起草简历"])
        or ("简历" in q and any(w in q for w in ["生成", "写", "做一份", "弄一份", "来一份", "起草", "改"]))
    ) and not any(w in q for w in ["要不要", "该不该", "需不需要", "有没有必要", "怎么问", "怎么写"])
    if wants_build:
        return [("build_resume", {
            "name": p.name,
            "edu": p.edu,
            "skills": p.skills or q,
            "experience": p.projects or _extract_experience(q),
            "target_job": p.target_job,
            "contact": p.contact,
            "certs": p.certs,
        })]

    # 1) 面试回答点评
    if any(w in q for w in ["点评", "这么答", "我的答案", "帮我看看答得"]) and "面试" in q:
        answer = q.split("回答", 1)[1].lstrip("：: ") if "回答" in q else q
        return [("evaluate_answer", {"question": "（用户自述的面试题）", "answer": answer})]

    # 2) 模拟面试（要排在简历分支前，否则"面试会问什么"会被当成匹配请求）
    if "面试" in q:
        return [("interview_question", {"role": p.target_job or _match_job_title(q) or q,
                                        "index": _first_int(q, 0)})]

    # 3) 不知道投什么 → 岗位推荐
    if any(w in q for w in ["投什么", "推荐岗位", "适合什么", "什么岗位适合", "什么工作适合",
                             "哪个岗位好", "帮我选岗位", "能投什么", "适合干啥"]):
        return [("rank_jobs", {"resume_text": resume_text or q, "top": 3})]

    # 4) 简历体检 / 岗位匹配
    has_resume_intent = any(w in q for w in ["简历", "评估", "体检", "打分", "水平怎么样"])
    job = p.target_job or _match_job_title(q)
    wants_match = any(w in q for w in ["匹配", "差什么", "能投", "能不能投", "岗位"])

    if job and has_resume_intent:
        return [
            ("analyze_resume", {"resume_text": resume_text}),
            ("match_job", {"resume_text": resume_text, "job_title": job}),
        ]
    if has_resume_intent:
        return [("analyze_resume", {"resume_text": resume_text})]
    if job and wants_match:
        return [("match_job", {"resume_text": resume_text, "job_title": job})]
    if job and _has_skill(q):
        return [("match_job", {"resume_text": resume_text, "job_title": job})]
    if any(w in q for w in ["计划", "规划", "怎么准备", "怎么学", "路线",
                             "准备好", "准备就业", "几周", "周内", "时间表"]):
        return [("career_plan", {
            "goal": "升本" if _is_upgrade(q) else "就业",
            "major": _guess_major(q),
            "hours_per_week": _first_int(q, 10),
            "weeks": 8,
        })]
    return []


def _compose(p: Profile, q: str) -> str:
    """把档案和这句话拼成一份"简历文本"，工具拿去分析。"""
    parts = [p.name, p.edu, p.skills, p.projects, p.certs, q]
    return "\n".join(x for x in parts if x)


def _advice_block(p: Profile) -> str:
    """档案卡 + 下一步建议：让用户知道现在走到哪、还能问什么。"""
    lines = ["【你的档案】" + p.summary()]
    nxt = []
    if not p.target_job:
        nxt.append("还没有目标岗位 —— 说一个岗位名（如“新媒体运营”），我就能算匹配度和缺口。")
    else:
        nxt.append(f"目标岗位已锁定：{p.target_job} —— 可以让我「出面试题」「排 8 周计划」或「导出一份 Word 简历」。")
    if not p.skills:
        nxt.append("技能还没填 —— 写具体工具名（PS、剪映、3ds Max），匹配度才算得准。")
    if p.skills and not p.projects:
        nxt.append("缺项目经历 —— 一句话写“做了什么 + 做出的结果”，比堆技能更有用。")
    if not p.edu:
        nxt.append("缺学历信息 —— 学校 + 层次（大专/本科），简历体检要按层次给建议。")
    lines.append("【下一步】")
    lines += [f"- {x}" for x in nxt[:3]]
    return "\n".join(lines)


def _match_job_title(q: str) -> str:
    """找出句子里出现的岗位名（优先最长匹配，避免"短视频"吃掉"短视频剪辑"）。"""
    hits = [t for t in JOB_TITLES if t in q]
    return max(hits, key=len) if hits else ""


def _has_skill(q: str) -> bool:
    low = q.lower()
    for words in SKILL_DICT.values():
        if any(w.lower() in low for w in words):
            return True
    return False


def _extract_experience(q: str) -> str:
    """从一句话里抽出经历片段（"做过 X 和 Y，想投 Z" → "X 和 Y"）。"""
    keys = ["做过", "负责过", "参与过", "实习", "实践", "作品"]
    pos = max((q.rfind(k) for k in keys), default=-1)
    if pos < 0:
        return ""
    seg = q[pos:]
    for cut in ["想投", "目标岗位", "求职意向", "英语四级", "英语六级", "四级", "六级", "备考"]:
        if cut in seg:
            seg = seg.split(cut)[0]
    return seg.rstrip("。，, ")


def _route_reason(action: str | None) -> str:
    return {
        "build_resume": "用户要生成简历，调用简历生成工具",
        "analyze_resume": "用户在咨询简历质量，调用简历体检工具",
        "match_job": "用户在问岗位匹配，调用岗位匹配工具",
        "rank_jobs": "用户不知道投什么，按匹配度推荐岗位",
        "interview_question": "用户在准备面试，调用面试出题工具",
        "evaluate_answer": "用户在评估自己的面试回答，调用 STAR 点评工具",
        "career_plan": "用户在问学习/求职规划，调用路径规划工具",
    }.get(action or "", "未识别到具体工具需求")


def _first_int(text: str, default: int) -> int:
    m = re.search(r"(\d+)\s*(?:小时|h|周|题)", text)
    return int(m.group(1)) if m else default


def _guess_major(q: str) -> str:
    for m in ["数字媒体", "数媒", "视觉传达", "计算机", "软件", "广告", "美术"]:
        if m in q:
            return m
    return "数字媒体"


def _parse_json(text: str) -> dict | None:
    if not text:
        return None
    t = text.strip()
    t = re.sub(r"^```(?:json)?|```$", "", t).strip()
    try:
        data = json.loads(t)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", t, re.S)
        if not m:
            return None
        try:
            data = json.loads(m.group(0))
            return data if isinstance(data, dict) else None
        except json.JSONDecodeError:
            return None


_HELP_TEXT = (
    "我是职途 CareerPilot，能帮你做六件事：\n"
    "1. 生成简历 —— 告诉我学历、技能、经历、目标岗位，我直接出简历草案（可导出 Word）\n"
    "2. 简历体检 —— 粘文字或传简历截图，我告诉你差在哪\n"
    "3. 岗位匹配 —— 按核心技能加权算匹配度，列出缺口和补救路径\n"
    "4. 岗位推荐 —— 不知道自己适合投什么，我按匹配度排序\n"
    "5. 模拟面试 —— 我出题、你回答、我按 STAR 点评\n"
    "6. 8 周规划 —— 升本或就业，说清每周能投入几小时\n\n"
    "当前岗位库（%d 个）：\n%s" % (len(JOB_TITLES), list_jobs())
)
