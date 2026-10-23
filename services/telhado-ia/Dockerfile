FROM python:3.12.8-slim
WORKDIR /service
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY model.py inference.py server.py download_weights.py ./
RUN python download_weights.py && useradd --system --uid 10001 worker && chown -R worker:worker /service
USER worker
ENV PORT=8000 TORCH_THREADS=2 PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["python", "server.py"]
