// A procuração no modelo da Solar Costa, como sai no papel.
//
// Um único componente para os quatro lugares onde ela aparece: o modal do CRM,
// o link do cliente (/p/:token), o PDF do WhatsApp (o Puppeteer do servidor
// imprime essa mesma página) e a pré-visualização ao vivo do editor — o mesmo
// princípio do DocumentoContrato: o cliente recebe o que o vendedor viu.
//
// Sem faixa nem rodapé da empresa, como no .docx: a procuração é documento do
// outorgante, não papel timbrado da Solar Costa. Uma página só; as medidas
// estão em "PROCURAÇÃO" no src/index.css.

import React from 'react';
import type { ChaveSecaoProcuracao, Procuracao } from '../../types';
import type { ConfigApp } from '../../services/api';
import type { Trecho } from '../../documento/textoModelo';
import { ehPessoaJuridica } from '../../contrato/marcadores';
import { SECOES_DO_QUADRO, TITULO_PROCURACAO, tituloNoQuadro } from '../../procuracao/modeloProcuracao';
import { type DadosProcuracao, prepararProcuracao } from '../../procuracao/marcadores';
import { paragrafosDaSecao } from '../../procuracao/renderizar';

interface Props {
  procuracao: Procuracao;
  /** Parâmetros do banco, para completar o que faltar nos termos. */
  config?: ConfigApp | null;
  /**
   * Pré-visualização do editor: destaca campos vazios e marcadores que não
   * existem. Nunca no documento enviado ao cliente.
   */
  destacar?: boolean;
  /** Seção em foco no editor — ganha um contorno na pré-visualização. */
  secaoEmFoco?: ChaveSecaoProcuracao | null;
}

const LINHA_VAZIA = '______________';

function TrechoProcuracao({ t }: { t: Trecho }) {
  let conteudo: React.ReactNode = t.texto;
  if (t.vazio) conteudo = <span className="procuracao-vazio">{LINHA_VAZIA}</span>;
  else if (t.desconhecido) conteudo = <span className="procuracao-desconhecido">{t.texto}</span>;
  return t.negrito ? <strong>{conteudo}</strong> : <>{conteudo}</>;
}

function Secao({ d, chave }: { d: DadosProcuracao; chave: ChaveSecaoProcuracao }) {
  return (
    <>
      {paragrafosDaSecao(d, chave).map((p, i) => (
        <p key={i} className={p.item ? 'procuracao-item' : undefined}>
          {p.trechos.map((t, j) => (
            <TrechoProcuracao key={j} t={t} />
          ))}
        </p>
      ))}
    </>
  );
}

/** Texto ou linha em branco para preencher à mão. */
const ouLinha = (v: string) => v || LINHA_VAZIA;

function Assinatura({ d }: { d: DadosProcuracao }) {
  const p = d.procuracao;
  const pj = ehPessoaJuridica(p.cpfCnpj);
  return (
    <div className="procuracao-assinatura">
      <div className="procuracao-linha-assinatura" />
      <p>OUTORGANTE</p>
      <p>{ouLinha(p.clienteNome)}</p>
      <p>{pj ? 'CNPJ' : 'CPF'} {ouLinha(p.cpfCnpj)}</p>
      {pj && <p>Representante: {ouLinha(d.termos.representanteNome)}</p>}
    </div>
  );
}

export const DocumentoProcuracao: React.FC<Props> = ({ procuracao, config, destacar = false, secaoEmFoco }) => {
  const d = prepararProcuracao(procuracao, { config });
  const quantidade = d.outorgados.filter((o) => o.nome.trim() || o.cpf.trim()).length;
  const foco = (chave: ChaveSecaoProcuracao) => (secaoEmFoco === chave ? 'procuracao-secao-foco' : '');

  return (
    <div
      className={`folha-pdf folha-procuracao bg-white shadow-xl print:shadow-none border border-slate-200 print:border-none max-w-4xl mx-auto ${
        destacar ? 'procuracao-destacar' : ''
      }`}
    >
      <div className="procuracao-corpo">
        <h1 className="procuracao-titulo">{TITULO_PROCURACAO}</h1>

        <section data-secao="abertura" className={`procuracao-secao ${foco('abertura')}`}>
          <Secao d={d} chave="abertura" />
        </section>

        <div className="procuracao-quadro">
          {SECOES_DO_QUADRO.map((chave) => (
            <section key={chave} data-secao={chave} className={`procuracao-linha ${foco(chave)}`}>
              <div className="procuracao-rotulo">{tituloNoQuadro(chave, quantidade)}</div>
              <div className="procuracao-texto">
                <Secao d={d} chave={chave} />
              </div>
            </section>
          ))}
        </div>

        <section data-secao="vigencia" className={`procuracao-secao ${foco('vigencia')}`}>
          <Secao d={d} chave="vigencia" />
        </section>

        <section data-secao="fecho" className={`procuracao-secao procuracao-fecho ${foco('fecho')}`}>
          <Secao d={d} chave="fecho" />
        </section>

        <Assinatura d={d} />
      </div>
    </div>
  );
};
