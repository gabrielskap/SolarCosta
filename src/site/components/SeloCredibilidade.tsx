// Selo institucional: o símbolo da marca colado nas credenciais que dão
// lastro a ele — CNPJ, responsável técnico e CREA, todos vindos de
// SolarCosta_Empresa.
//
// Logotipo sozinho é decoração. Logotipo ao lado de um registro conferível é
// credencial: quem quiser, checa o CNPJ na Receita e o CREA no conselho.
//
// TODO (Solar Costa): quando houver os números consolidados — clientes
// atendidos, kWp instalados, anos de operação — dá para acrescentar um quarto
// item aqui. Não preencher com estimativa: vira promessa comercial.

import React from 'react';
import { ShieldCheck, FileCheck2, MapPin } from 'lucide-react';
import logoIcon from '../../assets/logo-icon.png';
import { useConfigPublica } from '../contexto';
import { CONTATO_PADRAO } from '../../services/publico';
import { Secao } from './Secao';

export const SeloCredibilidade: React.FC = () => {
  const { config } = useConfigPublica();
  const empresa = config?.empresa ?? null;

  const credenciais = [
    {
      Icone: FileCheck2,
      rotulo: 'Empresa formalizada',
      valor: empresa?.cnpj ? `CNPJ ${empresa.cnpj}` : 'CNPJ ativo',
      nota: empresa?.razao_social || 'Solar Costa Energia Solar LTDA',
      cor: 'bg-blue-50 text-marca',
    },
    {
      Icone: ShieldCheck,
      rotulo: 'Responsável técnico',
      valor: empresa?.responsavel_tecnico || 'Engenheiro registrado',
      nota: empresa?.crea ? `CREA ${empresa.crea}` : 'Registro no CREA',
      cor: 'bg-emerald-50 text-emerald-600',
    },
    {
      Icone: MapPin,
      rotulo: 'Onde atendemos',
      valor: `${empresa?.cidade || CONTATO_PADRAO.cidade}/${empresa?.uf || CONTATO_PADRAO.uf}`,
      nota: 'E toda a região metropolitana',
      cor: 'bg-amber-50 text-amber-600',
    },
  ];

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
            <p className="text-[11px] font-bold text-solar tracking-[0.2em] uppercase mt-1.5">
              Energia Solar
            </p>
            <div className="w-10 h-1 bg-emerald-500 rounded-full mx-auto mt-4" />
          </div>
        </div>

        {/* ------------------------------------------------ credenciais -- */}
        <div className="p-6 md:p-8">
          <span className="text-xs font-bold text-emerald-600 tracking-widest uppercase">
            Quem está por trás
          </span>
          <p className="mt-2 text-slate-600 text-sm leading-relaxed max-w-xl">
            Energia solar é obra elétrica ligada à rede da concessionária. Antes de fechar com
            qualquer empresa, confira o CNPJ e o registro do responsável técnico. Os nossos estão
            aqui.
          </p>

          <div className="mt-7 grid gap-6 sm:grid-cols-3">
            {credenciais.map((c) => (
              <div key={c.rotulo}>
                <div className={`p-2.5 rounded-xl w-fit ${c.cor}`}>
                  <c.Icone className="w-5 h-5" />
                </div>
                <p className="mt-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {c.rotulo}
                </p>
                <p className="mt-1 text-sm font-black text-slate-900 leading-snug">{c.valor}</p>
                <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">{c.nota}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Secao>
  );
};
