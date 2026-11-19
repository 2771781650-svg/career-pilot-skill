"""极简会话记忆：保留最近若干轮，用于多轮追问。"""
from collections import deque


class Memory:
    def __init__(self, max_turns: int = 6) -> None:
        self._turns: deque = deque(maxlen=max_turns)

    def add(self, question: str, answer: str) -> None:
        self._turns.append({"q": question, "a": answer})

    def recent(self, n: int = 3) -> list[dict]:
        items = list(self._turns)[-n:]
        return items

    def as_messages(self, n: int = 3) -> list[dict]:
        msgs = []
        for t in self.recent(n):
            msgs.append({"role": "user", "content": t["q"]})
            msgs.append({"role": "assistant", "content": t["a"][:400]})
        return msgs

    def clear(self) -> None:
        self._turns.clear()
