"""本地 OCR：把简历照片/截图转成文字（依赖系统 tesseract，无需任何 API Key）。"""
import os
import re
import shutil
import subprocess
import tempfile

CJK = r"\u4e00-\u9fa5"

try:
    from PIL import Image, ImageOps  # type: ignore
except Exception:  # noqa: BLE001
    Image = None


def available() -> bool:
    return shutil.which("tesseract") is not None


def _clean(raw: str) -> str:
    """tesseract 的中文结果会在字之间插空格，这里合并掉。"""
    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(rf"(?<=[{CJK}])\s+(?=[{CJK}])", "", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    lines = [ln.strip() for ln in text.split("\n")]
    return "\n".join(ln for ln in lines if ln)


def _preprocess(path: str) -> str:
    """放大 + 灰度 + 增强对比，显著提升截图和小字的识别率。"""
    if Image is None:
        return path
    try:
        with Image.open(path) as im:
            im = im.convert("L")
            w, h = im.size
            scale = 2.0 if max(w, h) < 1600 else 1.0
            if scale > 1:
                im = im.resize((int(w * scale), int(h * scale)))
            im = ImageOps.autocontrast(im, cutoff=2)
            out = os.path.join(tempfile.gettempdir(), f"ocr_pre_{os.getpid()}_{os.path.basename(path)}.png")
            im.save(out)
            return out
    except Exception:  # noqa: BLE001
        return path


def ocr_image(path: str, lang: str = "chi_sim+eng") -> dict:
    """对单张图片做 OCR，返回 {ok, text, reason}。"""
    if not available():
        return {"ok": False, "text": "", "reason": "当前环境没有安装 tesseract，无法本地识别图片。"}

    pre = _preprocess(path)
    try:
        proc = subprocess.run(
            ["tesseract", pre, "stdout", "-l", lang, "--psm", "6"],
            capture_output=True, text=True, timeout=45,
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "text": "", "reason": "识别超时，图片可能过大，换张清晰些的截图试。"}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "text": "", "reason": f"识别失败：{e}"}
    finally:
        if pre != path and os.path.exists(pre):
            try:
                os.remove(pre)
            except OSError:
                pass

    if proc.returncode != 0:
        return {"ok": False, "text": "", "reason": (proc.stderr or "tesseract 执行失败").strip()[:200]}

    text = _clean(proc.stdout)
    if len(text) < 15:
        return {"ok": False, "text": text,
                "reason": "没识别到有效文字。建议：裁掉背景、调亮、正着拍，或直接粘文字。"}
    return {"ok": True, "text": text, "reason": ""}
