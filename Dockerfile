FROM python:3.11-slim

# 本地 OCR 依赖（识别简历图片）
RUN apt-get update && apt-get install -y --no-install-recommends \
      tesseract-ocr tesseract-ocr-chi-sim fonts-noto-cjk \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

# 可选增强：Pillow（OCR 预处理）、python-docx（导出真 .docx）
RUN pip install --no-cache-dir pillow python-docx 2>/dev/null || true

ENV HOST=0.0.0.0 PORT=8000
EXPOSE 8000
CMD ["python", "server.py"]
