import React, { useState, useEffect } from 'react';
import { 
  Building2, CreditCard, Plus, Trash2, Edit2, Copy, Check, 
  QrCode, Eye, EyeOff, X, User, Shield
} from 'lucide-react';

export interface BankAccount {
  id: string;
  bankName: string;
  accountType: 'Corrente' | 'Poupança' | 'Investimento' | 'Cofre Virtual';
  agency: string;
  accountNumber: string;
  accountHolder: string;
  document: string; // CNPJ / CPF
  pixKey?: string;
  pixType?: 'CNPJ' | 'Email' | 'Telefone' | 'Aleatória';
  managerName?: string;
  managerContact?: string;
  notes?: string;
  color?: string;
}

export interface CorporateCard {
  id: string;
  cardName: string;
  holderName: string;
  lastFourDigits: string;
  brand: 'Mastercard' | 'Visa' | 'Elo' | 'Amex';
  expiryDate: string;
  monthlyLimit?: number;
  pin?: string;
  notes?: string;
}

const BANK_COLORS = [
  { name: 'Itaú Laranja', bg: 'from-orange-950/70 to-slate-950/90 border-orange-500/30' },
  { name: 'Bradesco Vermelho', bg: 'from-red-950/70 to-slate-950/90 border-red-500/30' },
  { name: 'Santander Vermelho', bg: 'from-rose-950/70 to-slate-950/90 border-rose-500/30' },
  { name: 'Nubank Roxo', bg: 'from-purple-950/70 to-slate-950/90 border-purple-500/30' },
  { name: 'Inter Laranja', bg: 'from-amber-950/70 to-slate-950/90 border-amber-500/30' },
  { name: 'Banco do Brasil Azul', bg: 'from-blue-950/70 to-slate-950/90 border-blue-500/30' },
  { name: 'Safra Ouro', bg: 'from-yellow-950/70 to-slate-950/90 border-yellow-500/30' },
  { name: 'Sicoob / Sicredi Verde', bg: 'from-emerald-950/70 to-slate-950/90 border-emerald-500/30' }
];

export const BankingVault: React.FC = () => {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => {
    try {
      const saved = localStorage.getItem('odontomanager_vault_bank_accounts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Error reading bank accounts:', e);
    }
    return [
      {
        id: 'bank_1',
        bankName: 'Banco Itaú Unibanco',
        accountType: 'Corrente',
        agency: '0450',
        accountNumber: '34890-1',
        accountHolder: 'Centro do Sorriso Odontologia LTDA',
        document: '38.456.789/0001-20',
        pixKey: '38.456.789/0001-20',
        pixType: 'CNPJ',
        managerName: 'Ana Claudia (Gerente PJ)',
        managerContact: '(48) 99123-4567',
        notes: 'Conta principal para recebimento de cartões e pagamento de folha.',
        color: BANK_COLORS[0].bg
      },
      {
        id: 'bank_2',
        bankName: 'Banco Santander PJ',
        accountType: 'Investimento',
        agency: '1288',
        accountNumber: '1300984-5',
        accountHolder: 'Centro do Sorriso Odontologia LTDA',
        document: '38.456.789/0001-20',
        pixKey: 'financeiro@centrodosorriso.com.br',
        pixType: 'Email',
        managerName: 'Marcos Vinicius',
        managerContact: '(48) 3344-5500',
        notes: 'Reserva de emergência e aplicações em CDB liquidez diária.',
        color: BANK_COLORS[2].bg
      }
    ];
  });

  const [cards, setCards] = useState<CorporateCard[]>(() => {
    try {
      const saved = localStorage.getItem('odontomanager_vault_corporate_cards');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Error reading corporate cards:', e);
    }
    return [
      {
        id: 'card_1',
        cardName: 'Cartão Corporativo Compras Clínicas',
        holderName: 'ALEXANDER ROSS',
        lastFourDigits: '4892',
        brand: 'Mastercard',
        expiryDate: '08/29',
        monthlyLimit: 25000,
        pin: '8841',
        notes: 'Usado para compra de insumos, próteses e anúncios Meta/Google.'
      }
    ];
  });

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [visiblePins, setVisiblePins] = useState<Record<string, boolean>>({});

  // Bank Modal State
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [bankFormData, setBankFormData] = useState<Partial<BankAccount>>({});

  // Card Modal State
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardFormData, setCardFormData] = useState<Partial<CorporateCard>>({});

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('odontomanager_vault_bank_accounts', JSON.stringify(bankAccounts));
    } catch (e) {
      console.warn('Error writing bank accounts:', e);
    }
  }, [bankAccounts]);

  useEffect(() => {
    try {
      localStorage.setItem('odontomanager_vault_corporate_cards', JSON.stringify(cards));
    } catch (e) {
      console.warn('Error writing corporate cards:', e);
    }
  }, [cards]);

  const copyText = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveBank = () => {
    if (!bankFormData.bankName || !bankFormData.agency || !bankFormData.accountNumber) return;

    const newBank: BankAccount = {
      id: editingBankId || 'bank_' + Date.now(),
      bankName: bankFormData.bankName.trim(),
      accountType: bankFormData.accountType || 'Corrente',
      agency: bankFormData.agency.trim(),
      accountNumber: bankFormData.accountNumber.trim(),
      accountHolder: bankFormData.accountHolder?.trim() || 'Centro do Sorriso',
      document: bankFormData.document?.trim() || '',
      pixKey: bankFormData.pixKey?.trim() || '',
      pixType: bankFormData.pixType || 'CNPJ',
      managerName: bankFormData.managerName?.trim() || '',
      managerContact: bankFormData.managerContact?.trim() || '',
      notes: bankFormData.notes?.trim() || '',
      color: bankFormData.color || BANK_COLORS[0].bg
    };

    if (editingBankId) {
      setBankAccounts(prev => prev.map(b => b.id === editingBankId ? newBank : b));
    } else {
      setBankAccounts(prev => [...prev, newBank]);
    }

    setIsBankModalOpen(false);
    setBankFormData({});
  };

  const handleDeleteBank = (id: string) => {
    if (!confirm('Excluir esta conta bancária do cofre seguro?')) return;
    setBankAccounts(prev => prev.filter(b => b.id !== id));
  };

  const handleSaveCard = () => {
    if (!cardFormData.cardName || !cardFormData.lastFourDigits) return;

    const newCard: CorporateCard = {
      id: editingCardId || 'card_' + Date.now(),
      cardName: cardFormData.cardName.trim(),
      holderName: cardFormData.holderName?.trim() || '',
      lastFourDigits: cardFormData.lastFourDigits.trim(),
      brand: cardFormData.brand || 'Mastercard',
      expiryDate: cardFormData.expiryDate?.trim() || '',
      monthlyLimit: cardFormData.monthlyLimit || 0,
      pin: cardFormData.pin?.trim() || '',
      notes: cardFormData.notes?.trim() || ''
    };

    if (editingCardId) {
      setCards(prev => prev.map(c => c.id === editingCardId ? newCard : c));
    } else {
      setCards(prev => [...prev, newCard]);
    }

    setIsCardModalOpen(false);
    setCardFormData({});
  };

  const handleDeleteCard = (id: string) => {
    if (!confirm('Excluir este cartão corporativo do cofre seguro?')) return;
    setCards(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 md:p-8 custom-scrollbar">
      <div className="max-w-6xl w-full mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/60 border border-border p-4 md:p-6 rounded-3xl backdrop-blur-sm">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-400">
              <Building2 className="w-4 h-4" />
              <span>Contas & Chaves Pix da Gestão</span>
            </div>
            <h2 className="text-2xl font-bold text-text mt-1">Dados Bancários & Cartões Confidenciais</h2>
            <p className="text-xs text-slate-400">Informações bancárias centralizadas para cópia rápida e controle seguro da gerência.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setEditingCardId(null);
                setCardFormData({ brand: 'Mastercard' });
                setIsCardModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-panel hover:bg-surface border border-border text-slate-300 text-xs font-bold flex items-center gap-2 transition-all"
            >
              <CreditCard className="w-4 h-4 text-purple-400" />
              <span>+ Novo Cartão</span>
            </button>
            <button
              onClick={() => {
                setEditingBankId(null);
                setBankFormData({ accountType: 'Corrente', color: BANK_COLORS[0].bg });
                setIsBankModalOpen(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nova Conta Bancária</span>
            </button>
          </div>
        </div>

        {/* ================= CONTAS BANCÁRIAS ================= */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-text uppercase tracking-widest flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-400" /> Contas Bancárias Cadastradas ({bankAccounts.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {bankAccounts.map(bank => (
              <div
                key={bank.id}
                className={`p-6 rounded-3xl border bg-gradient-to-br ${bank.color || BANK_COLORS[0].bg} flex flex-col justify-between gap-5 relative group shadow-lg transition-all hover:scale-[1.01]`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <span className="px-2.5 py-0.5 rounded-md bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider">
                        {bank.accountType}
                      </span>
                      <h4 className="text-lg font-bold text-white mt-1.5">{bank.bankName}</h4>
                      <p className="text-xs text-slate-300 font-medium">{bank.accountHolder}</p>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingBankId(bank.id);
                          setBankFormData({ ...bank });
                          setIsBankModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg bg-black/40 hover:bg-black/70 text-slate-300 hover:text-white"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteBank(bank.id)}
                        className="p-1.5 rounded-lg bg-black/40 hover:bg-rose-900/60 text-slate-300 hover:text-rose-300"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Account Numbers Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-black/30 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Agência</span>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono font-bold text-white">{bank.agency}</span>
                        <button
                          onClick={() => copyText(bank.agency, bank.id + '_ag')}
                          className="p-1 text-slate-400 hover:text-white"
                          title="Copiar Agência"
                        >
                          {copiedKey === bank.id + '_ag' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="bg-black/30 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Conta Corrente</span>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono font-bold text-white">{bank.accountNumber}</span>
                        <button
                          onClick={() => copyText(bank.accountNumber, bank.id + '_cc')}
                          className="p-1 text-slate-400 hover:text-white"
                          title="Copiar Conta"
                        >
                          {copiedKey === bank.id + '_cc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* CNPJ / CPF & Pix Key */}
                  <div className="space-y-2">
                    {bank.document && (
                      <div className="bg-black/20 p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs text-slate-300 font-mono">{bank.document}</span>
                        </div>
                        <button
                          onClick={() => copyText(bank.document, bank.id + '_doc')}
                          className="p-1 text-slate-400 hover:text-white"
                          title="Copiar Documento"
                        >
                          {copiedKey === bank.id + '_doc' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}

                    {bank.pixKey && (
                      <div className="bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <QrCode className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider block">Chave Pix ({bank.pixType || 'Pix'})</span>
                            <span className="text-xs font-mono font-bold text-white truncate block">{bank.pixKey}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => copyText(bank.pixKey!, bank.id + '_pix')}
                          className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                        >
                          {copiedKey === bank.id + '_pix' ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === bank.id + '_pix' ? 'Copiado' : 'Copiar Pix'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Manager Contact & Notes */}
                {(bank.managerName || bank.notes) && (
                  <div className="pt-3 border-t border-white/10 text-xs text-slate-300 flex flex-col gap-1">
                    {bank.managerName && (
                      <div className="flex items-center gap-2 text-slate-300">
                        <User className="w-3 h-3 text-slate-400" />
                        <span className="font-semibold">{bank.managerName}</span>
                        {bank.managerContact && (
                          <span className="text-slate-400 font-mono">({bank.managerContact})</span>
                        )}
                      </div>
                    )}
                    {bank.notes && (
                      <p className="text-[11px] text-slate-400 italic">{bank.notes}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ================= CARTÕES CORPORATIVOS ================= */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-text uppercase tracking-widest flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-purple-400" /> Cartões Corporativos da Gestão ({cards.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {cards.map(card => (
              <div
                key={card.id}
                className="bg-gradient-to-br from-slate-900 via-purple-950/40 to-slate-950 p-6 rounded-3xl border border-purple-500/20 shadow-xl flex flex-col justify-between h-56 relative group hover:border-purple-500/40 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">Cartão Empresarial</span>
                      <h4 className="text-sm font-bold text-white">{card.cardName}</h4>
                    </div>
                    <span className="text-xs font-bold text-slate-300 px-2 py-0.5 rounded bg-white/10">{card.brand}</span>
                  </div>

                  {/* Card Number display */}
                  <div className="my-6">
                    <span className="text-lg font-mono tracking-widest font-bold text-white flex items-center gap-2">
                      •••• •••• •••• <strong className="text-purple-300">{card.lastFourDigits}</strong>
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-end justify-between text-xs">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Titular</span>
                      <span className="font-semibold text-white uppercase">{card.holderName}</span>
                    </div>

                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Validade</span>
                      <span className="font-mono font-bold text-white">{card.expiryDate || '••/••'}</span>
                    </div>

                    {card.pin && (
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Senha/PIN</span>
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-bold text-purple-300">
                            {visiblePins[card.id] ? card.pin : '••••'}
                          </span>
                          <button
                            onClick={() => setVisiblePins(p => ({ ...p, [card.id]: !p[card.id] }))}
                            className="text-slate-400 hover:text-white"
                          >
                            {visiblePins[card.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Edit & Delete Action Overlay */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingCardId(card.id);
                      setCardFormData({ ...card });
                      setIsCardModalOpen(true);
                    }}
                    className="p-1 rounded-lg bg-black/50 hover:bg-black text-slate-300 hover:text-white"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteCard(card.id)}
                    className="p-1 rounded-lg bg-black/50 hover:bg-rose-900 text-slate-300 hover:text-rose-300"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ================= MODAL NOVA CONTA BANCÁRIA ================= */}
      {isBankModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-bold text-text">
                {editingBankId ? 'Editar Conta Bancária' : 'Nova Conta Bancária Segura'}
              </h3>
              <button onClick={() => setIsBankModalOpen(false)} className="text-slate-400 hover:text-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Banco *</label>
                  <input
                    type="text"
                    value={bankFormData.bankName || ''}
                    onChange={e => setBankFormData({ ...bankFormData, bankName: e.target.value })}
                    placeholder="Ex: Itaú, Santander, Nubank..."
                    className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Tipo de Conta</label>
                  <select
                    value={bankFormData.accountType || 'Corrente'}
                    onChange={e => setBankFormData({ ...bankFormData, accountType: e.target.value as any })}
                    className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none"
                  >
                    <option value="Corrente">Conta Corrente</option>
                    <option value="Poupança">Poupança</option>
                    <option value="Investimento">Investimentos / Aplicação</option>
                    <option value="Cofre Virtual">Cofre Virtual</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Agência *</label>
                  <input
                    type="text"
                    value={bankFormData.agency || ''}
                    onChange={e => setBankFormData({ ...bankFormData, agency: e.target.value })}
                    placeholder="Ex: 0450"
                    className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text font-mono outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Número da Conta *</label>
                  <input
                    type="text"
                    value={bankFormData.accountNumber || ''}
                    onChange={e => setBankFormData({ ...bankFormData, accountNumber: e.target.value })}
                    placeholder="Ex: 34890-1"
                    className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text font-mono outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Titular da Conta</label>
                  <input
                    type="text"
                    value={bankFormData.accountHolder || ''}
                    onChange={e => setBankFormData({ ...bankFormData, accountHolder: e.target.value })}
                    placeholder="Ex: Centro do Sorriso Odontologia"
                    className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">CNPJ / CPF</label>
                  <input
                    type="text"
                    value={bankFormData.document || ''}
                    onChange={e => setBankFormData({ ...bankFormData, document: e.target.value })}
                    placeholder="Ex: 38.456.789/0001-20"
                    className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text font-mono outline-none"
                  />
                </div>
              </div>

              {/* Pix Info */}
              <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl space-y-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Dados do Pix</span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo de Chave</label>
                    <select
                      value={bankFormData.pixType || 'CNPJ'}
                      onChange={e => setBankFormData({ ...bankFormData, pixType: e.target.value as any })}
                      className="w-full bg-panel border border-border rounded-lg p-1.5 text-xs text-text outline-none"
                    >
                      <option value="CNPJ">CNPJ</option>
                      <option value="Email">E-mail</option>
                      <option value="Telefone">Telefone</option>
                      <option value="Aleatória">Aleatória</option>
                    </select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Chave Pix</label>
                    <input
                      type="text"
                      value={bankFormData.pixKey || ''}
                      onChange={e => setBankFormData({ ...bankFormData, pixKey: e.target.value })}
                      placeholder="Chave Pix para transferências..."
                      className="w-full bg-panel border border-border rounded-lg px-2.5 py-1.5 text-xs text-text font-mono outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Manager info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Nome do Gerente PJ</label>
                  <input
                    type="text"
                    value={bankFormData.managerName || ''}
                    onChange={e => setBankFormData({ ...bankFormData, managerName: e.target.value })}
                    placeholder="Ex: Carlos Santos"
                    className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Contato / WhatsApp Gerente</label>
                  <input
                    type="text"
                    value={bankFormData.managerContact || ''}
                    onChange={e => setBankFormData({ ...bankFormData, managerContact: e.target.value })}
                    placeholder="Ex: (48) 99999-0000"
                    className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none"
                  />
                </div>
              </div>

              {/* Color Preset */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Tema do Cartão</label>
                <div className="grid grid-cols-4 gap-2">
                  {BANK_COLORS.map(c => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setBankFormData({ ...bankFormData, color: c.bg })}
                      className={`h-8 rounded-xl border bg-gradient-to-r ${c.bg} ${
                        bankFormData.color === c.bg ? 'ring-2 ring-emerald-400' : 'opacity-70 hover:opacity-100'
                      }`}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Notas & Instruções</label>
                <textarea
                  value={bankFormData.notes || ''}
                  onChange={e => setBankFormData({ ...bankFormData, notes: e.target.value })}
                  placeholder="Finalidade da conta, limites negociados..."
                  className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none min-h-[60px] resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-border bg-panel flex justify-end gap-2">
              <button onClick={() => setIsBankModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-text text-xs font-bold">
                Cancelar
              </button>
              <button
                onClick={handleSaveBank}
                disabled={!bankFormData.bankName || !bankFormData.agency || !bankFormData.accountNumber}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Salvar Conta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL NOVO CARTÃO CORPORATIVO ================= */}
      {isCardModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-bold text-text">
                {editingCardId ? 'Editar Cartão' : 'Novo Cartão Corporativo'}
              </h3>
              <button onClick={() => setIsCardModalOpen(false)} className="text-slate-400 hover:text-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Apelido do Cartão *</label>
                <input
                  type="text"
                  value={cardFormData.cardName || ''}
                  onChange={e => setCardFormData({ ...cardFormData, cardName: e.target.value })}
                  placeholder="Ex: Cartão Compras Clínicas, Cartão Sócios..."
                  className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none focus:border-purple-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Bandeira</label>
                  <select
                    value={cardFormData.brand || 'Mastercard'}
                    onChange={e => setCardFormData({ ...cardFormData, brand: e.target.value as any })}
                    className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none font-bold"
                  >
                    <option value="Mastercard">Mastercard</option>
                    <option value="Visa">Visa</option>
                    <option value="Elo">Elo</option>
                    <option value="Amex">American Express</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Últimos 4 Dígitos *</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={cardFormData.lastFourDigits || ''}
                    onChange={e => setCardFormData({ ...cardFormData, lastFourDigits: e.target.value })}
                    placeholder="Ex: 4892"
                    className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text font-mono font-bold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Nome Impresso no Cartão</label>
                  <input
                    type="text"
                    value={cardFormData.holderName || ''}
                    onChange={e => setCardFormData({ ...cardFormData, holderName: e.target.value.toUpperCase() })}
                    placeholder="Ex: ALEXANDER ROSS"
                    className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text uppercase outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Vencimento (MM/AA)</label>
                  <input
                    type="text"
                    maxLength={5}
                    value={cardFormData.expiryDate || ''}
                    onChange={e => setCardFormData({ ...cardFormData, expiryDate: e.target.value })}
                    placeholder="Ex: 08/29"
                    className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text font-mono outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Limite Mensal (R$)</label>
                  <input
                    type="number"
                    value={cardFormData.monthlyLimit || ''}
                    onChange={e => setCardFormData({ ...cardFormData, monthlyLimit: Number(e.target.value) })}
                    placeholder="Ex: 25000"
                    className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">PIN / Senha de Compra</label>
                  <input
                    type="password"
                    maxLength={6}
                    value={cardFormData.pin || ''}
                    onChange={e => setCardFormData({ ...cardFormData, pin: e.target.value })}
                    placeholder="Ex: 8841"
                    className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text font-mono outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Observações</label>
                <textarea
                  value={cardFormData.notes || ''}
                  onChange={e => setCardFormData({ ...cardFormData, notes: e.target.value })}
                  placeholder="Finalidades autorizadas, fatura débito automático..."
                  className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none min-h-[60px] resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-border bg-panel flex justify-end gap-2">
              <button onClick={() => setIsCardModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-text text-xs font-bold">
                Cancelar
              </button>
              <button
                onClick={handleSaveCard}
                disabled={!cardFormData.cardName || !cardFormData.lastFourDigits}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Salvar Cartão
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
