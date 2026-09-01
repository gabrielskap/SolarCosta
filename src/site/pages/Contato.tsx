import React from 'react';
import { MapPin, Phone, Mail, MessageCircle, Clock, ExternalLink } from 'lucide-react';
import { useSeo } from '../seo';
import { Secao, Cartao } from '../components/Secao';
import { FormularioLead } from '../components/FormularioLead';
import { CabecalhoPagina } from '../components/CabecalhoPagina';
import { useConfigPublica } from '../contexto';
import { CONTATO_PADRAO, enderecoCompleto, linkWhatsApp } from '../../services/publico';

export const Contato: React.FC = () => {
  useSeo({
    titulo: 'Contato',
    descricao:
      'Fale com a Solar Costa: agende uma visita técnica gratuita para energia solar em Belo Horizonte e região. Telefone, WhatsApp, e-mail e endereço.',
  });

  const { config } = useConfigPublica();
  const empresa = config?.empresa ?? null;

  const telefone = empresa?.telefone || CONTATO_PADRAO.telefone;
  const email = empresa?.email || CONTATO_PADRAO.email;
  const cep = empresa?.cep || CONTATO_PADRAO.cep;
  const endereco = enderecoCompleto(empresa);
  const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${endereco} ${cep}`)}`;

  const canais = [
    {
      Icone: MessageCircle,
      rotulo: 'WhatsApp',
      valor: telefone,
      href: linkWhatsApp(empresa, 'Olá! Vim pelo site da Solar Costa e gostaria de um orçamento.'),
      externo: true,
      cor: 'bg-emerald-50 text-emerald-600',
      nota: 'Resposta mais rápida no horário comercial',
    },
    {
      Icone: Phone,
      rotulo: 'Telefone',
      valor: telefone,
      href: `tel:${telefone.replace(/\D+/g, '')}`,
      cor: 'bg-blue-50 text-marca',
      nota: 'Segunda a sexta',
    },
    {
      Icone: Mail,
      rotulo: 'E-mail',
      valor: email,
      href: `mailto:${email}`,
      cor: 'bg-violet-50 text-violet-600',
      nota: 'Para envio de contas e documentos',
    },
  ];

  return (
    <>
      <CabecalhoPagina
        rotulo="Contato"
        titulo="A visita técnica é gratuita. Vamos marcar?"
        descricao="Escolha o canal que preferir. Se puder, tenha em mãos uma conta de luz recente — é com ela que o consultor começa o dimensionamento."
      />

      <Secao>
        <div className="grid lg:grid-cols-5 gap-6 items-start">
          <div className="lg:col-span-3">
            <FormularioLead
              titulo="Envie seus dados"
              descricao="Chega direto na equipe comercial. Retornamos pelo telefone que você informar."
            />
          </div>

          <div className="lg:col-span-2 space-y-4">
            {canais.map((c) => (
              <a
                key={c.rotulo}
                href={c.href}
                {...(c.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="block bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-marca transition-all group"
              >
                <div className="flex items-start gap-3.5">
                  <div className={`p-2.5 rounded-xl shrink-0 ${c.cor}`}>
                    <c.Icone className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {c.rotulo}
                    </p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5 group-hover:text-marca transition break-all">
                      {c.valor}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{c.nota}</p>
                  </div>
                </div>
              </a>
            ))}

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

            <Cartao className="p-5">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Atendimento
                  </p>
                  <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                    Segunda a sexta, das 8h às 18h. Visitas técnicas também podem ser agendadas aos
                    sábados pela manhã.
                  </p>
                </div>
              </div>
            </Cartao>
          </div>
        </div>
      </Secao>
    </>
  );
};
