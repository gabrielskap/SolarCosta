"""Pesos oficiais versionados; a imagem de produção não baixa arquivos em execução."""
import hashlib
import urllib.request
from pathlib import Path

URL = 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth'
SHA256 = '4fa0d38905f75ac06eb49a7951b426670021be3018265fd191d2125df9d682f1'
target = Path(__file__).parent/'weights/RealESRGAN_x4plus.pth'
target.parent.mkdir(exist_ok=True)
if not target.exists():
    urllib.request.urlretrieve(URL, target)
if hashlib.sha256(target.read_bytes()).hexdigest() != SHA256:
    raise SystemExit('Hash dos pesos Real-ESRGAN não confere')
