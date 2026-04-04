FROM python:3.12-slim

WORKDIR /app

# System deps for OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Download model weights if not present
RUN mkdir -p weights && \
    (test -f weights/BSRGAN.pth || curl -L -o weights/BSRGAN.pth "https://huggingface.co/kadirnar/bsrgan/resolve/main/BSRGAN.pth") && \
    (test -f weights/RealESRGAN_x4plus.pth || curl -L -o weights/RealESRGAN_x4plus.pth "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth") && \
    (test -f weights/realesr-general-x4v3.pth || curl -L -o weights/realesr-general-x4v3.pth "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth") && \
    (test -f weights/realesr-general-wdn-x4v3.pth || curl -L -o weights/realesr-general-wdn-x4v3.pth "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-wdn-x4v3.pth")

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
