// Busca de telhado por satélite, usada pela calculadora de propostas.
//
// Dois passos que o front costuma encadear: endereço -> coordenada
// (Geocoding) e coordenada -> telhado (Solar API). Ficam separados de
// propósito: quando o Geocoding erra o ponto — e erra sempre que o endereço
// não é `ROOFTOP` —, o consultor arrasta o pino no mapa e só o segundo passo
// precisa rodar de novo.

import { Router } from 'express';
import { z } from 'zod';
import { exigirLogin } from '../auth/middleware.js';
import { asyncHandler } from '../errors.js';
import { geocodificar, imagemSatelite, telhadoPorCoordenada } from '../services/googleSolar.js';

export const solarRouter = Router();
solarRouter.use(exigirLogin);

const enderecoSchema = z.object({
  endereco: z.string().min(3, 'Informe o endereço.').max(300),
});

/** Endereço em texto -> coordenada + precisão. */
solarRouter.get(
  '/geocodificar',
  asyncHandler(async (req, res) => {
    const { endereco } = enderecoSchema.parse(req.query);
    res.json({ endereco: await geocodificar(endereco) });
  }),
);

const coordenadaSchema = z.object({
  // Faixas do globo: barram lat/lng trocados, que renderiam um 404 confuso.
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/** Coordenada -> segmentos de telhado + máscara de área útil. */
solarRouter.get(
  '/telhado',
  asyncHandler(async (req, res) => {
    const { lat, lng } = coordenadaSchema.parse(req.query);
    res.json({ telhado: await telhadoPorCoordenada(lat, lng) });
  }),
);

const imagemSchema = coordenadaSchema.extend({
  // 20 enquadra uma casa; 21 é o máximo com cobertura de satélite consistente.
  zoom: z.coerce.number().int().min(16).max(21).default(20),
  largura: z.coerce.number().int().min(100).max(640).default(640),
  altura: z.coerce.number().int().min(100).max(640).default(640),
});

/**
 * Recorte de satélite do telhado, servido pela nossa origem.
 *
 * Sem sobreposições: os módulos são desenhados em SVG por cima, no cliente.
 * O proxy existe para a chave não ir para o HTML e para a imagem sair da mesma
 * origem — imagem de terceiro costuma ser recusada na hora de imprimir.
 */
solarRouter.get(
  '/imagem',
  asyncHandler(async (req, res) => {
    const { lat, lng, zoom, largura, altura } = imagemSchema.parse(req.query);
    const img = await imagemSatelite(lat, lng, zoom, largura, altura);

    // O ToS do Google permite cache temporário; 24h casa com o TTL da análise
    // e evita recomprar a mesma imagem a cada reimpressão da proposta.
    res.setHeader('Content-Type', img.tipo);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(img.bytes);
  }),
);
