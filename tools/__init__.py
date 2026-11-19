"""工具装配：把所有能力注册进智能体。"""
from .base import Tool, ToolRegistry
from .resume import analyze_resume
from .resume_builder import build_resume
from .job_match import match_job, list_jobs, rank_jobs
from .interview import interview_question, evaluate_answer
from .career import career_plan


def build_registry() -> ToolRegistry:
    reg = ToolRegistry()

    reg.register(Tool(
        name="build_resume",
        description="生成简历：根据姓名/学历/技能/经历/目标岗位，按 STAR 结构产出一份可编辑的简历草案，并给出该岗位关键词。",
        parameters={
            "name": "姓名", "edu": "学历/学校/专业", "skills": "会的技能，逗号分隔",
            "experience": "项目或实践经历，分号分隔", "target_job": "目标岗位",
            "contact": "联系方式", "certs": "证书与荣誉",
        },
        func=build_resume,
    ))

    reg.register(Tool(
        name="analyze_resume",
        description="简历体检：给简历打分，找出学历/技能/项目/经历/证书五方面缺口。当用户粘贴简历或要求评估简历时使用。",
        parameters={"resume_text": "简历全文（字符串）"},
        func=analyze_resume,
    ))

    reg.register(Tool(
        name="match_job",
        description="岗位匹配：把简历和岗位库中某个岗位对比，按核心技能加权算匹配度并列出缺口。job_title 为空时返回岗位清单。",
        parameters={"resume_text": "简历全文", "job_title": "岗位名称，如 新媒体运营"},
        func=match_job,
    ))

    reg.register(Tool(
        name="rank_jobs",
        description="岗位推荐：用户不知道投什么时，按匹配度给全部岗位排序，返回前 3 个。",
        parameters={"resume_text": "简历全文", "top": "返回个数，默认 3"},
        func=rank_jobs,
    ))

    reg.register(Tool(
        name="interview_question",
        description="模拟面试出题：按岗位返回一道真实面试题，index 是题目序号（从 0 开始）。",
        parameters={"role": "岗位名，如 新媒体运营", "index": "整数序号，默认 0"},
        func=interview_question,
    ))

    reg.register(Tool(
        name="evaluate_answer",
        description="面试回答点评：按 STAR 结构给回答打分并给出改进建议。",
        parameters={"question": "面试题目", "answer": "用户的回答原文"},
        func=evaluate_answer,
    ))

    reg.register(Tool(
        name="career_plan",
        description="职业路径规划：按目标（升本/就业）、专业和每周可投入小时，生成 8 周执行计划。",
        parameters={"goal": "升本 或 就业", "major": "专业名", "hours_per_week": "每周小时数", "weeks": "周数，默认 8"},
        func=career_plan,
    ))

    return reg


__all__ = ["Tool", "ToolRegistry", "build_registry", "list_jobs"]
