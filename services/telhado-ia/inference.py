"""Inferência isolada em processo cancelável; somente o fundo limpo é recebido."""
import hashlib
import math
import os
import sys
from pathlib import Path
import numpy as np
from PIL import Image
import torch
from model import RRDBNet

WEIGHTS = Path(os.environ.get('REALESRGAN_WEIGHTS', Path(__file__).parent/'weights/RealESRGAN_x4plus.pth'))
# SHA-256 do arquivo oficial v0.1.0, ver download_weights.py.
WEIGHTS_SHA256 = '4fa0d38905f75ac06eb49a7951b426670021be3018265fd191d2125df9d682f1'
Image.MAX_IMAGE_PIXELS = 3840*3840


def upscale(image, model, tile=128, pad=10):
    """Blocos com contexto; resultado uint8 evita manter tensor 4K float inteiro."""
    pixels = np.asarray(image.convert('RGB'), dtype=np.float32)/255.0
    height, width = pixels.shape[:2]
    output = np.empty((height*4, width*4, 3), dtype=np.uint8)
    with torch.inference_mode():
        for y in range(0, height, tile):
            for x in range(0, width, tile):
                x1, y1 = max(0, x-pad), max(0, y-pad)
                x2, y2 = min(width, x+tile+pad), min(height, y+tile+pad)
                chunk = torch.from_numpy(pixels[y1:y2, x1:x2].copy()).permute(2, 0, 1).unsqueeze(0)
                result = model(chunk).squeeze(0).clamp_(0, 1).permute(1, 2, 0).cpu().numpy()
                result = (result*255.0).round().astype(np.uint8)
                w, h = min(tile, width-x), min(tile, height-y)
                output[y*4:(y+h)*4, x*4:(x+w)*4] = result[(y-y1)*4:(y-y1+h)*4, (x-x1)*4:(x-x1+w)*4]
    return Image.fromarray(output)


def main():
    source, destination, width, height = sys.argv[1:]
    width, height = int(width), int(height)
    if not (1 <= width <= 3840 and 1 <= height <= 3840):
        raise ValueError('Dimensões inválidas')
    if hashlib.sha256(WEIGHTS.read_bytes()).hexdigest() != WEIGHTS_SHA256:
        raise ValueError('Pesos Real-ESRGAN ausentes ou diferentes da versão fixada')
    torch.set_num_threads(max(1, min(4, int(os.environ.get('TORCH_THREADS', '2')))))
    model = RRDBNet()
    weights = torch.load(WEIGHTS, map_location='cpu', weights_only=True)
    model.load_state_dict(weights.get('params_ema', weights.get('params')), strict=True)
    model.eval().float()
    with Image.open(source) as image:
        if image.width > 3840 or image.height > 3840 or image.format not in ('PNG', 'WEBP'):
            raise ValueError('Imagem inválida')
        if abs(image.width/image.height-width/height) > 0.02:
            raise ValueError('Proporção inválida')
        # Não reduzir a origem; só o resultado da rede é ajustado para o limite de saída.
        result = upscale(image, model).resize((width, height), Image.Resampling.LANCZOS)
        result.save(destination, format='WEBP', lossless=True)
    if Path(destination).stat().st_size > 10*1024*1024:
        raise ValueError('Resultado maior que 10 MB')


if __name__ == '__main__':
    main()
