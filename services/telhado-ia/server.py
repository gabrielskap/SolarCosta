"""HTTP privado, sem dependências web. Um subprocesso CPU por vez, com cancelamento."""
import hmac
import os
import re
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

TOKEN = os.environ.get('TELHADO_IA_TOKEN', '')
LIMIT = 10*1024*1024
LOCK = threading.Lock()
JOBS = {}
GUARD = threading.Lock()
BASE = Path(__file__).resolve().parent


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # Não registrar cabeçalhos/credenciais nem imagens.
        pass

    def reply(self, code, body=b'', mime='text/plain; charset=utf-8'):
        self.send_response(code)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def authorized(self):
        if len(TOKEN) < 32 or not hmac.compare_digest(self.headers.get('Authorization', ''), f'Bearer {TOKEN}'):
            self.reply(401)
            return False
        return True

    def do_GET(self):
        if self.authorized():
            weights = BASE/'weights/RealESRGAN_x4plus.pth'
            self.reply(200 if self.path == '/health' and weights.is_file() else 503)

    def do_DELETE(self):
        if not self.authorized():
            return
        job = self.path.removeprefix('/jobs/')
        if not self.path.startswith('/jobs/') or not re.fullmatch(r'[a-f0-9-]{36}', job):
            self.reply(404)
            return
        with GUARD:
            process = JOBS.get(job)
            if process and process.poll() is None:
                process.kill()
        self.reply(204)

    def do_POST(self):
        if not self.authorized():
            return
        if self.path != '/upscale':
            self.reply(404)
            return
        try:
            length = int(self.headers.get('Content-Length', 0))
            width, height = int(self.headers['X-Output-Width']), int(self.headers['X-Output-Height'])
            job = self.headers['X-Job-Id']
            if not 0 < length <= LIMIT or not 0 < width <= 3840 or not 0 < height <= 3840 or not re.fullmatch(r'[a-f0-9-]{36}', job):
                raise ValueError()
        except (ValueError, TypeError, KeyError):
            self.reply(422)
            return
        if not LOCK.acquire(blocking=False):
            self.reply(429)
            return
        process = None
        try:
            self.connection.settimeout(30)
            data = self.rfile.read(length)
            if len(data) != length:
                self.reply(422)
                return
            with tempfile.TemporaryDirectory(prefix='telhado-ia-') as directory:
                source, target = Path(directory)/'input.png', Path(directory)/'output.webp'
                source.write_bytes(data)
                process = subprocess.Popen([sys.executable, str(BASE/'inference.py'), str(source), str(target), str(width), str(height)],
                    stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                with GUARD:
                    JOBS[job] = process
                try:
                    code = process.wait(timeout=900)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
                    self.reply(504)
                    return
                if code or not target.is_file() or target.stat().st_size > LIMIT:
                    self.reply(422)
                    return
                self.reply(200, target.read_bytes(), 'image/webp')
        except (OSError, TimeoutError):
            self.reply(503)
        finally:
            if process and process.poll() is None:
                process.kill()
                process.wait()
            with GUARD:
                JOBS.pop(job, None)
            LOCK.release()


if __name__ == '__main__':
    if len(TOKEN) < 32:
        raise SystemExit('Defina TELHADO_IA_TOKEN com pelo menos 32 caracteres')
    ThreadingHTTPServer((os.environ.get('BIND', '0.0.0.0'), int(os.environ.get('PORT', '8000'))), Handler).serve_forever()
