// Selo institucional: o símbolo da marca colado nas credenciais que dão
// lastro a ele — CNPJ, responsável técnico e CREA, todos vindos de
// SolarCosta_Empresa.
//
// Logotipo sozinho é decoração. Logotipo ao lado de um registro conferível é
// credencial: quem quiser, checa o CNPJ na Receita e o CREA no conselho.
//
// DIVISÃO DE RESPONSABILIDADE com o CMS: o administrador edita os RÓTULOS e o
// texto de apoio; os VALORES continuam saindo do cadastro da empresa. Deixar
// o CNPJ virar campo de texto livre no editor abriria a porta para o site
// exibir um número que não é o que está no banco.

import React from 'react';
import logoIcon from '../../assets/logo-icon.png';
import { useConfigPublica } from '../contexto';
import { CONTATO_PADRAO } from '../../services/publico';
import { Secao } from './Secao';
import { icone } from '../blocos/icones';
import type { ConteudoSelos } from '../blocos/tipos';

export const SeloCredibilidade: React.FC<{ conteudo: ConteudoSelos }> = ({ conteudo: c }) => {
  const { config } = useConfigPublica();
  const empresa = config?.empresa ?? null;

  /** Valor de cada credencial, na ordem em que os itens foram cadastrados. */
  const valores = [
    {
      valor: empresa?.cnpj ? `CNPJ ${empresa.cnpj}` : 'CNPJ ativo',
      nota: empresa?.razao_social || 'Solar Costa Energia Solar LTDA',
    },
    {
      valor: empresa?.responsavel_tecnico || 'Engenheiro registrado',
      nota: empresa?.crea ? `CREA ${empresa.crea}` : 'Registro no CREA',
    },
    {
      valor: `${empresa?.cidade || CONTATO_PADRAO.cidade}/${empresa?.uf || CONTATO_PADRAO.uf}`,
      nota: '',
    },
  ];

  const itens = (c.itens ?? []).map((item, i) => ({
    ...item,
    valor: valores[i]?.valor ?? '',
    // A nota do cadastro tem prioridade; se ela não existe, vale o texto que o
    // administrador escreveu (é o caso do "E toda a região metropolitana").
    notaFinal: valores[i]?.nota || item.nota || '',
  }));

  return (
    <Secao>
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden grid lg:grid-cols-[19rem_1fr]">
        {/* ------------------------------------------------------ marca -- */}
        <div className="relative bg-marca text-white p-8 flex flex-col items-center justify-center text-center overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                'radial-gradient(circle at 50% 30%, rgba(255,209,0,.22), transparent 60%)',
            }}
          />
          <div className="relative">
            <img
              src={logoIcon}
              alt="Símbolo da Solar Costa"
              className="w-24 h-24 md:w-28 md:h-28 mx-auto drop-shadow-lg"
              width={640}
              height={640}
            />
            <p className="mt-5 text-lg font-black tracking-tight">
              {empresa?.nome_fantasia || 'Solar Costa Energia'}
            </p>
            {c.marca_legenda && (
              <p className="text-[11px] font-bold text-solar tracking-[0.2em] uppercase mt-1.5">
                {c.marca_legenda}
              </p>
            )}
            <div className="w-10 h-1 bg-emerald-500 rounded-full mx-auto mt-4" />
          </div>
        </div>

        {/* ------------------------------------------------ credenciais -- */}
        <div className="p-6 md:p-8">
          {c.rotulo && (
            <span className="text-xs font-bold text-emerald-600 tracking-widest uppercase">
              {c.rotulo}
            </span>
          )}
          <p className="mt-2 text-slate-600 text-sm leading-relaxed max-w-xl">{c.descricao}</p>

          <div className="mt-7 grid gap-6 sm:grid-cols-3">
            {itens.map((item, i) => {
              const Icone = icone(item.icone);
              return (
                <div key={`${item.rotulo}-${i}`}>
                  <div className={`p-2.5 rounded-xl w-fit ${item.cor}`}>
                    <Icone className="w-5 h-5" />
                  </div>
                  <p className="mt-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {item.rotulo}
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-900 leading-snug">{item.valor}</p>
                  <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                    {item.notaFinal}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Secao>
  );
};
