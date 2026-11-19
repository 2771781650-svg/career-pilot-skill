"""可选的大模型接入：支持任意 OpenAI 兼容接口（DeepSeek / 豆包 / 通义 / OpenAI）。"""
import os

try:
    from openai import OpenAI  # type: ignore
except Exception:  # noqa: BLE001
    OpenAI = None


class LLM:
    def __init__(self) -> None:
        self.api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
        self.base_url = (os.getenv("OPENAI_BASE_URL") or "").strip() or None
        self.model = (os.getenv("OPENAI_MODEL") or "gpt-4o-mini").strip()
        self.client = OpenAI(api_key=self.api_key, base_url=self.base_url) if (self.api_key and OpenAI) else None

    @property
    def available(self) -> bool:
        return self.client is not None

    @property
    def mode_name(self) -> str:
        return f"大模型模式（{self.model}）" if self.available else "规则引擎模式（无需 API Key）"

    def chat(self, messages: list[dict], temperature: float = 0.2) -> str:
        if not self.available:
            return ""
        try:
            resp = self.client.chat.completions.create(  # type: ignore[union-attr]
                model=self.model, messages=messages, temperature=temperature,
            )
            return (resp.choices[0].message.content or "").strip()
        except Exception as e:  # noqa: BLE001
            return f"__LLM_ERROR__{e}"
