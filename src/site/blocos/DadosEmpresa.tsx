// Bloco de transparência de /sobre: cadastro à esquerda, escritório à direita.
//
// Bloco com LÓGICA: razão social, CNPJ, CREA, endereço, telefone e e-mail saem
// de SolarCosta_Empresa. O que o administrador edita aqui são os títulos e a
// área de atendimento — deixar o CNPJ como texto livre permitiria o site
// mostrar um número diferente do que está no cadastro.

import React from 'react';
import { Building2, ExternalLink, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { Secao, TituloSecao, Cartao } from '../components/Secao';
import { useConfigPublica } from '../contexto';
import { CONTATO_PADRAO, enderecoCompleto } from '../../services/publico';
import type { ConteudoDadosEmpresa } from './tipos';

export const DadosEmpresa: React.FC<{ conteudo: ConteudoDadosEmpresa }> = ({ conteudo: c }) => {
  const { config } = useConfigPublica();
  const empresa = config?.empresa ?? null;

  const telefone = empresa?.telefone || CONTATO_PADRAO.telefone;
  const email = empresa?.email || CONTATO_PADRAO.email;
  const cep = empresa?.cep || CONTATO_PADRAO.cep;
  const endereco = enderecoCompleto(empresa);
  const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${endereco} ${cep}`,
  )}`;

  /** Só o que está cadastrado — nada inventado. */
  const cadastro = [
    { rotulo: 'Razão social', valor: empresa?.razao_social },
    { rotulo: 'Nome fantasia', valor: empresa?.nome_fantasia },
    { rotulo: 'CNPJ', valor: empresa?.cnpj },
    { rotulo: 'Responsável técnico', valor: empresa?.responsavel_tecnico },
    { rotulo: 'CREA', valor: empresa?.crea },
  ].filter((i) => !!i.valor);

  return (
    <Secao claro>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div>
          <TituloSecao
            rotulo={c.rotulo_cadastro}
            titulo={c.titulo_cadastro}
            descricao={c.descricao_cadastro}
          />

          <Cartao className="mt-8" regua="from-emerald-500 to-teal-400">
            <div className="flex items-center gap-2 mb-5">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Registro
              </span>
            </div>
            <dl className="space-y-4">
              {cadastro.map((i) => (
                <div key={i.rotulo} className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <dt className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {i.rotulo}
                  </dt>
                  <dd className="text-sm font-semibold text-slate-900 sm:text-right font-mono">
                    {i.valor}
                  </dd>
                </div>
              ))}
              {cadastro.length === 0 && (
                <p className="text-sm text-slate-500">
                  Dados cadastrais indisponíveis no momento. Fale com a gente pelo telefone{' '}
                  {telefone}.
                </p>
              )}
            </dl>
          </Cartao>
        </div>

        <div>
          <TituloSecao rotulo={c.rotulo_escritorio} titulo={c.titulo_escritorio} />

          <Cartao className="mt-8 space-y-5" regua="from-amber-500 to-orange-400">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 text-marca shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Endereço</p>
                <p className="text-sm font-semibold text-slate-900 mt-1">{endereco}</p>
                <p className="text-sm text-slate-500">CEP {cep}</p>
                <a
                  href={mapa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-marca hover:underline mt-2"
                >
                  Abrir no Google Maps
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3 pt-5 border-t border-slate-100">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Telefone e WhatsApp
                </p>
                <a
                  href={`tel:${telefone.replace(/\D+/g, '')}`}
                  className="text-sm font-semibold text-slate-900 hover:text-marca mt-1 block"
                >
                  {telefone}
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3 pt-5 border-t border-slate-100">
              <div className="p-2.5 rounded-xl bg-violet-50 text-violet-600 shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">E-mail</p>
                <a
                  href={`mailto:${email}`}
                  className="text-sm font-semibold text-slate-900 hover:text-marca mt-1 block break-all"
                >
                  {email}
                </a>
              </div>
            </div>

            {c.area_atendimento && (
              <div className="flex items-start gap-3 pt-5 border-t border-slate-100">
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Área de atendimento
                  </p>
                  <p className="text-sm text-slate-700 mt-1 leading-relaxed">{c.area_atendimento}</p>
                </div>
              </div>
            )}
          </Cartao>
        </div>
      </div>
    </Secao>
  );
};
