// O lado de dentro do iframe: recebe o rascunho do pai e desenha o site com
// ele, em vez de buscar o conteúdo publicado.
//
// Carregado com React.lazy pelo SiteLayout, só quando a URL traz ?editor=1 —
// nada daqui pesa no site de quem está lendo.
//
// POR QUE O IFRAME, E NÃO RENDERIZAR O SITE DIRETO NO ADMIN
//
// As classes responsivas do Tailwind (`md:`, `lg:`) respondem ao VIEWPORT, não
// ao tamanho do container. Renderizado dentro do painel do CRM, o site acharia
// que tem a largura da janela inteira e mostraria o layout de desktop numa
// caixa de 800px — e o botão de "ver no celular" seria uma mentira. Com o
// iframe, mudar a largura do elemento muda o viewport de verdade e as media
// queries respondem como responderiam no aparelho. O custo é uma segunda cópia
// do bundle do site em memória, aceitável numa ferramenta de administração.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { SitePublico } from '../../services/publico';
import { ProvedorConfigPublica } from '../contexto';
import { ProvedorEditor, type EstadoEditor } from './contexto';
import { enviar, receber, type MensagemParaPreview } from './protocolo';

/**
 * Deixa o site inerte ao clique, menos o que o editor marcou como interativo.
 *
 * Uma regra resolve de uma vez o que seriam muitos remendos espalhados: link
 * que navegaria para fora do preview, acordeão do FAQ que abriria ao tentar
 * selecionar o bloco, simulador que recalcularia, e principalmente o
 * FormularioLead — sem isto, cada clique de teste do administrador criaria um
 * lead de verdade no CRM e queimaria o limite de 5 envios por 15 min da rota
 * pública.
 *
 * `pointer-events: none` no bloco e `auto` no que é editável é o que faz o
 * clique "atravessar" até a sobreposição de seleção.
 */
const CSS_EDITOR = `
[data-modo-editor] [data-bloco] { pointer-events: none; }
[data-modo-editor] [data-editavel],
[data-modo-editor] [data-alca],
[data-modo-editor] [data-elemento-livre] { pointer-events: auto; }
[data-modo-editor] [data-editavel]:hover { outline: 2px dashed rgba(255,209,0,.9); outline-offset: 2px; }
[data-modo-editor] [data-editavel]:focus { outline: 2px solid #ffd100; outline-offset: 2px; }
[data-modo-editor] [data-vazio]::before {
  content: attr(data-vazio);
  opacity: .45;
  font-style: italic;
}
`;

export const PonteEditor: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fonte, setFonte] = useState<SitePublico | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [elemento, setElemento] = useState<string | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // O pai é sempre window.parent aqui — guardado numa ref para que o
  // `receber()` possa checar o remetente sem recriar o listener.
  const pai = useRef<Window | null>(typeof window === 'undefined' ? null : window.parent);

  /* ------------------------------------------------- recepção de mensagens -- */

  useEffect(() => {
    const aoReceber = (evento: MessageEvent) => {
      const msg = receber<MensagemParaPreview>(evento, pai.current);
      if (!msg) return;

      if (msg.tipo === 'conteudo') {
        setFonte(msg.dados.site);
        if (msg.dados.caminho !== pathname) navigate(msg.dados.caminho);
        return;
      }

      if (msg.tipo === 'selecao') {
        setSelecionado(msg.dados.blocoId);
        setElemento(msg.dados.elementoId);
        return;
      }

      if (msg.tipo === 'ir') {
        navigate(msg.dados.caminho);
        return;
      }

      if (msg.tipo === 'rolar_para') {
        const alvo = document.querySelector(`[data-bloco="${msg.dados.blocoId}"]`);
        alvo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    window.addEventListener('message', aoReceber);
    return () => window.removeEventListener('message', aoReceber);
  }, [navigate, pathname]);

  /**
   * Avisa o pai que já dá para mandar conteúdo.
   *
   * UMA VEZ SÓ, na montagem — por isso num efeito separado do listener, que
   * precisa de `pathname` nas dependências. Juntos, cada navegação interna
   * dispararia um `pronto` novo, o pai responderia com o conteúdo e o ciclo
   * daria uma volta a mais sem necessidade.
   *
   * Anunciar daqui, e não do `load` do iframe lá fora, é o que evita a corrida
   * em que o conteúdo chega antes deste listener existir e se perde.
   */
  useEffect(() => {
    if (pai.current && pai.current !== window) {
      enviar(pai.current, { tipo: 'pronto', dados: {} });
    }
  }, []);

  /* --------------------------------------------------------------- estado -- */

  const estado: EstadoEditor = useMemo(
    () => ({
      modoEditor: true,
      blocoSelecionado: selecionado,

      aoEditarTexto: (blocoId, campo, valor) => {
        if (pai.current) enviar(pai.current, { tipo: 'texto', dados: { blocoId, campo, valor } });
      },

      aoRedimensionar: (blocoId, campo, valor) => {
        if (pai.current) enviar(pai.current, { tipo: 'imagem', dados: { blocoId, campo, valor } });
      },

      aoReordenarLista: (blocoId, campo, lista) => {
        if (pai.current) enviar(pai.current, { tipo: 'lista', dados: { blocoId, campo, lista } });
      },

      // A seleção é aplicada aqui na hora, e só depois avisada ao pai. Esperar
      // o eco do pai colocaria a latência do postMessage entre o clique e o
      // contorno aparecer, e o clique pareceria perdido.
      aoSelecionar: (blocoId) => {
        setSelecionado(blocoId);
        if (pai.current) enviar(pai.current, { tipo: 'selecionou', dados: { blocoId } });
      },

      aoReordenar: (ordem) => {
        if (pai.current) enviar(pai.current, { tipo: 'ordem', dados: { ordem } });
      },

      elementoSelecionado: elemento,
      aoSelecionarElemento: setElemento,

      aoMoverElemento: (blocoId, elementoId, geo) => {
        if (pai.current) {
          enviar(pai.current, { tipo: 'elemento', dados: { blocoId, elementoId, ...geo } });
        }
      },
    }),
    [selecionado, elemento],
  );

  /* --------------------------------------------------------------- render -- */

  return (
    <ProvedorEditor valor={estado}>
      <style>{CSS_EDITOR}</style>
      <div data-modo-editor="">
        <ProvedorConfigPublica fonte={fonte}>{children}</ProvedorConfigPublica>
      </div>
    </ProvedorEditor>
  );
};

export default PonteEditor;
