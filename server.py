"""零依赖 Web 服务：python server.py → http://127.0.0.1:8000

接口：
  GET  /                    网页
  POST /api/chat            文本问答  {question, history}
  POST /api/resume/image    简历图片识别 {image_base64}
  GET  /api/profile         当前档案
  POST /api/reset           清空档案
  POST /api/export/resume   导出 Word 简历 → {filename, base64}
"""
import base64
import json
import os
import re
import tempfile
import threading
import uuid
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:  # noqa: BLE001
    pass

from agent import CareerAgent
from tools.exporter import build_payload, sections_from_text
from tools.ocr import available as ocr_available, ocr_image
from skill_api import invoke, list_capabilities, schema as skill_schema

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(ROOT, "web")
_lock = threading.Lock()
MAX_IMAGE_BYTES = 12 * 1024 * 1024
MAX_SESSIONS = 80          # 同时在线的会话上限，超了淘汰最久未用的
_DEFAULT_SID = "default"


class Sessions:
    """按设备会话隔离档案：多台设备同时访问，档案互不串。"""

    def __init__(self, limit: int = MAX_SESSIONS) -> None:
        self._data: "OrderedDict[str, CareerAgent]" = OrderedDict()
        self._limit = limit
        self._guard = threading.Lock()

    def get(self, sid: str) -> CareerAgent:
        sid = (sid or "").strip()[:64] or _DEFAULT_SID
        with self._guard:
            agent = self._data.get(sid)
            if agent is None:
                agent = CareerAgent()
                self._data[sid] = agent
                while len(self._data) > self._limit:
                    self._data.popitem(last=False)
            else:
                self._data.move_to_end(sid)
            return agent

    def reset(self, sid: str) -> CareerAgent:
        """换一个全新的 agent，等于把这份档案和这条会话的短期记忆都清掉。"""
        sid = (sid or "").strip()[:64] or _DEFAULT_SID
        with self._guard:
            self._data.pop(sid, None)
            agent = CareerAgent()
            self._data[sid] = agent
            while len(self._data) > self._limit:
                self._data.popitem(last=False)
            return agent

    def count(self) -> int:
        return len(self._data)


_agents = Sessions()


def _sid_from_query(path: str) -> str:
    q = path.split("?", 1)[1] if "?" in path else ""
    m = re.search(r"sid=([^&]+)", q)
    return m.group(1)[:64] if m else _DEFAULT_SID


class Handler(BaseHTTPRequestHandler):
    server_version = "CareerPilot/1.2"

    def log_message(self, fmt, *args):  # 静默访问日志
        pass

    # ------------------------------------------------------------------ 工具
    def _send(self, code: int, body: bytes, ctype: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code: int, obj: dict) -> None:
        self._send(code, json.dumps(obj, ensure_ascii=False).encode(), "application/json; charset=utf-8")

    def _body(self) -> dict:
        n = int(self.headers.get("Content-Length", "0") or 0)
        raw = self.rfile.read(n) if n else b"{}"
        try:
            return json.loads(raw or b"{}")
        except json.JSONDecodeError:
            return {}

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.end_headers()

    # ------------------------------------------------------------------ GET
    def do_GET(self) -> None:
        route = self.path.split("?")[0]
        if route == "/api/health":
            self._json(200, {
                "ok": True,
                "sessions": _agents.count(),
                "ocr": ocr_available(),
                "engine": _agents.get(_DEFAULT_SID).llm.mode_name,
                "version": "1.3",
            })
            return
        if route == "/api/profile":
            sid = _sid_from_query(self.path)
            self._json(200, {"ok": True, "sid": sid, "profile": _agents.get(sid).profile.to_dict()})
            return
        if route == "/api/skill/list":
            self._json(200, {"ok": True, "capabilities": list_capabilities()})
            return
        if route == "/.well-known/skill.json":
            self._json(200, skill_schema())
            return
        path = "/index.html" if route in ("/", "") else route
        fp = os.path.normpath(os.path.join(WEB, path.lstrip("/")))
        if not fp.startswith(WEB) or not os.path.isfile(fp):
            self._send(404, b"404 Not Found", "text/plain; charset=utf-8")
            return
        ext = os.path.splitext(fp)[1].lower()
        ctype = {
            ".html": "text/html; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".webmanifest": "application/manifest+json; charset=utf-8",
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".ico": "image/x-icon",
            ".css": "text/css; charset=utf-8",
        }.get(ext, "application/octet-stream")
        with open(fp, "rb") as f:
            self._send(200, f.read(), ctype)

    # ------------------------------------------------------------------ POST
    def do_POST(self) -> None:
        route = self.path.split("?")[0]
        if route == "/api/chat":
            return self._handle_chat()
        if route == "/api/resume/image":
            return self._handle_image()
        if route == "/api/reset":
            data = self._body()
            sid = str(data.get("sid", "")).strip()
            agent = _agents.reset(sid)
            return self._json(200, {"ok": True, "sid": sid, "profile": agent.profile.to_dict()})
        if route.startswith("/api/skill/"):
            return self._handle_skill(route)
        if route == "/api/export/resume":
            return self._handle_export()
        self._json(404, {"error": "not found"})

    # ---------------------------------------------------------- Skill 调用
    def _handle_skill(self, route: str) -> None:
        # /api/skill/run  → 自然语言入口；/api/skill/{capability} → 原子能力调用
        data = self._body()
        if route == "/api/skill/run":
            question = str(data.get("question", "")).strip()
            if not question:
                return self._json(400, {"ok": False, "error": "question 为空"})
            out = _agents.get(str(data.get("sid", "")).strip()).run(question, data.get("history"))
            return self._json(200, {"ok": True, **out})
        capability = route[len("/api/skill/"):]
        result = invoke(capability, data.get("args") or data)
        code = 200 if result.get("ok") else 400
        self._json(code, result)

    # -------------------------------------------------------------- 文本问答
    def _handle_chat(self) -> None:
        try:
            data = self._body()
            question = str(data.get("question", "")).strip()
            history = data.get("history") or []
            if not question:
                return self._json(400, {"error": "question is empty"})
            sid = str(data.get("sid", "")).strip()
            with _lock:
                result = _agents.get(sid).run(question, history)
            self._json(200, result)
        except Exception as e:  # noqa: BLE001
            self._json(500, {"error": str(e)})

    # -------------------------------------------------------------- 图片识别
    def _handle_image(self) -> None:
        tmp_path = ""
        try:
            data = self._body()
            raw = str(data.get("image_base64", ""))
            if not raw:
                return self._json(400, {"error": "image_base64 为空"})

            m = re.match(r"data:image/(\w+);base64,(.*)", raw, re.S)
            ext = m.group(1) if m else "png"
            payload = m.group(2) if m else raw
            binary = base64.b64decode(payload, validate=False)
            if len(binary) > MAX_IMAGE_BYTES:
                return self._json(413, {"error": "图片超过 12MB，压一下再传"})

            tmp_path = os.path.join(tempfile.gettempdir(), f"resume_{uuid.uuid4().hex}.{ext}")
            with open(tmp_path, "wb") as f:
                f.write(binary)

            result = ocr_image(tmp_path)
            if not result["ok"]:
                return self._json(200, {"ok": False, "reason": result["reason"],
                                        "text": result["text"], "ocr": ocr_available()})

            text = result["text"]
            sid = str(data.get("sid", "")).strip()
            with _lock:
                analysis = _agents.get(sid).run("帮我看看这份简历：\n" + text)
            self._json(200, {
                "ok": True,
                "text": text,
                "answer": analysis["answer"],
                "steps": analysis["steps"],
                "engine": analysis["engine"],
                "profile": analysis.get("profile", {}),
                "ocr": True,
            })
        except Exception as e:  # noqa: BLE001
            self._json(500, {"error": str(e)})
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass

    # -------------------------------------------------------------- 导出简历
    def _handle_export(self) -> None:
        try:
            data = self._body()
            sid = str(data.get("sid", "")).strip()
            p = _agents.get(sid).profile
            fields = {
                "name": data.get("name") or p.name,
                "edu": data.get("edu") or p.edu,
                "skills": data.get("skills") or p.skills,
                "experience": data.get("experience") or p.projects,
                "target_job": data.get("target_job") or p.target_job,
                "contact": data.get("contact") or p.contact,
                "certs": data.get("certs") or p.certs,
            }
            if not any(fields[k] for k in ("skills", "experience", "edu")):
                return self._json(400, {"error": "档案里还没有可导出的简历内容，先说学历和技能。"})

            registry = _agents.get(sid).registry
            text = registry.run("build_resume", fields)
            head, sections = sections_from_text(text)
            filename, blob = build_payload(f"{fields['name'] or '我'}的简历", sections)
            self._json(200, {
                "ok": True,
                "filename": filename,
                "base64": base64.b64encode(blob).decode(),
                "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        if filename.endswith(".docx") else "application/msword",
            })
        except Exception as e:  # noqa: BLE001
            self._json(500, {"error": str(e)})


def main() -> None:
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "127.0.0.1")   # 容器/云上设 HOST=0.0.0.0
    srv = ThreadingHTTPServer((host, port), Handler)
    print("职途 CareerPilot 已启动")
    print(f"引擎：{_agents.get(_DEFAULT_SID).llm.mode_name}")
    print(f"图片识别：{'可用（tesseract 本地 OCR）' if ocr_available() else '不可用（未安装 tesseract）'}")
    print(f"简历导出：Word（docx/doc 自动降级）")
    print(f"打开浏览器访问： http://{host if host != '0.0.0.0' else '127.0.0.1'}:{port}")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")


if __name__ == "__main__":
    main()
