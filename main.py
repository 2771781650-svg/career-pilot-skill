"""命令行入口：python main.py　或　python main.py --demo（一键跑完四幕演示）"""
import random
import sys

try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:  # noqa: BLE001
    pass

from agent import CareerAgent

BANNER = """
+------------------------------------------+
|  职途 CareerPilot · AI 求职赋能智能体      |
|  输入问题开始对话，输入 exit 退出          |
|  python main.py --demo  一键看演示         |
+------------------------------------------+
"""

# 演示样例随机池：姓名 / 学校 / 专业 / 技能 / 项目 / 岗位每次组合不同，不写死身份
_DEMO_NAMES = ["李明", "王芳", "陈晨", "赵磊", "周婷", "孙悦"]
_DEMO_SCHOOLS = ["某某学院", "某职业技术学院", "某某职业学院", "某学院"]
_DEMO_MAJORS = ["数字媒体技术", "视觉传达设计", "广告设计与制作", "动漫制作技术"]
_DEMO_SKILLS = [["PS", "剪映", "3ds Max"], ["PS", "Illustrator", "排版"],
                 ["剪映", "PR", "分镜"], ["PS", "公众号", "文案"]]
_DEMO_PROJECTS = ["校园文创设计项目", "课程海报设计项目", "短视频剪辑实训项目", "公众号内容运营项目"]
_DEMO_JOBS = ["新媒体运营", "平面设计师", "短视频编导", "电商美工"]


def _random_demo():
    name = random.choice(_DEMO_NAMES)
    school = random.choice(_DEMO_SCHOOLS)
    major = random.choice(_DEMO_MAJORS)
    skills = random.choice(_DEMO_SKILLS)
    project = random.choice(_DEMO_PROJECTS)
    job = random.choice(_DEMO_JOBS)
    intro = (f"我叫{name}，{school} {major} 大专，会 {'、'.join(skills)}，"
             f"做过{project}，想投{job}")
    return [
        ("第一幕：说清自己的情况（档案自动记下来）", intro),
        ("第二幕：生成一份简历草案", "帮我生成一份简历"),
        ("第三幕：算匹配度，看差什么", f"我投{job}匹配度多少，还差什么"),
        ("第四幕：模拟面试", f"{job}面试会问什么？"),
    ]


DEMO = _random_demo()


def _print_result(result: dict) -> None:
    for i, s in enumerate(result.get("steps", []), 1):
        print(f"  [步骤 {i}] {s['action']}  输入={s['input']}")
    print("\n职途 > " + result["answer"] + "\n")


def run_demo() -> None:
    agent = CareerAgent()
    print("\n演示模式 · 引擎：" + agent.llm.mode_name + "\n")
    for title, q in DEMO:
        print("=" * 60)
        print(title)
        print("你 > " + q)
        _print_result(agent.run(q))
    print("=" * 60)
    print("演示结束。提示：档案会一直记着，你可以直接问“导出简历”或“排个 8 周计划”。")


def main() -> None:
    if "--demo" in sys.argv:
        run_demo()
        return
    agent = CareerAgent()
    print(BANNER)
    print(f"引擎：{agent.llm.mode_name}\n")
    while True:
        try:
            q = input("你 > ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n再见。")
            return
        if q.lower() in {"exit", "quit", "退出"}:
            print("再见。")
            return
        if not q:
            continue
        try:
            _print_result(agent.run(q))
        except Exception as e:  # noqa: BLE001
            print(f"\n[出错] {e}\n")


if __name__ == "__main__":
    main()
