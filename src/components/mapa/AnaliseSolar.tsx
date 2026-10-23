import React, { useEffect, useRef, useState } from 'react';
import { buscarTelhado, type TelhadoSolar, type SegmentoTelhado } from '../../services/solar';
import { segmentoAplicavel } from '../../utils/analiseSolar';
import type { AguaManual, LevantamentoTelhado } from '../../utils/levantamentoTelhado';

export function AnaliseSolar({ dados, agua, ativo, onAplicar, onResultado }: {
  dados: LevantamentoTelhado; agua?: AguaManual; ativo: boolean;
  onAplicar: (segmento: SegmentoTelhado) => void;
  onResultado: (resultado: TelhadoSolar | undefined) => void;
}) {
  const [resultado, setResultado] = useState<TelhadoSolar>();
  const [erro, setErro] = useState('');
  const [consultando, setConsultando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [segmento, setSegmento] = useState('');
  const rodada = useRef(0);
  const pendente = useRef(false);
  useEffect(() => () => { rodada.current++; }, []);
  const local = dados.satelite;
  const escolhido = resultado?.segmentos.find(s => String(s.indice) === segmento);
  const valido = segmentoAplicavel(escolhido);
  const consultar = async () => {
    if (!local || !ativo || !confirmado || pendente.current) return;
    pendente.current = true;
    const turno = ++rodada.current;
    setConsultando(true); setErro(''); setResultado(undefined); setSegmento(''); onResultado(undefined);
    try {
      const r = await buscarTelhado(local.latitude, local.longitude);
      if (turno !== rodada.current) return;
      if (!r.ok || !r.telhado) { setErro(r.erro || 'Análise indisponível. Continue o levantamento manual.'); return; }
      setResultado(r.telhado); onResultado(r.telhado);
    } finally {
      if (turno === rodada.current) { pendente.current = false; setConsultando(false); }
    }
  };
  const data = (d?: { ano: number; mes: number; dia: number } | null) => d ? `${String(d.dia).padStart(2, '0')}/${String(d.mes).padStart(2, '0')}/${d.ano}` : 'não informada';
  return <section className="rounded-lg border p-3 space-y-2 text-xs" aria-label="Análise solar Google">
    <h3 className="font-bold">Análise solar Google</h3>
    {!local ? <p>Carregue a imagem por satélite para consultar o imóvel.</p> : <>
      <label className="flex gap-2"><input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} />Conferi que a imagem e as coordenadas correspondem ao imóvel.</label>
      <button type="button" disabled={!ativo || !confirmado || consultando} className="rounded bg-sky-100 p-2 disabled:opacity-40" onClick={() => void consultar()}>{consultando ? 'Consultando…' : 'Consultar análise solar'}</button>
      {!ativo && <p>Integração Google desativada. Continue manualmente.</p>}
    </>}
    {erro && <p role="alert">{erro}</p>}
    {resultado && <>
      <p>Qualidade: {resultado.imagemQualidade || 'não informada'}<br />Levantamento: {data(resultado.imagemData)}<br />Processamento: {data(resultado.imagemProcessadaData)}</p>
      <p>Essas datas não representam a captura da imagem exibida. Confira o marcador G da edificação; o Google pode retornar um imóvel vizinho.</p>
      {!resultado.segmentos.length ? <p>Nenhum segmento disponível. Continue manualmente.</p> : <label className="block">Segmento Google<select className="border rounded w-full p-1" value={segmento} onChange={e => setSegmento(e.target.value)}><option value="">Selecione um segmento</option>{resultado.segmentos.map(s => <option key={s.indice} value={s.indice}>Segmento {s.indice + 1} · {s.areaM2.toFixed(1)} m² · {s.inclinacaoGraus}° / {s.azimuteGraus}°</option>)}</select></label>}
      {escolhido && <>
        <p>Área de superfície Google: {escolhido.areaM2.toFixed(2)} m² (referência). Insolação mediana: {escolhido.insolacaoMediaKwh} kWh/m²/ano.</p>
        <p>Centro do segmento: {escolhido.centro.latitude.toFixed(6)}, {escolhido.centro.longitude.toFixed(6)}.</p>
        {agua ? <p>{agua.nome}: inclinação {agua.inclinacao}° → {escolhido.inclinacaoGraus}°; azimute {agua.azimute}° → {escolhido.azimuteGraus}° (norte geográfico).</p> : <p>Desenhe e selecione uma água para aplicar.</p>}
        <p>Ao aplicar, as placas atuais serão removidas para redistribuição. Contornos e obstáculos serão preservados. Use Desfazer para restaurar.</p>
        {!valido && <p role="alert">Segmento incompatível com os limites do editor.</p>}
        <button type="button" disabled={!agua || !valido || !confirmado || !ativo} className="rounded bg-sky-800 text-white p-2 disabled:opacity-40" onClick={() => { if (agua && valido && escolhido) onAplicar(escolhido); }}>Associar segmento e aplicar à água</button>
      </>}
      <button type="button" className="block underline" onClick={() => { setResultado(undefined); onResultado(undefined); }}>Fechar prévia</button>
    </>}
  </section>;
}
