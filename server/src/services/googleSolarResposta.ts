import { z } from 'zod';
import { AppError } from '../errors.js';

const coordenadaSolar = z.object({latitude:z.number().finite().min(-85).max(85),longitude:z.number().finite().min(-180).max(180)});
const dataSolar = z.object({year:z.number().int(),month:z.number().int().min(1).max(12),day:z.number().int().min(1).max(31)});
const positivo = z.number().finite().nonnegative();
const respostaSolarSchema = z.object({
  name:z.string().min(1),center:coordenadaSolar,
  imageryDate:dataSolar.optional(),imageryProcessedDate:dataSolar.optional(),imageryQuality:z.string().optional(),
  solarPotential:z.object({
    maxArrayAreaMeters2:positivo,panelCapacityWatts:positivo,panelHeightMeters:positivo,panelWidthMeters:positivo,
    wholeRoofStats:z.object({areaMeters2:positivo}),
    roofSegmentStats:z.array(z.object({
      pitchDegrees:positivo.max(90).default(0),azimuthDegrees:positivo.max(360).default(0),center:coordenadaSolar,
      stats:z.object({areaMeters2:positivo,sunshineQuantiles:z.array(positivo).length(11)}),
    })).default([]),
    solarPanels:z.array(z.object({center:coordenadaSolar,orientation:z.enum(['LANDSCAPE','PORTRAIT']),segmentIndex:z.number().int().nonnegative().default(0)})).optional(),
  }),
});

export async function consultarBuildingInsights(url: string, timeoutMs = 15000) {
    let j: z.infer<typeof respostaSolarSchema>;
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const resp = await fetch(url, {signal});
      if (resp.status === 404) throw new AppError(404, 'O Google não tem análise para este ponto. Confira a edificação ou continue manualmente.', 'telhado_sem_dados');
      if (resp.status === 401 || resp.status === 403) throw new AppError(503, 'Acesso à análise solar recusado. Confira a configuração Google no servidor.', 'solar_acesso_recusado');
      if (resp.status === 429) throw new AppError(429, 'Limite de consultas solares atingido. Tente mais tarde ou continue manualmente.', 'solar_limite');
      if (!resp.ok) throw new AppError(502, 'Análise solar temporariamente indisponível. Continue manualmente.', 'solar_indisponivel');
      const parsed = respostaSolarSchema.safeParse(await resp.json());
      if (!parsed.success) throw new AppError(502, 'O provedor retornou dados solares inválidos. Continue manualmente.', 'solar_resposta_invalida');
      j = parsed.data;
    } catch (e) {
      if (e instanceof AppError) throw e;
      if (signal.aborted) throw new AppError(504, 'A consulta solar excedeu o tempo limite. Tente novamente.', 'solar_timeout');
      throw new AppError(502, 'Não foi possível obter dados solares válidos. Continue manualmente.', 'solar_indisponivel');
    }
    return j;
}
