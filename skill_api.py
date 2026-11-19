"""标准 Skill 调用入口。

对外提供三种可被智能体/平台直接调用的方式：

1. Python 调用
    from skill_api import invoke, schema, list_capabilities
    invoke("match_job", {"resume_text": "...", "job_title": "新媒体运营"})

2. 命令行（JSON 入参 / JSON 出参）
    python skill_api.py list
    python skill_api.py call match_job '{"resume_text":"...", "job_title":"新媒体运营"}'
    python skill_api.py run "我想投新媒体运营，差什么"

3. HTTP（复用 server.py）
    POST /api/skill/{tool_name}   body: {"args": {...}}
    POST /api/skill/run          body: {"question": "..."}

返回统一结构：
    {"ok": true, "capability": "...", "result": "..."}
    {"ok": false, "capability": "...", "error": "..."}
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agent import CareerAgent  # noqa: E402
from tools import build_registry  # noqa: E402

_REGISTRY = build_registry()
_AGENT = CareerAgent()


def list_capabilities() -> list[dict]:
    """返回本 Skill 暴露的全部子能力清单（名称 + 描述 + 参数）。"""
    return _REGISTRY.schema()


def schema() -> dict:
    """完整 Skill 元数据，供平台挂载时读取。"""
    meta_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "skill.json")
    with open(meta_path, encoding="utf-8") as f:
        return json.load(f)


def invoke(capability: str, args: dict | None = None) -> dict:
    """调用单个子能力。capability 必须是 list_capabilities 中的 name。"""
    args = args or {}
    if capability not in _REGISTRY.names():
        return {
            "ok": False,
            "capability": capability,
            "error": f"未知能力 {capability}，可用：{', '.join(_REGISTRY.names())}",
        }
    try:
        result = _REGISTRY.run(capability, args)
        return {"ok": True, "capability": capability, "result": result}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "capability": capability, "error": str(e)}


def run(question: str, history: list[dict] | None = None) -> dict:
    """自然语言入口：由智能体自行选择并串联子能力（双引擎：有 Key 走 ReAct，无 Key 走规则路由）。"""
    if not (question or "").strip():
        return {"ok": False, "error": "question 为空"}
    out = _AGENT.run(question, history)
    return {"ok": True, "engine": out.get("engine"), "mode": out.get("mode"), **out}


# --------------------------------------------------------------------- CLI
def _main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 0

    cmd = argv[1]
    if cmd == "list":
        print(json.dumps({"ok": True, "capabilities": list_capabilities()},
                         ensure_ascii=False, indent=2))
        return 0

    if cmd == "schema":
        print(json.dumps(schema(), ensure_ascii=False, indent=2))
        return 0

    if cmd == "call":
        if len(argv) < 4:
            print(json.dumps({"ok": False, "error": "用法: call <capability> '<json args>'"},
                             ensure_ascii=False))
            return 2
        capability = argv[2]
        try:
            args = json.loads(argv[3]) if argv[3].strip() else {}
        except json.JSONDecodeError as e:
            print(json.dumps({"ok": False, "error": f"参数不是合法 JSON：{e}"},
                             ensure_ascii=False))
            return 2
        print(json.dumps(invoke(capability, args), ensure_ascii=False, indent=2))
        return 0

    if cmd == "run":
        question = " ".join(argv[2:]).strip()
        print(json.dumps(run(question), ensure_ascii=False, indent=2))
        return 0

    print(json.dumps({"ok": False, "error": f"未知命令 {cmd}"}, ensure_ascii=False))
    return 2


if __name__ == "__main__":
    sys.exit(_main(sys.argv))
