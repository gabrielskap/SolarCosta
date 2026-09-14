// Página de contato: formulário à esquerda, canais e escritório à direita.
//
// Bloco com LÓGICA. O administrador edita rótulos, notas, horário e a mensagem
// que abre no WhatsApp; o DESTINO de cada canal é derivado do cadastro da
// empresa pelo `tipo` do item (whatsapp | telefone | email). Guardar o número
// como texto no conteúdo criaria uma segunda fonte de verdade para o telefone.

import React from 'react';
import { Clock, ExternalLink, MapPin } from 'lucide-react';
import { Secao, Cartao } from '../components/Secao';
import { FormularioLead } from '../components/FormularioLead';
import { useConfigPublica } from '../contexto';
import { CONTATO_PADRAO, enderecoCompleto, linkWhatsApp } from '../../services/publico';
import { icone } from './icones';
import type { ConteudoContatoCanais } from './tipos';

export const ContatoCanais: React.FC<{ conteudo: ConteudoContatoCanais }> = ({ conteudo: c }) => {
  const { config } = useConfigPublica();
  const empresa = config?.empresa ?? null;

  const telefone = empresa?.telefone || CONTATO_PADRAO.telefone;
  const email = empresa?.email || CONTATO_PADRAO.email;
  const cep = empresa?.cep || CONTATO_PADRAO.cep;
  const endereco = enderecoCompleto(empresa);
  const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${endereco} ${cep}`,
  )}`;

  /** Valor visível e href de cada canal, pelo tipo. */
  function destino(tipo: string): { valor: string; href: string; externo: boolean } {
    if (tipo === 'whatsapp') {
      return {
        valor: telefone,
        href: linkWhatsApp(empresa, c.mensagem_whatsapp || 'Olá! Vim pelo site da Solar Costa.'),
        externo: true,
      };
    }
    if (tipo === 'email') {
      return { valor: email, href: `mailto:${email}`, externo: false };
    }
    return { valor: telefone, href: `tel:${telefone.replace(/\D+/g, '')}`, externo: false };
  }

  return (
    <Secao>
      <div className="grid lg:grid-cols-5 gap-6 items-start">
        <div className="lg:col-span-3">
          <FormularioLead titulo={c.formulario_titulo} descricao={c.formulario_descricao} />
        </div>

        <div className="lg:col-span-2 space-y-4">
          {(c.canais ?? []).map((canal, i) => {
            const Icone = icone(canal.icone);
            const d = destino(canal.tipo);
            return (
              <a
                key={i}
                href={d.href}
                {...(d.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="block bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-marca transition-all group"
              >
                <div className="flex items-start gap-3.5">
                  <div className={`p-2.5 rounded-xl shrink-0 ${canal.cor}`}>
                    <Icone className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {canal.rotulo}
                    </p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5 group-hover:text-marca transition break-all">
                      {d.valor}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{canal.nota}</p>
                  </div>
                </div>
              </a>
            );
          })}

          <Cartao className="p-5" regua="from-amber-500 to-orange-400">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Escritório
                </p>
                <p className="text-sm font-semibold text-slate-900 mt-1 leading-relaxed">
                  {endereco}
                </p>
                <p className="text-sm text-slate-500">CEP {cep}</p>
                <a
                  href={mapa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-marca hover:underline mt-2"
                >
                  Ver no mapa
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </Cartao>

          {c.horario_texto && (
            <Cartao className="p-5">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {c.horario_rotulo}
                  </p>
                  <p className="text-sm text-slate-700 mt-1 leading-relaxed">{c.horario_texto}</p>
                </div>
              </div>
            </Cartao>
          )}
        </div>
      </div>
    </Secao>
  );
};
