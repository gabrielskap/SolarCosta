// Biblioteca de imagens do site.
//
// Serve a dois papéis: aba própria (gerenciar o acervo) e seletor modal
// (escolher a imagem de um campo). O mesmo componente, com `aoEscolher`
// definido ou não.
//
// Os bytes ficam no Postgres (SolarCosta_SiteMidia) e são servidos por
// /api/publico/midia/:id, com cache longo — a miniatura aqui e a imagem no
// site saem da mesma URL.

import React, { useRef, useState } from 'react';
import { Check, ImageIcon, Loader2, Trash2, Upload, X } from 'lucide-react';
import { Site } from '../../services/site';
import { ErroApi } from '../../services/http';
import { urlMidia, type MidiaSite } from '../../site/blocos/tipos';

/** O CHECK do banco aceita só estes quatro. SVG fica de fora: é XML executável. */
const ACEITOS = 'image/png,image/jpeg,image/webp,image/avif';
const LIMITE_MB = 5;

interface Props {
  midia: MidiaSite[];
  onMidiaAlterada: (midia: MidiaSite[]) => void;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
  /** Presente = modo seletor: clicar num item devolve o id e fecha. */
  aoEscolher?: (id: string) => void;
  aoFechar?: () => void;
}

function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const BibliotecaMidia: React.FC<Props> = ({
  midia,
  onMidiaAlterada,
  showToast,
  aoEscolher,
  aoFechar,
}) => {
  const [enviando, setEnviando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const seletor = !!aoEscolher;

  const enviar = async (arquivos: FileList | null) => {
    if (!arquivos || arquivos.length === 0) return;
    setEnviando(true);

    try {
      const novos: MidiaSite[] = [];
      for (const arquivo of Array.from(arquivos)) {
        if (arquivo.size > LIMITE_MB * 1024 * 1024) {
          showToast('Imagem grande demais', 'error', `${arquivo.name} passa de ${LIMITE_MB} MB.`);
          continue;
        }
        if (!ACEITOS.split(',').includes(arquivo.type)) {
          showToast(
            'Formato não suportado',
            'error',
            `${arquivo.name}: envie PNG, JPEG, WebP ou AVIF.`,
          );
          continue;
        }
        novos.push(await Site.enviarMidia(arquivo));
      }

      if (novos.length > 0) {
        // Dedupe por hash no servidor: reenviar a mesma imagem devolve o id
        // que já existe, então trocamos em vez de acumular duplicata na lista.
        const ids = new Set(novos.map((n) => n.id));
        onMidiaAlterada([...novos, ...midia.filter((m) => !ids.has(m.id))]);
        showToast('Imagem enviada', 'success', `${novos.length} arquivo(s) na biblioteca.`);
      }
    } catch (erro) {
      showToast(
        'Não foi possível enviar',
        'error',
        erro instanceof ErroApi ? erro.mensagemCompleta : 'Erro inesperado.',
      );
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = '';
    }
  };

  const excluir = async (m: MidiaSite) => {
    try {
      const r = await Site.excluirMidia(m.id);
      onMidiaAlterada(midia.filter((x) => x.id !== m.id));
      showToast(
        'Imagem removida',
        r.blocos_em_uso > 0 ? 'info' : 'success',
        r.blocos_em_uso > 0
          ? `Atenção: ${r.blocos_em_uso} bloco(s) ainda usavam esta imagem.`
          : m.nomeArquivo,
      );
    } catch (erro) {
      showToast(
        'Não foi possível remover',
        'error',
        erro instanceof ErroApi ? erro.mensagemCompleta : 'Erro inesperado.',
      );
    }
  };

  const salvarAlt = async (m: MidiaSite, alt: string) => {
    if (alt === (m.textoAlternativo ?? '')) return;
    try {
      const atualizada = await Site.salvarMidia(m.id, { texto_alternativo: alt });
      onMidiaAlterada(midia.map((x) => (x.id === m.id ? atualizada : x)));
    } catch {
      showToast('Não foi possível salvar a descrição', 'error');
    }
  };

  const grade = (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={entrada}
          type="file"
          accept={ACEITOS}
          multiple
          hidden
          onChange={(e) => void enviar(e.target.files)}
        />
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={enviando}
          className="inline-flex items-center gap-2 bg-[#004276] hover:bg-[#003158] disabled:bg-slate-300 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm transition"
        >
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {enviando ? 'Enviando…' : 'Enviar imagem'}
        </button>
        <span className="text-xs text-slate-500">
          PNG, JPEG, WebP ou AVIF, até {LIMITE_MB} MB. SVG não é aceito por segurança.
        </span>
      </div>

      {midia.length === 0 ? (
        <div className="mt-6 border border-dashed border-slate-300 rounded-2xl p-10 text-center">
          <ImageIcon className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="mt-3 text-sm font-bold text-slate-600">A biblioteca está vazia</p>
          <p className="text-xs text-slate-500 mt-1">
            Envie uma imagem para usá-la nos blocos de texto e nas galerias.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {midia.map((m) => (
            <div
              key={m.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col"
            >
              <button
                type="button"
                onClick={() => aoEscolher?.(m.id)}
                disabled={!seletor}
                className={`block w-full h-36 bg-slate-100 ${
                  seletor ? 'cursor-pointer hover:opacity-90 transition' : 'cursor-default'
                }`}
              >
                <img
                  src={urlMidia(m.id) ?? ''}
                  alt={m.textoAlternativo ?? ''}
                  className="w-full h-full object-cover"
                />
              </button>

              <div className="p-3 flex-1 flex flex-col gap-2">
                <p className="text-xs font-bold text-slate-700 truncate" title={m.nomeArquivo}>
                  {m.nomeArquivo}
                </p>
                <p className="text-[11px] text-slate-400">
                  {tamanhoLegivel(m.tamanhoBytes)}
                  {m.largura && m.altura ? ` · ${m.largura}×${m.altura}` : ''}
                </p>

                {!seletor && (
                  <>
                    <input
                      type="text"
                      defaultValue={m.textoAlternativo ?? ''}
                      placeholder="Descrição para leitor de tela"
                      onBlur={(e) => void salvarAlt(m, e.target.value.trim())}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:border-[#004276]"
                    />
                    <button
                      type="button"
                      onClick={() => void excluir(m)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-rose-600 transition mt-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remover
                    </button>
                  </>
                )}

                {seletor && (
                  <button
                    type="button"
                    onClick={() => aoEscolher?.(m.id)}
                    className="inline-flex items-center justify-center gap-1.5 text-[11px] font-bold text-white bg-[#004276] hover:bg-[#003158] rounded-lg py-1.5 transition mt-auto"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Usar esta
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (!seletor) return <div>{grade}</div>;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto">
        <div className="bg-[#004276] text-white p-4 flex items-center justify-between sticky top-0 z-10">
          <h3 className="font-bold text-base">Escolher imagem</h3>
          <button onClick={aoFechar} className="text-slate-300 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{grade}</div>
      </div>
    </div>
  );
};
