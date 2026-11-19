"""简历解析与体检：把一段自由文本简历，拆成可评分的结构。"""
import re

# 技能词典：岗位能力标签 -> 关键词（命中即认为具备该类能力）
SKILL_DICT: dict[str, list[str]] = {
    "视觉设计": ["ps", "photoshop", "illustrator", "ai", "ai作图", "figma", "版式",
                "海报", "vi", "文创", "配色", "字体", "排版", "手绘"],
    "视频剪辑": ["剪映", "pr", "premiere", "ae", "after effects", "达芬奇",
                "剪辑", "转场", "调色", "短视频", "分镜"],
    "三维动效": ["3ds max", "3dmax", "c4d", "blender", "maya", "ue5", "建模", "渲染", "动效"],
    "前端开发": ["html", "css", "javascript", "js", "vue", "react", "h5",
                "hBuilder", "网页", "小程序", "前端"],
    "内容运营": ["新媒体", "公众号", "小红书", "抖音", "文案", "策划", "运营",
                "选题", "热点", "数据复盘"],
    "AI应用": ["python", "大模型", "agent", "智能体", "提示词", "prompt",
               "rag", "数据标注", "微调", "ai工具"],
}

EDU_LEVELS = [
    ("博士", 4), ("硕士", 4), ("研究生", 4),
    ("本科", 3), ("学士", 3),
    ("大专", 2), ("专科", 2), ("高职", 2),
    ("中专", 1), ("高中", 1),
]

CERT_WORDS = ["四级", "六级", "cet", "普通话", "职业资格", "教师资格",
              "计算机等级", "驾照", "证书", "认证"]


def _hit(text: str, words: list[str]) -> list[str]:
    low = text.lower()
    return [w for w in words if w.lower() in low]


def analyze(text: str) -> dict:
    """核心分析：返回结构化结果（其它工具复用这个函数）。"""
    text = (text or "").strip()
    if len(text) < 20:
        return {"ok": False, "reason": "简历内容过短，请粘贴完整简历文本（不少于 20 字）。"}

    # 1. 学历
    edu_level, edu_word = 0, "未识别"
    for word, lv in EDU_LEVELS:
        if word in text and lv > edu_level:
            edu_level, edu_word = lv, word

    # 2. 技能
    skills = {cat: _hit(text, words) for cat, words in SKILL_DICT.items()}
    skills = {k: v for k, v in skills.items() if v}
    skill_count = sum(len(v) for v in skills.values())

    # 3. 项目 / 实习 / 证书
    project_count = len(re.findall(r"项目|作品|案例|实训|课题|文创|竞赛|大赛|毕设", text))
    intern_count = len(re.findall(r"实习|兼职|实践|岗位|工作|打工|上班|值班|保安|志愿者|助教", text))
    certs = _hit(text, CERT_WORDS)

    # 4. 量化表达（数字越多，简历越可信）
    numbers = len(re.findall(r"\d+", text))

    # 5. 评分：学历 20 / 技能 40 / 项目 20 / 经历 10 / 证书 10
    s_edu = {4: 20, 3: 18, 2: 14, 1: 8, 0: 5}[edu_level]
    s_skill = min(40, skill_count * 5)
    s_proj = min(20, project_count * 4)
    s_exp = min(10, intern_count * 3)
    s_cert = min(10, len(certs) * 4)
    total = s_edu + s_skill + s_proj + s_exp + s_cert

    gaps: list[str] = []
    if edu_level <= 2:
        gaps.append("学历为大专/高职：可考虑升本，或在简历中用作品集抵学历劣势")
    if skill_count < 6:
        gaps.append(f"技能关键词仅 {skill_count} 个，建议补充具体工具名与熟练度")
    if project_count == 0:
        gaps.append("缺少项目经历：至少补 1 个项目，写清『做了什么 + 用了什么 + 结果如何』")
    if intern_count == 0:
        gaps.append("缺少实习/实践经历：校内实训、兼职、接单都可以写")
    if numbers < 3:
        gaps.append("几乎没有量化数据：把『做了海报』改成『做了 20 张海报，涨粉 300』")
    if not certs:
        gaps.append("无证书信息：英语四级、普通话、职业技能等级证书都是加分项")

    return {
        "ok": True,
        "edu": edu_word,
        "edu_level": edu_level,
        "skills": skills,
        "skill_count": skill_count,
        "project_hits": project_count,
        "intern_hits": intern_count,
        "certs": certs,
        "number_hits": numbers,
        "scores": {"学历": s_edu, "技能": s_skill, "项目": s_proj, "经历": s_exp, "证书": s_cert},
        "total": total,
        "gaps": gaps,
    }


def analyze_resume(resume_text: str) -> str:
    """工具入口：简历体检。resume_text 为简历全文。"""
    r = analyze(resume_text)
    if not r["ok"]:
        return r["reason"]

    lines = [f"【简历体检报告】综合得分 {r['total']}/100"]
    lines.append(
        "分项：" + "、".join(f"{k} {v}" for k, v in r["scores"].items())
    )
    lines.append(f"识别学历：{r['edu']}")
    lines.append(
        "命中技能：" + "；".join(f"{k}({'/'.join(v)})" for k, v in r["skills"].items())
    )
    lines.append(f"量化数据出现 {r['number_hits']} 处，证书 {len(r['certs'])} 项")
    lines.append("")
    if r["gaps"]:
        lines.append("待改进（按优先级）：")
        lines += [f"{i}. {g}" for i, g in enumerate(r["gaps"], 1)]
    else:
        lines.append("结构较完整，可直接投递；下一步重点打磨项目描述与面试表达。")
    return "\n".join(lines)
