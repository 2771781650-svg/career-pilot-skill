"""工具注册表：智能体可调用的能力集合。"""
from dataclasses import dataclass
from typing import Any, Callable


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict          # JSON Schema 简化版：{参数名: 说明}
    func: Callable[..., Any]


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> Tool:
        self._tools[tool.name] = tool
        return tool

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def names(self) -> list[str]:
        return list(self._tools)

    def schema(self) -> list[dict]:
        return [
            {"name": t.name, "description": t.description, "parameters": t.parameters}
            for t in self._tools.values()
        ]

    def run(self, name: str, args: dict | None = None) -> str:
        tool = self._tools.get(name)
        if tool is None:
            return f"[错误] 不存在工具 {name}。可用工具：{', '.join(self.names())}"
        try:
            return str(tool.func(**(args or {})))
        except TypeError as e:
            return f"[参数错误] {name} 调用参数不匹配：{e}"
        except Exception as e:                      # noqa: BLE001
            return f"[工具执行失败] {name}：{e}"
