// O contrato no modelo oficial da Solar Costa, como sai no papel.
//
// Um único componente para os três lugares onde o contrato aparece: o modal
// do CRM, o link do cliente (/p/:token, de onde o servidor também tira o PDF
// do WhatsApp) e a pré-visualização ao vivo do editor. Desenhar o documento
// uma vez só é o que garante que o cliente receba o que o vendedor viu.
//
// PAGINAÇÃO: o texto corre por várias páginas dentro de uma `.folha-pdf`. O
// cabeçalho (faixa com o logo) e o rodapé (endereço) estão no <thead>/<tfoot>
// de uma tabela, que o Chromium repete em toda página impressa — vale para o
// window.print() e para o Puppeteer do servidor. As regras de quebra estão em
// "CONTRATO" no src/index.css.

import React from 'react';
import type { ChaveSecaoContrato, Contrato } from '../../types';
import type { ConfigApp } from '../../services/api';
import cabecalhoContrato from '../../assets/contrato-cabecalho.jpg';
import { SECOES, TITULO_CONTRATO } from '../../contrato/modeloSolarCosta';
import { type DadosContrato, type Trecho, ehPessoaJuridica, prepararContrato } from '../../contrato/marcadores';
import { type Bloco, blocosDaSecao } from '../../contrato/renderizar';

interface Props {
  contrato: Contrato;
  /** Cadastro da empresa (snake_case), para contrato sem cópia da contratada. */
  empresa?: Record<string, any> | null;
  /** Parâmetros do banco, para os padrões de contrato legado. */
  config?: ConfigApp | null;
  /**
   * Pré-visualização do editor: destaca campos vazios e marcadores que não
   * existem. Nunca no documento enviado ao cliente.
   */
  destacar?: boolean;
  /** Seção em foco no editor — ganha um contorno na pré-visualização. */
  secaoEmFoco?: ChaveSecaoContrato | null;
}

const LINHA_VAZIA = '______________';

function TrechoContrato({ t }: { t: Trecho }) {
  let conteudo: React.ReactNode = t.texto;
  if (t.vazio) conteudo = <span className="contrato-vazio">{LINHA_VAZIA}</span>;
  else if (t.desconhecido) conteudo = <span className="contrato-desconhecido">{t.texto}</span>;
  return t.negrito ? <strong>{conteudo}</strong> : <>{conteudo}</>;
}

function TabelaGarantias({ d }: { d: DadosContrato }) {
  return (
    <table className="contrato-tabela">
      <thead>
        <tr>
          <th>EQUIPAMENTO</th>
          <th>PRAZO</th>
          <th>CAUSA</th>
        </tr>
      </thead>
      <tbody>
        {d.termos.garantias.map((g, i) => (
          <tr key={i}>
            <td>{g.equipamento}</td>
            <td>{g.prazo}</td>
            <td>{g.causa}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Blocos({ blocos, d }: { blocos: Bloco[]; d: DadosContrato }) {
  return (
    <>
      {blocos.map((b, i) =>
        b.tipo === 'tabela_garantias' ? (
          <TabelaGarantias key={i} d={d} />
        ) : (
          <p key={i} className={b.item ? 'contrato-item' : undefined}>
            {b.trechos.map((t, j) => (
              <TrechoContrato key={j} t={t} />
            ))}
          </p>
        ),
      )}
    </>
  );
}

/** Texto ou linha em branco para preencher à mão. */
const ouLinha = (v: string) => v || LINHA_VAZIA;

function Assinaturas({ d }: { d: DadosContrato }) {
  const c = d.contrato;
  const k = d.contratada;
  const testemunhas = [0, 1].map((i) => d.termos.testemunhas[i] ?? { nome: '', rg: '', cpf: '' });
  return (
    <div className="contrato-assinaturas">
      <div className="contrato-assinatura">
        <div className="contrato-linha-assinatura" />
        <p><strong>{ouLinha(c.clienteNome)}</strong></p>
        <p>{ehPessoaJuridica(c.cpfCnpj) ? 'CNPJ' : 'CPF'}: {ouLinha(c.cpfCnpj)}</p>
      </div>
      <div className="contrato-assinatura">
        <div className="contrato-linha-assinatura" />
        <p><strong>Solar Costa</strong></p>
        <p>{ouLinha(k.representanteNome)}</p>
        <p>CNPJ: {ouLinha(k.cnpj)}</p>
      </div>

      <div className="contrato-testemunhas">
        <p><strong>Testemunhas:</strong></p>
        <div className="contrato-testemunhas-grade">
          {testemunhas.map((t, i) => (
            <div key={i}>
              <div className="contrato-linha-assinatura" />
              <p>{i + 1}. Nome: {t.nome}</p>
              <p>RG: {t.rg}</p>
              <p>CPF/MF: {t.cpf}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Anexo({ d }: { d: DadosContrato }) {
  const itens = d.termos.anexoItens.filter((i) => i.descricao.trim() || i.qtd.trim());
  return (
    <section className="contrato-anexo">
      <h2 className="contrato-titulo-anexo">ANEXO 1</h2>
      {itens.length === 0 ? (
        <p className="contrato-anexo-item"><span className="contrato-vazio">{LINHA_VAZIA}</span></p>
      ) : (
        itens.map((item, i) => (
          <p key={i} className="contrato-anexo-item">
            {item.qtd ? `${item.qtd} ` : ''}
            {item.descricao}
          </p>
        ))
      )}
    </section>
  );
}

function rodapeDaContratada(d: DadosContrato): string {
  const k = d.contratada;
  const cidadeUf = k.cidade && k.uf ? `${k.cidade}/${k.uf}` : k.cidade || k.uf;
  const partes = [
    [k.endereco, k.bairro].filter(Boolean).join(' – '),
    cidadeUf,
    k.cep && `CEP: ${k.cep}`,
  ].filter(Boolean);
  const telefone = k.telefone ? ` – Telefone: ${k.telefone}` : '';
  return `${partes.join(' - ')}${telefone}`;
}

export const DocumentoContrato: React.FC<Props> = ({ contrato, empresa, config, destacar = false, secaoEmFoco }) => {
  const d = prepararContrato(contrato, { empresa, config });

  return (
    <div
      className={`folha-pdf folha-contrato bg-white shadow-xl print:shadow-none border border-slate-200 print:border-none max-w-4xl mx-auto ${
        destacar ? 'contrato-destacar' : ''
      }`}
    >
      <table className="contrato-moldura">
        <thead>
          <tr>
            <td>
              {/* A faixa do próprio .docx. Não usa o logo_url do cadastro: ele
                  é o logo do site, e trocar a faixa por ele tiraria o
                  contrato do modelo sem ninguém pedir. */}
              <div className="contrato-cabecalho">
                <img src={cabecalhoContrato} alt="Solar Costa Energia Solar" className="contrato-faixa" />
              </div>
            </td>
          </tr>
        </thead>
        <tfoot>
          <tr>
            <td>
              <div className="contrato-rodape">{rodapeDaContratada(d)}</div>
            </td>
          </tr>
        </tfoot>
        <tbody>
          <tr>
            <td className="contrato-corpo">
              <h1 className="contrato-titulo">{TITULO_CONTRATO}</h1>

              {SECOES.map((s) => (
                <section
                  key={s.chave}
                  data-secao={s.chave}
                  className={`contrato-secao ${secaoEmFoco === s.chave ? 'contrato-secao-foco' : ''}`}
                >
                  {s.titulo && <h2 className="contrato-titulo-clausula">{s.titulo}</h2>}
                  <Blocos blocos={blocosDaSecao(d, s.chave)} d={d} />
                </section>
              ))}

              <Assinaturas d={d} />
              <Anexo d={d} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
