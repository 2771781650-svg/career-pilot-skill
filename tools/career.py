"""职业路径规划：按目标 + 每周可投入时间，生成 8 周可执行计划。"""

TRACK_UP = {  # 升本方向
    "计算机类": ["英语", "高数", "专业课（数据结构/数字媒体基础）", "真题套卷"],
    "设计类": ["英语", "设计基础理论", "手绘/作品集", "真题套卷"],
}
TRACK_JOB = {  # 就业方向
    "新媒体": ["账号定位与选题", "文案与脚本", "剪辑与封面", "数据复盘", "作品集包装"],
    "设计": ["软件基本功", "版式与配色", "成套作品集", "需求转译练习", "接单实战"],
    "技术": ["语言基础", "项目实战", "Git 与部署", "简历项目包装", "八股与算法"],
}


UP_WORDS = ["升本", "专升本", "考研", "升学"]


def _is_upgrade(goal: str) -> bool:
    """判断目标偏向升学还是就业。若两个词同时出现，以先说的那个为准。"""
    g = (goal or "").strip()
    if not any(w in g for w in UP_WORDS):
        return False
    idx_up = min([g.find(w) for w in UP_WORDS if g.find(w) >= 0], default=-1)
    idx_job = g.find("就业")
    if idx_job == -1:
        return True
    return idx_up < idx_job


def career_plan(goal: str = "就业", major: str = "数字媒体", hours_per_week: int = 10,
                weeks: int = 8) -> str:
    """工具入口：生成周计划。goal 取 升本/就业；hours_per_week 为每周可投入小时。"""
    goal_clean = goal.strip()
    up = _is_upgrade(goal_clean)
    hours = max(4, min(int(hours_per_week or 10), 60))

    if up:
        track = TRACK_UP["计算机类" if any(w in major for w in ["计算机", "软件", "数字媒体", "数媒"]) else "设计类"]
        title = "升本路线（8 周冲刺）"
    else:
        key = "新媒体" if any(w in major for w in ["媒体", "传播", "数媒", "广告"]) else (
            "设计" if any(w in major for w in ["设计", "美术", "视觉"]) else "技术")
        track = TRACK_JOB[key]
        title = f"就业路线（{key}方向，8 周）"

    # 分配：主线占 60%，作品/刷题占 30%，复盘占 10%
    main_h = round(hours * 0.6, 1)
    work_h = round(hours * 0.3, 1)
    review_h = round(hours * 0.1, 1)

    lines = [f"【{title}】每周 {hours} 小时 · 共 {weeks} 周", ""]
    for w in range(1, weeks + 1):
        if w >= weeks - 1:
            item = "投递与面试冲刺（改简历 + 模拟面试 + 作品集收口）"
            phase = "冲刺"
        else:
            item = track[(w - 1) % len(track)]
            phase = "打基础" if w <= 2 else "做产出"
        lines.append(f"第 {w} 周｜{phase}｜主线：{item}")
        lines.append(f"　· 主线学习 {main_h}h：{item} 的系统输入 + 笔记")
        lines.append(
            f"　· 产出 {work_h}h：" + ("1 套作品/1 套卷子" if not up else "1 套真题 + 错题本")
        )
        lines.append(f"　· 复盘 {review_h}h：记录卡点，下周只补最大的那个洞")
    lines += [
        "",
        "执行原则：",
        "1. 每天固定时段，宁可 40 分钟不断，也别周末补 8 小时",
        "2. 每两周产出一个可交付物（作品 / 卷子 / 项目），没有产出的学习不算学习",
        f"3. 第 {weeks} 周只做两件事：投递或模考，以及把作品集/错题本收口",
    ]
    return "\n".join(lines)
