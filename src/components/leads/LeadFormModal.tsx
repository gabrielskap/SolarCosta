import React, { useState } from 'react';
import { X, Loader2, MapPinned } from 'lucide-react';
import { Lead, User as UserType } from '../../types';
import {
  maskCPFCNPJ, maskPhone, maskCEP, onlyDigits, docLabel,
  isValidCPFCNPJ, isValidEmail, isValidPhoneBR,
} from '../../utils/format';
import { fetchAddressByCep, buildEnderecoLine, buildCidadeUf } from '../../services/cep';

interface LeadFormModalProps {
  /** Lead sendo editado; ausente = modo de criação. */
  lead?: Lead;
  users: UserType[];
  currentUser: UserType;
  onClose: () => void;
  onCreateLead: (newLead: Partial<Lead>) => void;
  /** Só é usado em modo edição — o Kanban (só cria) pode omitir. */
  onUpdateLead?: (updatedLead: Lead) => void;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

export const LeadFormModal: React.FC<LeadFormModalProps> = ({
  lead, users, currentUser, onClose, onCreateLead, onUpdateLead, showToast,
}) => {
  const [nome, setNome] = useState(lead?.nome ?? '');
  const [cpfCnpj, setCpfCnpj] = useState(lead?.cpfCnpj ?? '');
  const [telefone, setTelefone] = useState(lead?.telefone ?? '');
  const [email, setEmail] = useState(lead?.email ?? '');
  const [cidade, setCidade] = useState(lead?.cidade ?? 'Belo Horizonte/MG');
  const [endereco, setEndereco] = useState(lead?.endereco ?? '');
  const [consumo, setConsumo] = useState(lead?.consumoKwh ?? 800);
  const [concessionaria, setConcessionaria] = useState(lead?.concessionaria ?? 'CEMIG');
  const [telhado, setTelhado] = useState(lead?.telhado ?? 'Colonial');
  const [origem, setOrigem] = useState(lead?.origem ?? 'Google Ads');
  const [responsavel, setResponsavel] = useState(lead?.responsavel ?? currentUser.nome);
  const [cep, setCep] = useState(lead?.cep ?? '');
  const [cepLoading, setCepLoading] = useState(false);

  // Integração CEP -> endereço (ViaCEP). Preenche endereço e cidade/UF.
  const handleCepLookup = async (cepValue: string) => {
    if (onlyDigits(cepValue).length !== 8) return;
    setCepLoading(true);
    const result = await fetchAddressByCep(cepValue);
    setCepLoading(false);
    if (!result.ok || !result.endereco) {
      showToast('CEP não encontrado', 'error', result.erro || 'Verifique o CEP informado.');
      return;
    }
    const linha = buildEnderecoLine(result.endereco);
    if (linha) setEndereco(linha);
    const cidadeUf = buildCidadeUf(result.endereco);
    if (cidadeUf) setCidade(cidadeUf);
    showToast('Endereço preenchido', 'success', `${linha || cidadeUf} (via ViaCEP).`);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) return;

    // Validação dos campos preenchidos (todos opcionais exceto o nome).
    if (cpfCnpj && !isValidCPFCNPJ(cpfCnpj)) {
      showToast('Documento inválido', 'error', `Verifique o ${docLabel(cpfCnpj)} informado.`);
      return;
    }
    if (email && !isValidEmail(email)) {
      showToast('E-mail inválido', 'error', 'Informe um e-mail no formato nome@dominio.com.');
      return;
    }
    if (telefone && !isValidPhoneBR(telefone)) {
      showToast('Telefone inválido', 'error', 'Informe DDD + número (10 ou 11 dígitos).');
      return;
    }

    const camposComuns = {
      nome,
      cpfCnpj,
      telefone,
      email,
      cidade,
      endereco,
      cep: cep || undefined,
      consumoKwh: Number(consumo),
      concessionaria,
      telhado,
      origem,
      responsavel,
    };

    if (lead) {
      // Edição: preserva id/numero/etapa/valor/documentos/histórico do lead original —
      // esses campos não fazem parte do formulário, então não podem ser sobrescritos aqui.
      onUpdateLead?.({ ...lead, ...camposComuns });
    } else {
      // Estimated value: kWp calculation ~ consumo / 117 * 21000
      const estKwp = Number((consumo / 117.3).toFixed(2));
      const estValor = Math.round(estKwp * 2639);

      onCreateLead({
        ...camposComuns,
        etapa: 'Novo lead',
        valor: estValor > 10000 ? estValor : 18500,
      });
    }

    onClose();
  };

  // Indicadores de validação em tempo real (só sinalizam quando há conteúdo).
  const cpfInvalido = !!cpfCnpj && !isValidCPFCNPJ(cpfCnpj);
  const emailInvalido = !!email && !isValidEmail(email);
  const telefoneInvalido = !!telefone && !isValidPhoneBR(telefone);
  const fieldBase = 'w-full p-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-none';
  const okBorder = 'border-slate-200 focus:border-[#004276]';
  const errBorder = 'border-rose-300 focus:border-rose-500 bg-rose-50/40';

  return (
    <div className="modal-overlay fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="modal-painel bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in">
        <div className="modal-cabecalho bg-[#004276] text-white p-5 flex items-center justify-between">
          <h3 className="font-bold text-lg">{lead ? 'Editar Lead' : 'Novo Lead de Energia Solar'}</h3>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="modal-corpo p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Nome Completo / Razão Social *
              </label>
              <input
                type="text"
                required
                autoComplete="name"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: João da Silva / Padaria Sol"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                {docLabel(cpfCnpj)}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(maskCPFCNPJ(e.target.value))}
                placeholder="000.000.000-00"
                className={`${fieldBase} ${cpfInvalido ? errBorder : okBorder}`}
              />
              {cpfInvalido && <p className="text-[11px] text-rose-600 font-semibold mt-1">{docLabel(cpfCnpj)} inválido</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Telefone / WhatsApp
              </label>
              <input
                type="text"
                inputMode="tel"
                value={telefone}
                onChange={(e) => setTelefone(maskPhone(e.target.value))}
                placeholder="(31) 99999-8888"
                className={`${fieldBase} ${telefoneInvalido ? errBorder : okBorder}`}
              />
              {telefoneInvalido && <p className="text-[11px] text-rose-600 font-semibold mt-1">Telefone incompleto</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@email.com"
                className={`${fieldBase} ${emailInvalido ? errBorder : okBorder}`}
              />
              {emailInvalido && <p className="text-[11px] text-rose-600 font-semibold mt-1">E-mail inválido</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                CEP
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={cep}
                  onChange={(e) => {
                    const masked = maskCEP(e.target.value);
                    setCep(masked);
                    if (onlyDigits(masked).length === 8) handleCepLookup(masked);
                  }}
                  onBlur={() => handleCepLookup(cep)}
                  placeholder="00000-000"
                  className={`${fieldBase} ${okBorder} pr-9`}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  {cepLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPinned className="w-4 h-4" />}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Preenche endereço automaticamente (ViaCEP)</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Cidade / UF
              </label>
              <input
                type="text"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Belo Horizonte/MG"
                className={`${fieldBase} ${okBorder}`}
              />
            </div>

            <div className="col-span-1 sm:col-span-2">
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Endereço Completo
              </label>
              <input
                type="text"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, número, bairro..."
                className={`${fieldBase} ${okBorder}`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Consumo Médio (kWh/mês)
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={consumo}
                onChange={(e) => setConsumo(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Tipo de Telhado
              </label>
              <select
                value={telhado}
                onChange={(e) => setTelhado(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276]"
              >
                <option value="Colonial">Colonial</option>
                <option value="Laje">Laje</option>
                <option value="Metálico">Metálico</option>
                <option value="Fibrocimento">Fibrocimento</option>
                <option value="Solo/Estrutura">Solo/Estrutura</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Origem do Lead
              </label>
              <select
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276]"
              >
                <option value="Google Ads">Google Ads</option>
                <option value="Indicação">Indicação</option>
                <option value="Instagram">Instagram</option>
                <option value="Prospecção Ativa">Prospecção Ativa</option>
                <option value="Site Solar Costa">Site Solar Costa</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Vendedor Responsável
              </label>
              <select
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276]"
              >
                {users.map(u => (
                  <option key={u.id} value={u.nome}>{u.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="barra-acoes bg-white pt-4 border-t flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-xl text-sm hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#004276] hover:bg-[#003159] text-white font-bold rounded-xl text-sm shadow"
            >
              {lead ? 'Salvar Alterações' : 'Cadastrar Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
