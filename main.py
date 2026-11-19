"""命令行入口：python main.py　或　python main.py --demo（一键跑完四幕演示）"""
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

DEMO = [
    ("第一幕：说清自己的情况（档案自动记下来）",
     "我叫张明，河北能源职业技术学院 数字媒体技术 大专，会 PS、剪映、3ds Max，做过大境门文创项目，想投新媒体运营"),
    ("第二幕：生成一份简历草案",
     "帮我生成一份简历"),
    ("第三幕：算匹配度，看差什么",
     "我投新媒体运营匹配度多少，还差什么"),
    ("第四幕：模拟面试",
     "新媒体运营面试会问什么？"),
]


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
