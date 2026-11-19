"""简历导出：有 python-docx 就出真 .docx，没有就退化成 Word 能打开的 .doc。"""
import io

try:
    from docx import Document  # type: ignore
    from docx.shared import Pt  # type: ignore
    HAS_DOCX = True
except Exception:  # noqa: BLE001
    HAS_DOCX = False


def _blocks(title: str, sections: list[tuple[str, list[str]]]) -> list[tuple[str, int, bool]]:
    """统一成 (文本, 级别0正文/1标题, 是否加粗)。"""
    out: list[tuple[str, int, bool]] = [(title, 1, True)]
    for head, lines in sections:
        if head:
            out.append((head, 1, True))
        for ln in lines:
            out.append((ln, 0, False))
    return out


def to_docx(title: str, sections: list[tuple[str, list[str]]]) -> bytes:
    if not HAS_DOCX:
        raise RuntimeError("no python-docx")
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "微软雅黑"
    style.font.size = Pt(10.5)

    for text, level, bold in _blocks(title, sections):
        p = doc.add_paragraph()
        run = p.add_run(text)
        if bold:
            run.bold = True
            run.font.size = Pt(15 if level == 1 and text == title else 12)
        if text.startswith("- "):
            p.paragraph_format.left_indent = Pt(12)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def to_html_doc(title: str, sections: list[tuple[str, list[str]]]) -> bytes:
    """无依赖兜底：Word / WPS 都能直接打开的 .doc（本质是带样式的 HTML）。"""
    esc = lambda s: (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    body = [f"<h1>{esc(title)}</h1>"]
    for head, lines in sections:
        if head:
            body.append(f"<h2>{esc(head)}</h2>")
        for ln in lines:
            body.append(f"<p>{esc(ln)}</p>")
    html = (
        '<html xmlns:w="urn:schemas-microsoft-com:office:word"><head>'
        '<meta charset="utf-8"><style>'
        'body{font-family:"微软雅黑",sans-serif;font-size:11pt;line-height:1.7}'
        'h1{font-size:18pt} h2{font-size:12pt;border-bottom:1px solid #999;padding-bottom:2px}'
        '</style></head><body>' + "".join(body) + "</body></html>"
    )
    return html.encode("utf-8")


def build_payload(title: str, sections: list[tuple[str, list[str]]]) -> tuple[str, bytes]:
    """返回 (文件名, 二进制内容)。"""
    if HAS_DOCX:
        try:
            return "简历.docx", to_docx(title, sections)
        except Exception:  # noqa: BLE001
            pass
    return "简历.doc", to_html_doc(title, sections)


def sections_from_text(text: str) -> tuple[str, list[tuple[str, list[str]]]]:
    """把 build_resume 的文本输出切成 Word 章节（按 ■ 分块）。"""
    head = "个人简历"
    sections: list[tuple[str, list[str]]] = []
    current: tuple[str, list[str]] | None = None

    for raw in (text or "").split("\n"):
        line = raw.rstrip()
        if not line.strip():
            continue
        if line.startswith("■"):
            current = (line.lstrip("■ ").replace("■", "").strip(), [])
            sections.append(current)
            continue
        if line.startswith("【简历草案】"):
            continue
        if line.startswith(("写作提醒", "【我的档案】", "【下一步】", "（规则引擎")):
            continue
        if current is None:
            # 抬头（姓名｜学历｜求职意向）与联系方式
            if "求职意向" in line or "联系方式" in line:
                if sections and sections[-1][0] == "基本信息":
                    sections[-1][1].append(line)
                else:
                    sections.append(("基本信息", [line]))
            else:
                head = line.strip("【】 ").replace("■", "") or head
            continue
        current[1].append(line.strip())

    if not sections:
        sections = [("简历", [ln for ln in (text or "").split("\n") if ln.strip()])]
    return head, sections
