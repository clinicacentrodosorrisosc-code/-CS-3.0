import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
    FileText, 
    Database, 
    ClipboardList, 
    DollarSign, 
    Users, 
    Briefcase, 
    Settings, 
    BarChart, 
    Plus, 
    Trash2, 
    Search,
    Check,
    Edit2,
    Edit,
    List,
    X,
    RefreshCw,
    AlertCircle,
    HelpCircle,
    Info,
    Zap,
    Download
} from 'lucide-react';
import { PieChart, Pie, Cell } from 'recharts';
import { Service } from '../types';
import { initialRawMaterials, RawMaterial } from '../data/rawMaterials';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';

type PricingTab = 'produtos' | 'materia_prima' | 'ficha_tecnica' | 'precificacao' | 'pagamento' | 'fixas' | 'cenarios' | 'relatorios';

interface TabDefinition {
    id: PricingTab;
    label: string;
    icon: React.ElementType;
}

const tabs: TabDefinition[] = [
    { id: 'produtos', label: 'Cadastro de Produtos', icon: Database },
    { id: 'materia_prima', label: 'Matéria Prima', icon: FileText },
    { id: 'ficha_tecnica', label: 'Ficha Técnica', icon: ClipboardList },
    { id: 'precificacao', label: 'Tabela de Precificação', icon: DollarSign },
    { id: 'pagamento', label: 'Folha de Pagamento', icon: Users },
    { id: 'fixas', label: 'Despesas Fixas', icon: Briefcase },
    { id: 'cenarios', label: 'Simulação de Cenários', icon: Settings },
    { id: 'relatorios', label: 'Relatórios Gerenciais', icon: BarChart },
];

interface FichaTecnicaItem {
    materialId?: number;
    employeeId?: string;
    quantity: number;
}

interface ServiceSetting {
    cHora: number;
    time: number;
    cDireto: number;
    cLaboratorio: number;
    mLiquida: number;
    tTributos: number;
    tFinanceira: number;
    cComissao: number;
    precoPraticado?: number;
}

export interface PayrollEmployee {
    id: string;
    code: string;
    name: string;
    salary: number;
    sector: string;
    role: string;
    contractType: 'CLT' | 'PJ' | 'Dentista' | 'Autônomo';
    valeTransporte: number;
    valeRefeicao: number;
    convenioMedico: number;
    hoursPerMonth: number;
}

export interface FixedExpenseItem {
    id: string;
    description: string;
    value: number | null;
    isHighlighted?: boolean;
}

export const initialFixedExpenses: FixedExpenseItem[] = [
    { id: '1', description: 'Salários + Encargos + Benefícios', value: 12900.00 },
    { id: '2', description: 'Energia Elétrica', value: 350.00 },
    { id: '3', description: 'Aluguel + IPTU', value: 2200.00 },
    { id: '4', description: 'Alarme + Segurança', value: null },
    { id: '5', description: 'Internet + Telefone', value: 150.00 },
    { id: '6', description: 'Água', value: 180.00 },
    { id: '7', description: 'Pró-Labore', value: 7000.00 },
    { id: '8', description: 'Contabilidade', value: 539.00 },
    { id: '9', description: 'Suporte de TI', value: null },
    { id: '10', description: 'Sistemas de Gestão', value: 220.00 },
    { id: '11', description: 'Publicidade e Marketing', value: 3000.00 },
    { id: '12', description: 'Combustível', value: null },
    { id: '13', description: 'Manutenção Predial', value: null },
    { id: '14', description: 'Manutenção de Carros', value: null },
    { id: '15', description: 'Material de Escritório', value: 130.00 },
    { id: '16', description: 'Empréstimo Giro Pronamp C615', value: 2150.00 },
    { id: '17', description: 'Empréstimo Giro Pronamp C286', value: 850.00 },
    { id: '18', description: 'Empréstimo Kgiro Fampe C246', value: 1957.20 },
    { id: '19', description: 'Empréstimo PRC Renegociação PJ', value: 2465.63 },
    { id: '20', description: 'Creditas', value: 1519.88 },
    { id: '21', description: 'Nubank', value: 1300.00 },
    { id: '22', description: 'Nubank', value: 350.00 },
    { id: '23', description: 'Parcela Clinica 9000', value: null },
    { id: '24', description: 'CRO', value: 210.12 },
    { id: '25', description: 'Material Odontológico', value: null },
    { id: '26', description: 'Material de Limpeza', value: 150.00 },
    { id: '27', description: 'Lixo Infectante', value: 140.00 },
    { id: '28', description: 'Parcelamento Impostos', value: 507.09 },
    { id: '29', description: 'Faculdade Priscila', value: 2300.00 },
    { id: '30', description: 'Parcelamento Cartão Nubank', value: 1400.00 },
    { id: '31', description: 'Comissão Doutoras', value: 3000.00, isHighlighted: true },
    { id: '32', description: 'Comissão Ana', value: 4000.00, isHighlighted: true },
    { id: '33', description: 'Valderi', value: null, isHighlighted: true },
    { id: '34', description: 'Dcarneiro', value: null, isHighlighted: true }
];

export const getForecastForServiceName = (name: string): number => {
    const n = name.toLowerCase();
    if (n.includes('flexível') && n.includes('ppr')) return 3.00897;
    if (n.includes('prótese total nacional') || (n.includes('prótese') && n.includes('total') && n.includes('nacional'))) return 3.95728;
    if (n.includes('prótese removível') && n.includes('ppr')) return 3.12809;
    if (n.includes('ponte') && n.includes('movel')) return 8.31957;
    if (n.includes('mix')) return 6.73333;
    if (n.includes('porcelana') && n.includes('núcleo')) return 2;
    if (n.includes('manutenção r$110') || (n.includes('manutenção') && n.includes('110'))) return 28.75909;
    if (n.includes('autoligado') && n.includes('manutenção')) return 20;
    if (n.includes('canal') && n.includes('anteriores')) return 2.89886;
    if (n.includes('acrílico') && n.includes('unitária')) return 3.879275;
    if (n.includes('extração') && n.includes('incisivo')) return 11.62948;
    if (n.includes('ultrassom') && n.includes('limpeza')) return 25.05882;
    if (n.includes('restauração') && n.includes('pequena')) return 12.8806;
    if (n.includes('flexível') && n.includes('3 camadas')) return 1.15766;
    if (n.includes('manutenção r$85') || (n.includes('manutenção') && n.includes('85'))) return 25.05882;
    if (n.includes('removível') && n.includes('3 cama')) return 0.994736;
    if (n.includes('manutenção r$60') || (n.includes('manutenção') && n.includes('60'))) return 29.5;
    if (n.includes('restauração') && n.includes('grande')) return 21.36363;
    if (n.includes('facetas') && n.includes('resina')) return 3.30434;
    if (n.includes('limpeza') && n.includes('orto')) return 11;
    if (n.includes('manutenção r$55') || (n.includes('manutenção') && n.includes('55'))) return 21.36363;
    if (n.includes('molar') && n.includes('extração')) return 4.18982;
    if (n.includes('conserto') && n.includes('prótese')) return 3;
    if (n.includes('clareamento') && n.includes('caseiro')) return 1.90022;
    if (n.includes('incluso') && n.includes('terceiro molar')) return 1;
    if (n.includes('unitária flexível') || n.includes('unitaria flexivel')) return 1;
    if (n.includes('estética') || n.includes('estetica')) return 2;
    if (n.includes('gengivectomia')) return 1;
    if (n.includes('decíduo') || n.includes('deciduo')) return 3.51994;
    if (n.includes('coroa') && n.includes('implante')) return 0.16668;
    if (n.includes('bloco') && n.includes('resina')) return 1;
    if (n.includes('residual') && n.includes('com canal')) return 1;
    if (n.includes('pré-molar') || n.includes('pre-molar')) return 2.29605;
    if (n.includes('erupcionado')) return 0.89997;
    if (n.includes('instalação') && n.includes('autoligado')) return 0.59026;
    if (n.includes('hyrax')) return 0.55;
    if (n.includes('consultório') && n.includes('clareamento')) return 1;
    if (n.includes('acrílico') && n.includes('pino')) return 0.4;
    if (n.includes('manutenção r$70') || (n.includes('manutenção') && n.includes('70'))) return 4;
    if (n.includes('residual') && n.includes('sem canal')) return 0.89996;
    if (n.includes('remoção') && n.includes('limpeza')) return 1;
    if (n.includes('urgência') || n.includes('urgencia')) return 0.8962;
    if (n.includes('boleto') && n.includes('212')) return 1;
    if (n.includes('manutenção r$65') || (n.includes('manutenção') && n.includes('65'))) return 3.15384;
    if (n.includes('panorâmica') || n.includes('panoramica')) return 4;
    if (n.includes('boleto') && n.includes('187')) return 1;
    if (n.includes('contenção fixa') || n.includes('contencao fixa')) return 0.5;
    if (n.includes('consulta')) return 1;
    if (n.includes('peça convencional') || n.includes('peca convencional')) return 16;
    if (n.includes('peça autoligado') || n.includes('peca autoligado')) return 1;
    return 0;
};

const defaultPresets: { keywords: string[]; items: FichaTecnicaItem[] }[] = [
    {
        keywords: ['limpeza', 'profilaxia', 'ultrassom'],
        items: [
            { materialId: 10, quantity: 1 }, // Sugador
            { materialId: 11, quantity: 2 }, // Luva
            { materialId: 12, quantity: 1 }, // Babador
            { materialId: 23, quantity: 1 }, // Escova de Robinson (Pacote/Unidade)
            { materialId: 24, quantity: 5 }, // Pasta Profilática (Gr)
            { materialId: 25, quantity: 10 }, // Bicarbonato (Jato)
            { materialId: 41, quantity: 2 }, // Touca
            { materialId: 42, quantity: 1 }, // Máscara
            { employeeId: 'emp-2', quantity: 3.0 }, // Mão de Obra: Clínico (Dentista Clínico Geral) - 30 min
        ]
    },
    {
        keywords: ['restauração', 'restauracao', 'resina', 'estética', 'estetic'],
        items: [
            { materialId: 1, quantity: 2 },  // Microbrush
            { materialId: 2, quantity: 10 }, // Algodão
            { materialId: 3, quantity: 0.2 }, // Adesivo (Ml)
            { materialId: 4, quantity: 0.5 }, // Ácido (Ml)
            { materialId: 5, quantity: 1 },  // Anestésico
            { materialId: 6, quantity: 1 },  // Agulha
            { materialId: 7, quantity: 0.2 }, // Flow (Gr)
            { materialId: 8, quantity: 1 },  // Lixa para Polimento
            { materialId: 9, quantity: 1 },  // Tira de Poliester
            { materialId: 10, quantity: 1 }, // Sugador
            { materialId: 11, quantity: 2 }, // Luva
            { materialId: 12, quantity: 1 }, // Babador
            { materialId: 13, quantity: 0.5 }, // Resina (Gr)
            { materialId: 41, quantity: 2 }, // Touca
            { materialId: 42, quantity: 1 }, // Máscara
            { employeeId: 'emp-2', quantity: 4.5 }, // Mão de Obra: Clínico (Dentista Clínico Geral) - 45 min
        ]
    },
    {
        keywords: ['clareamento caseiro'],
        items: [
            { materialId: 10, quantity: 1 }, // Sugador
            { materialId: 11, quantity: 2 }, // Luva
            { materialId: 12, quantity: 1 }, // Babador
            { materialId: 14, quantity: 40 }, // Alginato (Gr)
            { materialId: 15, quantity: 50 }, // Gesso (Gr)
            { materialId: 17, quantity: 1 },  // Gel Clareador 16% (Pacote)
            { materialId: 18, quantity: 2 },  // Placa de Clareamento
            { materialId: 22, quantity: 1 },  // Caixinha para placa
            { materialId: 41, quantity: 2 },  // Touca
            { materialId: 42, quantity: 1 },  // Máscara
            { employeeId: 'emp-2', quantity: 3.0 }, // Mão de Obra: Clínico (Dentista Clínico Geral) - 30 min
        ]
    },
    {
        keywords: ['clareamento de consultório', 'clareamento de consultorio', 'clareamento consultório', 'clareamento consultorio'],
        items: [
            { materialId: 10, quantity: 2 }, // Sugador
            { materialId: 11, quantity: 2 }, // Luva
            { materialId: 12, quantity: 1 }, // Babador
            { materialId: 19, quantity: 0.5 }, // Dessensibilizante (Gr)
            { materialId: 20, quantity: 1 },  // TopDam (Gr)
            { materialId: 21, quantity: 1 },  // Clareador Ger 35% (Gr)
            { materialId: 41, quantity: 2 },  // Touca
            { materialId: 42, quantity: 1 },  // Máscara
            { employeeId: 'emp-2', quantity: 6.0 }, // Mão de Obra: Clínico (Dentista Clínico Geral) - 60 min
        ]
    },
    {
        keywords: ['extração', 'exodontia', 'molar', 'bisturi', 'cirurgia'],
        items: [
            { materialId: 6, quantity: 1 },  // Agulha
            { materialId: 26, quantity: 1 }, // Fio de Sutura
            { materialId: 27, quantity: 20 }, // Gaze (Pacote/Unidade)
            { materialId: 28, quantity: 1 },  // Bisturi (Pacote/Unidade)
            { materialId: 29, quantity: 1 },  // Sugador Cirurgico
            { materialId: 30, quantity: 2 },  // Luva Cirúrgica
            { materialId: 31, quantity: 2 },  // Anestésico Articaina
            { materialId: 36, quantity: 1 },  // Kit Cirúrgico
            { materialId: 37, quantity: 1 },  // Soro
            { materialId: 41, quantity: 2 },  // Touca
            { materialId: 42, quantity: 1 },  // Máscara
            { materialId: 44, quantity: 1 },  // Campo cirúrgico
            { materialId: 57, quantity: 1 },  // Broca Zkrya
            { employeeId: 'emp-2', quantity: 6.0 }, // Mão de Obra: Clínico (Dentista Clínico Geral) - 60 min
        ]
    },
    {
        keywords: ['canal', 'endodontia'],
        items: [
            { materialId: 5, quantity: 1 },  // Anestésico
            { materialId: 6, quantity: 1 },  // Agulha
            { materialId: 10, quantity: 1 }, // Sugador
            { materialId: 11, quantity: 2 }, // Luva
            { materialId: 12, quantity: 1 }, // Babador
            { materialId: 39, quantity: 1 }, // Lençol de Borracha
            { materialId: 41, quantity: 2 }, // Touca
            { materialId: 42, quantity: 1 }, // Máscara
            { materialId: 52, quantity: 3 }, // Lima (Unidade)
            { employeeId: 'emp-2', quantity: 6.0 }, // Mão de Obra: Clínico (Dentista Clínico Geral) - 60 min
        ]
    },
    {
        keywords: ['implante'],
        items: [
            { materialId: 26, quantity: 1 }, // Fio de Sutura
            { materialId: 27, quantity: 20 }, // Gaze
            { materialId: 28, quantity: 1 },  // Bisturi
            { materialId: 29, quantity: 1 },  // Sugador Cirurgico
            { materialId: 30, quantity: 2 },  // Luva Cirúrgica
            { materialId: 31, quantity: 2 },  // Anestésico Articaina
            { materialId: 35, quantity: 1 },  // Cicatrizador
            { materialId: 36, quantity: 1 },  // Kit Cirúrgico
            { materialId: 37, quantity: 1 },  // Soro
            { materialId: 41, quantity: 2 },  // Touca
            { materialId: 42, quantity: 1 },  // Máscara
            { materialId: 44, quantity: 1 },  // Campo cirúrgico
            { materialId: 45, quantity: 1 },  // Implante
            { materialId: 46, quantity: 1 },  // Componentes
            { employeeId: 'emp-2', quantity: 9.0 }, // Mão de Obra: Clínico (Dentista Clínico Geral) - 90 min
        ]
    },
    {
        keywords: ['manutenção', 'manutencao'],
        items: [
            { materialId: 10, quantity: 1 }, // Sugador
            { materialId: 11, quantity: 2 }, // Luva
            { materialId: 12, quantity: 1 }, // Babador
            { materialId: 41, quantity: 2 }, // Touca
            { materialId: 42, quantity: 1 }, // Máscara
            { materialId: 53, quantity: 1 }, // Fio Ortodôntico
            { materialId: 54, quantity: 10 }, // Bengalinha (Elastic tie)
            { employeeId: 'emp-2', quantity: 2.0 }, // Mão de Obra: Clínico (Dentista Clínico Geral) - 20 min
        ]
    },
    {
        keywords: ['instalação', 'instalacao', 'aparelho'],
        items: [
            { materialId: 10, quantity: 1 }, // Sugador
            { materialId: 11, quantity: 2 }, // Luva
            { materialId: 12, quantity: 1 }, // Babador
            { materialId: 41, quantity: 2 }, // Touca
            { materialId: 42, quantity: 1 }, // Máscara
            { materialId: 58, quantity: 1 }, // Peça Convencional
            { materialId: 61, quantity: 1 }, // Tubos
            { employeeId: 'emp-2', quantity: 4.5 }, // Mão de Obra: Clínico (Dentista Clínico Geral) - 45 min
        ]
    },
    {
        keywords: ['prótese', 'protese', 'coroa', 'bloco', 'ponte', 'contenção', 'contencao'],
        items: [
            { materialId: 10, quantity: 1 }, // Sugador
            { materialId: 11, quantity: 2 }, // Luva
            { materialId: 12, quantity: 1 }, // Babador
            { materialId: 41, quantity: 2 }, // Touca
            { materialId: 42, quantity: 1 }, // Máscara
            { materialId: 32, quantity: 50 }, // Silicone Condensado
            { materialId: 38, quantity: 0.5 }, // Cimento
            { employeeId: 'emp-2', quantity: 6.0 }, // Mão de Obra: Clínico (Dentista Clínico Geral) - 60 min
        ]
    },
    {
        keywords: ['consulta', 'avaliação', 'avaliacao', 'diagnóstico'],
        items: [
            { materialId: 10, quantity: 1 }, // Sugador
            { materialId: 11, quantity: 2 }, // Luva
            { materialId: 12, quantity: 1 }, // Babador
            { materialId: 41, quantity: 2 }, // Touca
            { materialId: 42, quantity: 1 }, // Máscara
            { employeeId: 'emp-2', quantity: 3.0 }, // Mão de Obra: Clínico (Dentista Clínico Geral) - 30 min
        ]
    }
];

const isMaintenanceService = (name: string) => {
    const n = name.toLowerCase();
    return n.includes('manutenção') || 
           n.includes('manutencao') || 
           n.includes('boleto') || 
           n.includes('auto ligado') || 
           n.includes('autoligado');
};

const isContencaoService = (name: string) => {
    const n = name.toLowerCase();
    return n.includes('contenção') || n.includes('contencao');
};

const getInitialFichaTecnicas = (servicesList: Service[]): Record<string, FichaTecnicaItem[]> => {
    const initial: Record<string, FichaTecnicaItem[]> = {};
    servicesList.forEach(service => {
        const nameLower = service.name.toLowerCase();
        const preset = defaultPresets.find(p => p.keywords.some(k => nameLower.includes(k)));
        if (preset) {
            initial[service.id] = [...preset.items];
        } else {
            initial[service.id] = [];
        }
    });

    // Automatically replicate Manutenção 85 items to all other maintenance services initially
    const m85Service = servicesList.find(s => {
        const n = s.name.toLowerCase();
        return (n.includes('manutenção') || n.includes('manutencao')) && n.includes('85');
    });

    if (m85Service && initial[m85Service.id] && initial[m85Service.id].length > 0) {
        const m85Items = initial[m85Service.id];
        servicesList.forEach(s => {
            if (isMaintenanceService(s.name) && s.id !== m85Service.id) {
                initial[s.id] = [...m85Items];
            }
        });
    }

    return initial;
};

const repairFichaTecnicas = (existing: Record<string, FichaTecnicaItem[]>, servicesList: Service[]): Record<string, FichaTecnicaItem[]> => {
    const repaired = { ...existing };
    const m85Service = servicesList.find(s => {
        const n = s.name.toLowerCase();
        return (n.includes('manutenção') || n.includes('manutencao')) && n.includes('85');
    });

    servicesList.forEach(service => {
        let items = repaired[service.id] || [];
        const nameLower = service.name.toLowerCase();

        // If technical sheet is empty, try to populate from M85 or defaults
        if (items.length === 0) {
            if (isMaintenanceService(service.name) && m85Service && repaired[m85Service.id] && repaired[m85Service.id].length > 0) {
                items = [...repaired[m85Service.id]];
            } else {
                const preset = defaultPresets.find(p => p.keywords.some(k => nameLower.includes(k)));
                if (preset) {
                    items = [...preset.items];
                }
            }
        }

        // Special logic for Contenção: always sync with Prótese if it is missing or different? 
        // Actually, let's only sync if it was empty.
        const isContencao = isContencaoService(service.name);
        if (isContencao && items.length === 0) {
            const protesePreset = defaultPresets.find(p => p.keywords.includes('prótese'));
            if (protesePreset) {
                items = [...protesePreset.items];
            }
        }

        // Filter out Anna (emp-1) from existing procedures as requested
        items = items.filter(item => item.employeeId !== 'emp-1');
        
        repaired[service.id] = items;
    });

    return repaired;
};

export const PricingSystem: React.FC<{ services: Service[] }> = ({ services }) => {
    const [activeTab, setActiveTab] = useState<PricingTab>('produtos');
    const [isLoadingSupabase, setIsLoadingSupabase] = useState(true);
    const [selectedServiceId, setSelectedServiceId] = useState<string>('');
    
    const [fixedExpenses, setFixedExpenses] = useState<FixedExpenseItem[]>(() => {
        try {
            const saved = localStorage.getItem('fixed_expenses_list');
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.warn(e);
        }
        return initialFixedExpenses;
    });

    // Supabase Sync Logic
    useEffect(() => {
        const fetchSupabaseData = async () => {
            try {
                const { data, error } = await supabase.from('commercial_settings').select('*');
                if (error) throw error;

                if (data && data.length > 0) {
                    const settings: Record<string, any> = {};
                    data.forEach(item => {
                        settings[item.key] = item.value;
                    });

                    if (settings.raw_materials_list) setMaterials(settings.raw_materials_list);
                    if (settings.ficha_tecnicas) {
                        const repaired = repairFichaTecnicas(settings.ficha_tecnicas, services);
                        setFichaTecnicas(repaired);
                    }
                    if (settings.service_pricing_settings) setServiceSettings(settings.service_pricing_settings);
                    if (settings.third_party_costs) setThirdPartyCosts(settings.third_party_costs);
                    if (settings.fixed_expenses_list) setFixedExpenses(settings.fixed_expenses_list);
                    if (settings.payroll_employees_list) setEmployees(settings.payroll_employees_list);
                    
                    if (settings.payroll_config) {
                        const pc = settings.payroll_config;
                        if (pc.provFerias !== undefined) setProvFerias(pc.provFerias);
                        if (pc.prov13Salario !== undefined) setProv13Salario(pc.prov13Salario);
                        if (pc.prov13Ferias !== undefined) setProv13Ferias(pc.prov13Ferias);
                        if (pc.inss !== undefined) setInss(pc.inss);
                        if (pc.satRat !== undefined) setSatRat(pc.satRat);
                        if (pc.salarioEducacao !== undefined) setSalarioEducacao(pc.salarioEducacao);
                        if (pc.incraSebrae !== undefined) setIncraSebrae(pc.incraSebrae);
                        if (pc.fgts !== undefined) setFgts(pc.fgts);
                        if (pc.fgtsRescisao !== undefined) setFgtsRescisao(pc.fgtsRescisao);
                    }
                } else {
                    // Initial upload to Supabase if empty (we'll do this in another step if needed or just let observers handle it)
                }
            } catch (e) {
                console.error("Error fetching from Supabase:", e);
            } finally {
                setIsLoadingSupabase(false);
            }
        };

        fetchSupabaseData();
    }, [services]);

    const saveToSupabase = useCallback(async (key: string, value: any) => {
        try {
            const { data, error } = await supabase.from('commercial_settings').upsert({ key, value }, { onConflict: 'key' });
            if (error) {
                console.error(`Error saving ${key} to Supabase:`, error);
                return { success: false, error };
            }
            return { success: true, data };
        } catch (e: any) {
            console.error(`Error saving ${key} to Supabase:`, e);
            return { success: false, error: e };
        }
    }, []);

    const [isSavingSupabase, setIsSavingSupabase] = useState(false);

    const handleManualSaveFichas = async () => {
        setIsSavingSupabase(true);
        try {
            const resFicha = await saveToSupabase('ficha_tecnicas', fichaTecnicas);
            const resThird = await saveToSupabase('third_party_costs', thirdPartyCosts);
            const resMaterials = await saveToSupabase('raw_materials_list', materials);

            if (resFicha.success && resThird.success && resMaterials.success) {
                toast.success("Fichas Técnicas salvas com sucesso no Supabase!");
            } else {
                const err = resFicha.error || resThird.error || resMaterials.error;
                console.error("Erro ao salvar Fichas no Supabase:", err);
                toast.error(`Falha ao salvar no Supabase: ${err?.message || 'Verifique a tabela commercial_settings no Supabase.'}`);
            }
        } catch (err: any) {
            toast.error("Erro inesperado ao salvar no Supabase: " + (err?.message || String(err)));
        } finally {
            setIsSavingSupabase(false);
        }
    };
    
    // Formula input states
    const [cHora, setCHora] = useState(150);
    const [time, setTime] = useState(1);
    const [cDireto, setCDireto] = useState(50);
    const [cLaboratorio, setCLaboratorio] = useState(0);
    const [mLiquida, setMLiquida] = useState(30);
    const [tTributos, setTTributos] = useState(6);
    const [tFinanceira, setTFinanceira] = useState(3);
    const [cComissao, setCComissao] = useState(0);

    // Raw Materials state
    const [materials, setMaterials] = useState<RawMaterial[]>(() => {
        try {
            const saved = localStorage.getItem('raw_materials_list');
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.warn(e);
        }
        return initialRawMaterials;
    });
    const [searchQuery, setSearchQuery] = useState('');

    // States for scenario simulation
    const [scenarioQuantities, setScenarioQuantities] = useState<Record<string, number>>(() => {
        try {
            const saved = localStorage.getItem('scenario_quantities_list_v2');
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.warn(e);
        }
        const initialQuantities: Record<string, number> = {};
        services.forEach(s => {
            initialQuantities[s.id] = getForecastForServiceName(s.name);
        });
        return initialQuantities;
    });

    const [customPracticedPrices, setCustomPracticedPrices] = useState<Record<string, number>>(() => {
        try {
            const saved = localStorage.getItem('scenario_custom_prices_v2');
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.warn(e);
        }
        return {};
    });

    useEffect(() => {
        try {
            localStorage.setItem('scenario_quantities_list_v2', JSON.stringify(scenarioQuantities));
        } catch (e) {
            console.warn(e);
        }
    }, [scenarioQuantities]);

    useEffect(() => {
        try {
            localStorage.setItem('scenario_custom_prices_v2', JSON.stringify(customPracticedPrices));
        } catch (e) {
            console.warn(e);
        }
    }, [customPracticedPrices]);

    // Ficha Técnica and per-service variables persistence
    const [desiredProfit, setDesiredProfit] = useState<number>(0);
    const [relatoriosSubTab, setRelatoriosSubTab] = useState<'dre_gerencial' | 'analise_produto'>('dre_gerencial');
    const [selectedAnaliseServiceId, setSelectedAnaliseServiceId] = useState<string>(() => {
        return services.length > 0 ? services[0].id : '';
    });
    const [analiseType, setAnaliseType] = useState<'revenda' | 'prod_serv'>('prod_serv');
    const [analiseDesiredProfitPct, setAnaliseDesiredProfitPct] = useState<number>(0);
    const [analiseSearchQuery, setAnaliseSearchQuery] = useState<string>('');

    const [fichaTecnicas, setFichaTecnicas] = useState<Record<string, FichaTecnicaItem[]>>(() => {
        try {
            const saved = localStorage.getItem('ficha_tecnicas');
            if (saved) {
                const parsed = JSON.parse(saved) as Record<string, FichaTecnicaItem[]>;
                return repairFichaTecnicas(parsed, services);
            }
        } catch (e) {
            console.warn(e);
        }
        return getInitialFichaTecnicas(services);
    });

    const [serviceSettings, setServiceSettings] = useState<Record<string, ServiceSetting>>(() => {
        try {
            const saved = localStorage.getItem('service_pricing_settings');
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.warn(e);
        }
        return {};
    });

    // States for adding material/labor to a Ficha Técnica
    const [selectedFichaServiceId, setSelectedFichaServiceId] = useState<string>('');
    const [newFichaItemType, setNewFichaItemType] = useState<'material' | 'labor' | 'third_party'>('material');
    const [newFichaMatId, setNewFichaMatId] = useState<string>('');
    const [newFichaEmpId, setNewFichaEmpId] = useState<string>('');
    const [newFichaThirdPartyName, setNewFichaThirdPartyName] = useState<string>('');
    const [newFichaThirdPartyCost, setNewFichaThirdPartyCost] = useState<string>('');
    const [newFichaMatQty, setNewFichaMatQty] = useState<string>('1');

    const [editingThirdPartyId, setEditingThirdPartyId] = useState<string | null>(null);
    const [editingThirdPartyName, setEditingThirdPartyName] = useState<string>('');
    const [editingThirdPartyCost, setEditingThirdPartyCost] = useState<string>('');

    const [thirdPartyCosts, setThirdPartyCosts] = useState<Record<string, ThirdPartyCost[]>>(() => {
        try {
            const saved = localStorage.getItem('third_party_costs');
            if (saved) {
                const parsed = JSON.parse(saved) as Record<string, ThirdPartyCost[]>;
                let changed = false;

                // Sync alterations of "Manutenção 85" to other maintenance services on load
                const m85Service = services.find(s => {
                    const n = s.name.toLowerCase();
                    return (n.includes('manutenção') || n.includes('manutencao')) && n.includes('85');
                });

                if (m85Service && parsed[m85Service.id]) {
                    const m85Costs = parsed[m85Service.id];
                    const otherMaintServices = services.filter(s => {
                        return isMaintenanceService(s.name) && s.id !== m85Service.id;
                    });

                    otherMaintServices.forEach(s => {
                        const sCosts = parsed[s.id] || [];
                        const isDifferent = JSON.stringify(sCosts) !== JSON.stringify(m85Costs);
                        if (isDifferent) {
                            parsed[s.id] = [...m85Costs];
                            changed = true;
                        }
                    });
                }

                if (changed) {
                    localStorage.setItem('third_party_costs', JSON.stringify(parsed));
                }
                return parsed;
            }
        } catch (e) {
            console.warn(e);
        }
        return {};
    });

    useEffect(() => {
        try {
            localStorage.setItem('third_party_costs', JSON.stringify(thirdPartyCosts));
        } catch (e) {
            console.warn(e);
        }
    }, [thirdPartyCosts]);

    // Payroll (Folha de Pagamento) states
    const [provFerias, setProvFerias] = useState<number>(() => {
        const saved = localStorage.getItem('payroll_prov_ferias');
        return saved ? Number(saved) : 11.11;
    });
    const [prov13Salario, setProv13Salario] = useState<number>(() => {
        const saved = localStorage.getItem('payroll_prov_13salario');
        return saved ? Number(saved) : 8.33;
    });
    const [prov13Ferias, setProv13Ferias] = useState<number>(() => {
        const saved = localStorage.getItem('payroll_prov_13ferias');
        return saved ? Number(saved) : 2.33;
    });

    const [inss, setInss] = useState<number>(() => {
        const saved = localStorage.getItem('payroll_inss');
        return saved ? Number(saved) : 20.00;
    });
    const [satRat, setSatRat] = useState<number>(() => {
        const saved = localStorage.getItem('payroll_satrat');
        return saved ? Number(saved) : 0.00;
    });
    const [salarioEducacao, setSalarioEducacao] = useState<number>(() => {
        const saved = localStorage.getItem('payroll_salario_educacao');
        return saved ? Number(saved) : 0.00;
    });
    const [incraSebrae, setIncraSebrae] = useState<number>(() => {
        const saved = localStorage.getItem('payroll_incrasebrae');
        return saved ? Number(saved) : 0.00;
    });
    const [fgts, setFgts] = useState<number>(() => {
        const saved = localStorage.getItem('payroll_fgts');
        return saved ? Number(saved) : 8.00;
    });
    const [fgtsRescisao, setFgtsRescisao] = useState<number>(() => {
        const saved = localStorage.getItem('payroll_fgts_rescisao');
        return saved ? Number(saved) : 4.00;
    });

    const [employees, setEmployees] = useState<PayrollEmployee[]>(() => {
        try {
            const saved = localStorage.getItem('payroll_employees_list');
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.warn(e);
        }
        return [
            {
                id: 'emp-1',
                code: '0001',
                name: 'Anna',
                salary: 3500,
                sector: 'Produtivo',
                role: 'Auxiliar de Odontologia',
                contractType: 'PJ',
                valeTransporte: 0,
                valeRefeicao: 0,
                convenioMedico: 0,
                hoursPerMonth: 220
            },
            {
                id: 'emp-2',
                code: '0002',
                name: 'Clínico',
                salary: 5800,
                sector: 'Produtivo',
                role: 'Dentista Clínico Geral',
                contractType: 'PJ',
                valeTransporte: 0,
                valeRefeicao: 0,
                convenioMedico: 0,
                hoursPerMonth: 206
            },
            {
                id: 'emp-3',
                code: '0003',
                name: 'Sophia',
                salary: 3600,
                sector: 'Produtivo',
                role: 'Auxiliar de Prótese / Atendimento',
                contractType: 'PJ',
                valeTransporte: 0,
                valeRefeicao: 0,
                convenioMedico: 0,
                hoursPerMonth: 220
            }
        ];
    });

    // Payroll Persistence Effects
    useEffect(() => {
        localStorage.setItem('payroll_prov_ferias', provFerias.toString());
    }, [provFerias]);
    useEffect(() => {
        localStorage.setItem('payroll_prov_13salario', prov13Salario.toString());
    }, [prov13Salario]);
    useEffect(() => {
        localStorage.setItem('payroll_prov_13ferias', prov13Ferias.toString());
    }, [prov13Ferias]);
    useEffect(() => {
        localStorage.setItem('payroll_inss', inss.toString());
    }, [inss]);
    useEffect(() => {
        localStorage.setItem('payroll_satrat', satRat.toString());
    }, [satRat]);
    useEffect(() => {
        localStorage.setItem('payroll_salario_educacao', salarioEducacao.toString());
    }, [salarioEducacao]);
    useEffect(() => {
        localStorage.setItem('payroll_incrasebrae', incraSebrae.toString());
    }, [incraSebrae]);
    useEffect(() => {
        localStorage.setItem('payroll_fgts', fgts.toString());
    }, [fgts]);
    useEffect(() => {
        localStorage.setItem('payroll_fgts_rescisao', fgtsRescisao.toString());
    }, [fgtsRescisao]);

    useEffect(() => {
        try {
            localStorage.setItem('payroll_employees_list', JSON.stringify(employees));
        } catch (e) {
            console.warn(e);
        }
    }, [employees]);

    // Persistence observers
    useEffect(() => {
        if (!isLoadingSupabase) {
            try {
                localStorage.setItem('raw_materials_list', JSON.stringify(materials));
                saveToSupabase('raw_materials_list', materials);
            } catch (e) {
                console.warn(e);
            }
        }
    }, [materials, isLoadingSupabase, saveToSupabase]);

    useEffect(() => {
        if (!isLoadingSupabase) {
            try {
                localStorage.setItem('ficha_tecnicas', JSON.stringify(fichaTecnicas));
                saveToSupabase('ficha_tecnicas', fichaTecnicas);
            } catch (e) {
                console.warn(e);
            }
        }
    }, [fichaTecnicas, isLoadingSupabase, saveToSupabase]);

    useEffect(() => {
        if (!isLoadingSupabase) {
            try {
                localStorage.setItem('service_pricing_settings', JSON.stringify(serviceSettings));
                saveToSupabase('service_pricing_settings', serviceSettings);
            } catch (e) {
                console.warn(e);
            }
        }
    }, [serviceSettings, isLoadingSupabase, saveToSupabase]);

    useEffect(() => {
        if (!isLoadingSupabase) {
            try {
                localStorage.setItem('fixed_expenses_list', JSON.stringify(fixedExpenses));
                saveToSupabase('fixed_expenses_list', fixedExpenses);
            } catch (e) {
                console.warn(e);
            }
        }
    }, [fixedExpenses, isLoadingSupabase, saveToSupabase]);

    useEffect(() => {
        if (!isLoadingSupabase) {
            try {
                localStorage.setItem('third_party_costs', JSON.stringify(thirdPartyCosts));
                saveToSupabase('third_party_costs', thirdPartyCosts);
            } catch (e) {
                console.warn(e);
            }
        }
    }, [thirdPartyCosts, isLoadingSupabase, saveToSupabase]);

    useEffect(() => {
        if (!isLoadingSupabase) {
            try {
                localStorage.setItem('payroll_employees_list', JSON.stringify(employees));
                saveToSupabase('payroll_employees_list', employees);
            } catch (e) {
                console.warn(e);
            }
        }
    }, [employees, isLoadingSupabase, saveToSupabase]);

    useEffect(() => {
        if (!isLoadingSupabase) {
            const config = {
                provFerias, prov13Salario, prov13Ferias, inss, satRat, salarioEducacao, incraSebrae, fgts, fgtsRescisao
            };
            localStorage.setItem('payroll_config', JSON.stringify(config));
            saveToSupabase('payroll_config', config);
        }
    }, [provFerias, prov13Salario, prov13Ferias, inss, satRat, salarioEducacao, incraSebrae, fgts, fgtsRescisao, isLoadingSupabase, saveToSupabase]);

    const filteredMaterials = useMemo(() => {
        if (!searchQuery.trim()) return materials;
        return materials.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [materials, searchQuery]);

    const handleMaterialChange = (id: number, field: keyof RawMaterial, value: any) => {
        setMaterials(prev => prev.map(m => {
            if (m.id === id) {
                return { ...m, [field]: value };
            }
            return m;
        }));
    };

    const handleAddMaterial = () => {
        const nextId = materials.length > 0 ? Math.max(...materials.map(m => m.id)) + 1 : 1;
        const newMat: RawMaterial = {
            id: nextId,
            name: 'Nova Matéria Prima',
            grossWeight: 100,
            netWeight: 100,
            uom: 'Unidade',
            pricePerUom: 0,
            correctionFactor: 100
        };
        setMaterials(prev => [newMat, ...prev]);
        toast.success("Nova matéria-prima cadastrada!");
    };

    const handleDeleteMaterial = (id: number) => {
        setMaterials(prev => prev.filter(m => m.id !== id));
        toast.info("Matéria-prima removida.");
    };

    const handleRestoreDefaults = () => {
        if (window.confirm("Deseja realmente restaurar todas as matérias-primas e fichas técnicas para os valores padrões? Isso substituirá suas alterações locais.")) {
            setMaterials(initialRawMaterials);
            setFichaTecnicas(getInitialFichaTecnicas(services));
            localStorage.setItem('raw_materials_list', JSON.stringify(initialRawMaterials));
            localStorage.setItem('ficha_tecnicas', JSON.stringify(getInitialFichaTecnicas(services)));
            toast.success("Insumos e Fichas Técnicas restaurados com sucesso!");
        }
    };

    const totalPayrollCost = useMemo(() => {
        return employees.reduce((sum, e) => {
            const totalTrab = e.contractType === 'CLT' ? (provFerias + prov13Salario + prov13Ferias) / 100 : 0;
            const totalSoc = e.contractType === 'CLT' ? (inss + satRat + salarioEducacao + incraSebrae + fgts + fgtsRescisao) / 100 : 0;
            const charges = e.salary * (totalTrab + totalSoc);
            return sum + e.salary + charges + e.valeTransporte + e.valeRefeicao + e.convenioMedico;
        }, 0);
    }, [employees, provFerias, prov13Salario, prov13Ferias, inss, satRat, salarioEducacao, incraSebrae, fgts, fgtsRescisao]);

    const processedFixedExpenses = useMemo(() => {
        return fixedExpenses.map(item => {
            if (item.id === '1') {
                return { ...item, value: totalPayrollCost };
            }
            return item;
        });
    }, [fixedExpenses, totalPayrollCost]);

    const totalFixedExpenses = useMemo(() => {
        return processedFixedExpenses.reduce((sum, item) => sum + (item.value || 0), 0);
    }, [processedFixedExpenses]);

    const handleFixedExpenseChange = (id: string, field: keyof FixedExpenseItem, value: any) => {
        if (id === '1' && field === 'value') return; // Read-only value for payroll expense
        setFixedExpenses(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, [field]: value };
            }
            return item;
        }));
    };

    const handleAddFixedExpense = () => {
        const numericIds = fixedExpenses.map(item => Number(item.id)).filter(val => !isNaN(val));
        const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
        const nextId = String(maxId + 1);
        const newItem: FixedExpenseItem = {
            id: nextId,
            description: 'Nova Despesa Fixa',
            value: null,
            isHighlighted: false
        };
        setFixedExpenses(prev => [...prev, newItem]);
        toast.success("Nova despesa fixa adicionada!");
    };

    const handleDeleteFixedExpense = (id: string) => {
        setFixedExpenses(prev => prev.filter(item => item.id !== id));
        toast.info("Despesa fixa removida.");
    };

    const handleResetFixedExpenses = () => {
        if (window.confirm("Deseja realmente restaurar as despesas fixas para os valores padrão do print?")) {
            setFixedExpenses(initialFixedExpenses);
            toast.success("Despesas fixas restauradas para os padrões!");
        }
    };

    const handleClearAllFixedExpenses = () => {
        if (window.confirm("Deseja realmente zerar todos os valores das despesas fixas?")) {
            setFixedExpenses(prev => prev.map(item => ({ ...item, value: null })));
            toast.success("Todos os valores foram zerados!");
        }
    };

    const handleExportFichaTecnica = () => {
        try {
            const data = services.map(service => {
                const breakdown = getFichaCostBreakdown(service.id);
                const totalCost = breakdown.cmv + breakdown.labor + (breakdown.thirdParty || 0);
                
                return {
                    'Procedimento': service.name,
                    'Custo Insumos (CMV) (R$)': breakdown.cmv.toFixed(2),
                    'Custo Mão de Obra (R$)': breakdown.labor.toFixed(2),
                    'Serviços Terceirizados (R$)': (breakdown.thirdParty || 0).toFixed(2),
                    'Custo Total (Ficha) (R$)': totalCost.toFixed(2),
                    'Preço de Venda Praticado (R$)': (service.defaultValue || 0).toFixed(2)
                };
            });

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Fichas Técnicas');
            XLSX.writeFile(wb, `Exportacao_Fichas_Tecnicas_${new Date().toISOString().split('T')[0]}.xlsx`);
            toast.success("Exportação das fichas técnicas concluída!");
        } catch (error) {
            console.error("Erro ao exportar:", error);
            toast.error("Erro ao gerar arquivo de exportação.");
        }
    };

    const getEmployeeHourlyRate = useCallback((emp: PayrollEmployee) => {
        const isClt = emp.contractType === 'CLT';
        const totalTrabPct = provFerias + prov13Salario + prov13Ferias;
        const totalSocPct = inss + satRat + salarioEducacao + incraSebrae + fgts + fgtsRescisao;

        const calculatedSoc = isClt ? emp.salary * (totalSocPct / 100) : 0;
        const calculatedTrab = isClt ? emp.salary * (totalTrabPct / 100) : 0;

        const totalCusto = emp.salary + calculatedSoc + calculatedTrab + emp.valeTransporte + emp.valeRefeicao + emp.convenioMedico;
        return emp.hoursPerMonth > 0 ? totalCusto / emp.hoursPerMonth : 0;
    }, [provFerias, prov13Salario, prov13Ferias, inss, satRat, salarioEducacao, incraSebrae, fgts, fgtsRescisao]);

    // Calculate Suggested Clinic Hourly Rate from Payroll (specifically for Dentists)
    const suggestedCHora = useMemo(() => {
        const dentists = employees.filter(emp => 
            emp.role?.toLowerCase().includes('dentista') || 
            emp.role?.toLowerCase().includes('dentist')
        );
        
        const targetGroup = dentists.length > 0 ? dentists : employees;
        if (targetGroup.length === 0) return 150;

        const totalCustoMensal = targetGroup.reduce((sum, emp) => {
            return sum + getEmployeeHourlyRate(emp) * (emp.hoursPerMonth || 160);
        }, 0);
        
        const totalHorasMensais = targetGroup.reduce((sum, emp) => {
            return sum + (emp.hoursPerMonth || 160);
        }, 0) || 160;
        
        return totalCustoMensal / totalHorasMensais;
    }, [employees, getEmployeeHourlyRate]);

    const calculateFichaCost = useCallback((items: FichaTecnicaItem[], externalCosts: ThirdPartyCost[] = []) => {
        const itemCost = items.reduce((sum, item) => {
            if (item.employeeId) {
                const emp = employees.find(e => e.id === item.employeeId);
                if (!emp) return sum;
                const hourlyRate = getEmployeeHourlyRate(emp);
                // 1.0 in quantity = 10 minutes (hours = quantity / 6)
                const hours = item.quantity / 6;
                return sum + (hours * hourlyRate);
            } else {
                const material = materials.find(m => m.id === item.materialId);
                if (!material) return sum;
                const divisor = material.netWeight || 1;
                const pricePerMeasure = (material.pricePerUom / divisor) * (material.correctionFactor / 100);
                return sum + (item.quantity * pricePerMeasure);
            }
        }, 0);
        
        const thirdPartyCost = externalCosts.reduce((sum, item) => sum + item.cost, 0);
        return itemCost + thirdPartyCost;
    }, [employees, materials, getEmployeeHourlyRate]);

    const calculateFichaTime = useCallback((items: FichaTecnicaItem[]) => {
        return items.reduce((sum, item) => {
            if (item.employeeId) {
                return sum + (item.quantity / 6);
            }
            return sum;
        }, 0);
    }, []);

    const getFichaCostBreakdown = useCallback((serviceId: string) => {
        const items = fichaTecnicas[serviceId] || [];
        const externalCosts = thirdPartyCosts[serviceId] || [];
        let cmv = 0;
        let labor = 0;
        let thirdParty = 0;
        
        items.forEach(item => {
            if (item.employeeId) {
                const emp = employees.find(e => e.id === item.employeeId);
                if (emp) {
                    const hourlyRate = getEmployeeHourlyRate(emp);
                    const hours = item.quantity / 6;
                    labor += hours * hourlyRate;
                }
            } else {
                const material = materials.find(m => m.id === item.materialId);
                if (material) {
                    const divisor = material.netWeight || 1;
                    const pricePerMeasure = (material.pricePerUom / divisor) * (material.correctionFactor / 100);
                    cmv += item.quantity * pricePerMeasure;
                }
            }
        });

        externalCosts.forEach(ec => {
            thirdParty += ec.cost;
        });

        return { cmv, labor, thirdParty };
    }, [fichaTecnicas, thirdPartyCosts, employees, materials, getEmployeeHourlyRate]);

    const getServiceDefaultSetting = useCallback((serviceId: string): ServiceSetting => {
        const items = fichaTecnicas[serviceId] || [];
        const breakdown = getFichaCostBreakdown(serviceId);
        const calculatedFichaTime = calculateFichaTime(items);
        return {
            cHora: suggestedCHora,
            time: calculatedFichaTime > 0 ? calculatedFichaTime : 1,
            cDireto: breakdown.cmv + breakdown.labor,
            cLaboratorio: breakdown.thirdParty,
            mLiquida: 30,
            tTributos: 6,
            tFinanceira: 3,
            cComissao: 0,
            precoPraticado: 0
        };
    }, [fichaTecnicas, thirdPartyCosts, getFichaCostBreakdown, calculateFichaTime, suggestedCHora]);

    // Scenario Simulation calculations
    const scenarioData = useMemo(() => {
        return services.map((service, index) => {
            const price = customPracticedPrices[service.id] !== undefined 
                ? customPracticedPrices[service.id] 
                : (service.defaultValue || 0);

            const quantity = scenarioQuantities[service.id] !== undefined ? scenarioQuantities[service.id] : 0;
            const faturamento = price * quantity;

            // Unit Variable Cost: cDireto + cLaboratorio from serviceSettings
            const breakdown = getFichaCostBreakdown(service.id);
            const calculatedFichaTime = calculateFichaTime(fichaTecnicas[service.id] || []);

            const settings = serviceSettings[service.id] || {
                cHora: suggestedCHora,
                time: calculatedFichaTime > 0 ? calculatedFichaTime : 1,
                cDireto: breakdown.cmv + breakdown.labor,
                cLaboratorio: breakdown.thirdParty,
                mLiquida: 30,
                tTributos: 6,
                tFinanceira: 3,
                cComissao: 0
            };

            const clinicCostRate = settings.cHora === 150 || !settings.cHora ? suggestedCHora : settings.cHora;
            const cDiretoValue = (breakdown.cmv + breakdown.labor) > 0 ? (breakdown.cmv + breakdown.labor) : (settings.cDireto || 0);
            const cLaboratorioValue = breakdown.thirdParty > 0 ? breakdown.thirdParty : (settings.cLaboratorio || 0);
            const unitVariableCost = cDiretoValue + cLaboratorioValue;
            const totalVariableCost = unitVariableCost * quantity;

            // Taxes, card fee, commission
            const taxesPct = settings.tTributos || 0;
            const cardFeePct = settings.tFinanceira || 0;
            const appFeePct = 0; // Taxa Aplicativo
            const commissionPct = settings.cComissao !== undefined ? settings.cComissao : 0;

            const totalTaxes = faturamento * (taxesPct / 100);
            const totalCardFee = faturamento * (cardFeePct / 100);
            const totalAppFee = faturamento * (appFeePct / 100);
            const totalCommission = faturamento * (commissionPct / 100);

            const margemContribuicaoValue = faturamento - totalVariableCost - totalTaxes - totalCardFee - totalAppFee - totalCommission;
            const margemContribuicaoPct = faturamento > 0 ? (margemContribuicaoValue / faturamento) * 100 : 0;

            const markup = unitVariableCost > 0 ? price / unitVariableCost : 0;

            // Calculate Suggested Price based on target Net Margin
            const targetNetMargin = settings.mLiquida || 30;
            const clinicCost = clinicCostRate * (settings.time || 1);
            const totalFixedCostImpact = unitVariableCost + clinicCost;
            const divisor = 1 - (taxesPct + cardFeePct + commissionPct + appFeePct + targetNetMargin) / 100;
            const suggestedPrice = divisor > 0 ? totalFixedCostImpact / divisor : 0;

            return {
                id: service.id,
                code: String(index + 38), // Sequential codes starting around row 38 as in the print
                name: service.name,
                price,
                suggestedPrice,
                quantity,
                faturamento,
                unitVariableCost,
                totalVariableCost,
                totalTaxes,
                totalCardFee,
                totalAppFee,
                totalCommission,
                margemContribuicaoValue,
                margemContribuicaoPct,
                markup,
                rateioDespesasFixas: 0,
                margemLucroValue: 0,
                margemLucroPct: 0,
                mixPct: 0
            };
        });
    }, [services, customPracticedPrices, scenarioQuantities, serviceSettings, calculateFichaCost, calculateFichaTime, fichaTecnicas, suggestedCHora, getFichaCostBreakdown]);

    const scenarioTotals = useMemo(() => {
        let totalQty = 0;
        let totalFaturamento = 0;
        let totalVariableCost = 0;
        let totalTaxes = 0;
        let totalCardFee = 0;
        let totalAppFee = 0;
        let totalCommission = 0;
        let totalMargemContribuicaoValue = 0;

        scenarioData.forEach(item => {
            totalQty += item.quantity;
            totalFaturamento += item.faturamento;
            totalVariableCost += item.totalVariableCost;
            totalTaxes += item.totalTaxes;
            totalCardFee += item.totalCardFee;
            totalAppFee += item.totalAppFee;
            totalCommission += item.totalCommission;
            totalMargemContribuicaoValue += item.margemContribuicaoValue;
        });

        const totalMargemContribuicaoPct = totalFaturamento > 0 ? (totalMargemContribuicaoValue / totalFaturamento) * 100 : 0;
        
        const finalData = scenarioData.map(item => {
            const mixPct = totalFaturamento > 0 ? (item.faturamento / totalFaturamento) * 100 : 0;
            const rateioDespesasFixas = totalFaturamento > 0 ? (mixPct / 100) * totalFixedExpenses : 0;
            const margemLucroValue = item.margemContribuicaoValue - rateioDespesasFixas;
            const margemLucroPct = item.faturamento > 0 ? (margemLucroValue / item.faturamento) * 100 : 0;

            return {
                ...item,
                mixPct,
                rateioDespesasFixas,
                margemLucroValue,
                margemLucroPct
            };
        });

        const totalRateio = finalData.reduce((sum, item) => sum + item.rateioDespesasFixas, 0);
        const totalProfitValue = totalMargemContribuicaoValue - totalFixedExpenses;
        const totalProfitPct = totalFaturamento > 0 ? (totalProfitValue / totalFaturamento) * 100 : 0;

        return {
            items: finalData,
            totalQty,
            totalFaturamento,
            totalVariableCost,
            totalTaxes,
            totalCardFee,
            totalAppFee,
            totalCommission,
            totalMargemContribuicaoValue,
            totalMargemContribuicaoPct,
            totalRateio,
            totalProfitValue,
            totalProfitPct
        };
    }, [scenarioData, totalFixedExpenses]);

    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return scenarioTotals.items;
        const q = searchQuery.toLowerCase();
        return scenarioTotals.items.filter(item => 
            item.name.toLowerCase().includes(q) || 
            item.code.toLowerCase().includes(q)
        );
    }, [scenarioTotals.items, searchQuery]);

    const handleScenarioQuantityChange = (serviceId: string, qty: number) => {
        setScenarioQuantities(prev => ({
            ...prev,
            [serviceId]: Math.max(0, qty)
        }));
    };

    const handleScenarioPriceChange = (serviceId: string, price: number) => {
        setCustomPracticedPrices(prev => ({
            ...prev,
            [serviceId]: Math.max(0, price)
        }));
    };

    const handleRestoreScenarioQuantitiesPattern = () => {
        const initialQuantities: Record<string, number> = {};
        services.forEach(s => {
            initialQuantities[s.id] = getForecastForServiceName(s.name);
        });
        setScenarioQuantities(initialQuantities);
        toast.success("Previsão de vendas restaurada para o padrão do print!");
    };

    const handleClearScenarioQuantities = () => {
        const cleared: Record<string, number> = {};
        services.forEach(s => {
            cleared[s.id] = 0;
        });
        setScenarioQuantities(cleared);
        toast.info("Todas as quantidades foram zeradas.");
    };

    const handleResetScenarioPricesToDefaults = () => {
        setCustomPracticedPrices({});
        toast.info("Preços praticados redefinidos para os valores de tabela.");
    };

    // Service pricing selection
    const handleServiceSelect = (serviceId: string) => {
        setSelectedServiceId(serviceId);
        if (!serviceId) return;

        const settings = serviceSettings[serviceId] || getServiceDefaultSetting(serviceId);

        setCHora(settings.cHora);
        setTime(settings.time);
        setCDireto(settings.cDireto);
        setCLaboratorio(settings.cLaboratorio);
        setMLiquida(settings.mLiquida);
        setTTributos(settings.tTributos);
        setTFinanceira(settings.tFinanceira);
        setCComissao(settings.cComissao);
    };

    const updateServiceSetting = (field: keyof ServiceSetting, val: number) => {
        if (!selectedServiceId) return;
        setServiceSettings(prev => {
            const current = prev[selectedServiceId] || getServiceDefaultSetting(selectedServiceId);
            return {
                ...prev,
                [selectedServiceId]: {
                    ...current,
                    [field]: val
                }
            };
        });
    };

    // Ficha Técnica CRUD handlers
    const syncMaintenanceFichas = (
        currentFichas: Record<string, FichaTecnicaItem[]>,
        editedServiceId: string,
        updatedItems: FichaTecnicaItem[]
    ) => {
        const m85Service = services.find(s => {
            const n = s.name.toLowerCase();
            return (n.includes('manutenção') || n.includes('manutencao')) && n.includes('85');
        });

        if (m85Service && editedServiceId === m85Service.id) {
            const nextState = { ...currentFichas, [editedServiceId]: updatedItems };
            const otherMaintServices = services.filter(s => {
                return isMaintenanceService(s.name) && s.id !== m85Service.id;
            });

            otherMaintServices.forEach(s => {
                nextState[s.id] = [...updatedItems];
            });
            return nextState;
        }

        return { ...currentFichas, [editedServiceId]: updatedItems };
    };

    const syncMaintenanceThirdParty = (
        currentCosts: Record<string, ThirdPartyCost[]>,
        editedServiceId: string,
        updatedCosts: ThirdPartyCost[]
    ) => {
        const m85Service = services.find(s => {
            const n = s.name.toLowerCase();
            return (n.includes('manutenção') || n.includes('manutencao')) && n.includes('85');
        });

        if (m85Service && editedServiceId === m85Service.id) {
            const nextState = { ...currentCosts, [editedServiceId]: updatedCosts };
            const otherMaintServices = services.filter(s => {
                return isMaintenanceService(s.name) && s.id !== m85Service.id;
            });

            otherMaintServices.forEach(s => {
                nextState[s.id] = [...updatedCosts];
            });
            return nextState;
        }

        return { ...currentCosts, [editedServiceId]: updatedCosts };
    };

    const handleFichaQuantityChange = (
        serviceId: string, 
        identifier: { materialId?: number; employeeId?: string }, 
        qty: number
    ) => {
        setFichaTecnicas(prev => {
            const currentList = prev[serviceId] || [];
            const updated = currentList.map(item => {
                if (identifier.employeeId && item.employeeId === identifier.employeeId) {
                    return { ...item, quantity: qty };
                }
                if (identifier.materialId && item.materialId === identifier.materialId) {
                    return { ...item, quantity: qty };
                }
                return item;
            });
            return syncMaintenanceFichas(prev, serviceId, updated);
        });
    };

    const handleRemoveFichaItem = (
        serviceId: string, 
        identifier: { materialId?: number; employeeId?: string; thirdPartyId?: string }
    ) => {
        if (identifier.thirdPartyId) {
            setThirdPartyCosts(prev => {
                const currentList = prev[serviceId] || [];
                const updated = currentList.filter(item => item.id !== identifier.thirdPartyId);
                return syncMaintenanceThirdParty(prev, serviceId, updated);
            });
            toast.info("Serviço terceirizado removido.");
            return;
        }

        setFichaTecnicas(prev => {
            const currentList = prev[serviceId] || [];
            const updated = currentList.filter(item => {
                if (identifier.employeeId && item.employeeId === identifier.employeeId) {
                    return false;
                }
                if (identifier.materialId && item.materialId === identifier.materialId) {
                    return false;
                }
                return true;
            });
            return syncMaintenanceFichas(prev, serviceId, updated);
        });
        toast.info("Item removido da ficha técnica.");
    };

    const handleUpdateThirdPartyCost = (serviceId: string) => {
        if (!editingThirdPartyId) return;

        const name = editingThirdPartyName.trim();
        const cost = Number(editingThirdPartyCost) || 0;

        if (!name) {
            toast.error("O nome não pode estar vazio.");
            return;
        }

        setThirdPartyCosts(prev => {
            const currentList = prev[serviceId] || [];
            const updated = currentList.map(item => 
                item.id === editingThirdPartyId 
                    ? { ...item, name, cost } 
                    : item
            );
            return syncMaintenanceThirdParty(prev, serviceId, updated);
        });

        setEditingThirdPartyId(null);
        toast.success("Custo terceirizado atualizado!");
    };

    const handleAddFichaItem = (serviceId: string) => {
        if (newFichaItemType === 'labor') {
            const empId = newFichaEmpId;
            const qty = Number(newFichaMatQty) || 0;
            if (!empId) {
                toast.error("Por favor, selecione um profissional válido.");
                return;
            }
            if (qty <= 0) {
                toast.error("Por favor, informe uma quantidade de tempo válida.");
                return;
            }

            setFichaTecnicas(prev => {
                const currentList = prev[serviceId] || [];
                const existingIdx = currentList.findIndex(item => item.employeeId === empId);
                let updated;
                if (existingIdx > -1) {
                    updated = currentList.map((item, idx) => 
                        idx === existingIdx ? { ...item, quantity: item.quantity + qty } : item
                    );
                } else {
                    updated = [...currentList, { employeeId: empId, quantity: qty }];
                }
                return syncMaintenanceFichas(prev, serviceId, updated);
            });

            toast.success("Mão de obra adicionada com sucesso!");
            setNewFichaEmpId('');
            setNewFichaMatQty('1');
        } else if (newFichaItemType === 'third_party') {
            const name = newFichaThirdPartyName.trim();
            const cost = Number(newFichaThirdPartyCost) || 0;

            if (!name) {
                toast.error("Por favor, informe o nome do serviço terceirizado.");
                return;
            }
            if (cost <= 0) {
                toast.error("Por favor, informe um custo válido.");
                return;
            }

            setThirdPartyCosts(prev => {
                const currentList = prev[serviceId] || [];
                const newItem: ThirdPartyCost = {
                    id: 'tp-' + Date.now(),
                    name,
                    cost
                };
                const updated = [...currentList, newItem];
                return syncMaintenanceThirdParty(prev, serviceId, updated);
            });

            toast.success("Serviço terceirizado adicionado com sucesso!");
            setNewFichaThirdPartyName('');
            setNewFichaThirdPartyCost('');
        } else {
            const matId = Number(newFichaMatId);
            const qty = Number(newFichaMatQty) || 1;
            if (!matId) {
                toast.error("Por favor, selecione um material válido.");
                return;
            }

            setFichaTecnicas(prev => {
                const currentList = prev[serviceId] || [];
                const existingIdx = currentList.findIndex(item => item.materialId === matId);
                let updated;
                if (existingIdx > -1) {
                    updated = currentList.map((item, idx) => 
                        idx === existingIdx ? { ...item, quantity: item.quantity + qty } : item
                    );
                } else {
                    updated = [...currentList, { materialId: matId, quantity: qty }];
                }
                return syncMaintenanceFichas(prev, serviceId, updated);
            });

            toast.success("Material adicionado com sucesso!");
            setNewFichaMatId('');
            setNewFichaMatQty('1');
        }
    };

    const handleSyncFichaCostToService = (serviceId: string, totalCost: number, totalTime: number, totalThirdParty: number = 0) => {
        setServiceSettings(prev => {
            const current = prev[serviceId] || getServiceDefaultSetting(serviceId);
            return {
                ...prev,
                [serviceId]: {
                    ...current,
                    cDireto: totalCost,
                    cLaboratorio: totalThirdParty,
                    time: totalTime > 0 ? totalTime : current.time
                }
            };
        });

        if (selectedServiceId === serviceId) {
            setCDireto(totalCost);
            setCLaboratorio(totalThirdParty);
            if (totalTime > 0) setTime(totalTime);
        }

        toast.success(`Custos (Insumos: R$ ${totalCost.toFixed(2)}, Terceiros: R$ ${totalThirdParty.toFixed(2)}) e Tempo (${totalTime.toFixed(2)}h) vinculados!`);
    };

    const handleAddEmployee = () => {
        const nextCodeNum = employees.length > 0 
            ? Math.max(...employees.map(e => parseInt(e.code) || 0)) + 1 
            : 1;
        const nextCode = nextCodeNum.toString().padStart(4, '0');
        const nextId = 'emp-' + Date.now();
        const newEmp: PayrollEmployee = {
            id: nextId,
            code: nextCode,
            name: 'Novo Colaborador',
            salary: 0,
            sector: 'Produtivo',
            role: 'Colaborador',
            contractType: 'PJ',
            valeTransporte: 0,
            valeRefeicao: 0,
            convenioMedico: 0,
            hoursPerMonth: 220
        };
        setEmployees(prev => [...prev, newEmp]);
        toast.success("Novo colaborador adicionado à folha de pagamento!");
    };

    const handleDeleteEmployee = (id: string) => {
        setEmployees(prev => prev.filter(e => e.id !== id));
        toast.info("Colaborador removido.");
    };

    const handleEmployeeChange = (id: string, field: keyof PayrollEmployee, value: any) => {
        setEmployees(prev => prev.map(e => {
            if (e.id === id) {
                return { ...e, [field]: value };
            }
            return e;
        }));
    };

    const price = useMemo(() => {
        const numerator = (cHora * time) + cDireto + cLaboratorio;
        const denominator = 1 - (mLiquida + tTributos + tFinanceira + cComissao) / 100;
        return denominator > 0 ? numerator / denominator : 0;
    }, [cHora, time, cDireto, cLaboratorio, mLiquida, tTributos, tFinanceira, cComissao]);

    return (
        <div className="flex flex-col gap-6 p-6 animate-in fade-in h-full">
            <h2 className="text-2xl font-bold text-text mb-4">Precificação Inteligente e Automatizada</h2>
            
            <div className="flex flex-wrap gap-2 mb-6 bg-slate-800 p-2 rounded-lg">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        id={`pricing-tab-${tab.id}`}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            activeTab === tab.id 
                                ? 'bg-indigo-600 text-text shadow-md shadow-indigo-600/10' 
                                : 'text-slate-400 hover:text-text hover:bg-slate-700'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 bg-surface border border-border rounded-2xl p-6 overflow-auto">
                {activeTab === 'produtos' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div>
                            <h3 className="text-xl font-bold text-text">Cadastro de Serviços & Procedimentos</h3>
                            <p className="text-xs text-slate-400 mt-1">Lista completa de serviços odontológicos importados do financeiro com respectivos valores padrão</p>
                        </div>
                        <div className="w-full border border-border rounded-lg overflow-hidden">
                            <table className="w-full text-left text-sm text-slate-300">
                                <thead className="bg-panel text-slate-400 uppercase text-xs">
                                    <tr>
                                        <th className="px-4 py-3 border-b border-border w-24">Código</th>
                                        <th className="px-4 py-3 border-b border-border">Descrição do Serviço / Procedimento</th>
                                        <th className="px-4 py-3 border-b border-border w-48 text-right">Preço Cadastrado (R$)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {services.map((service, i) => (
                                        <tr key={service.id} className="border-b border-border hover:bg-panel">
                                            <td className="px-4 py-2.5 font-mono text-slate-500">{i + 1}</td>
                                            <td className="px-4 py-2.5 font-semibold text-slate-100">{service.name}</td>
                                            <td className="px-4 py-2.5 text-right font-mono text-emerald-400 font-bold">
                                                {service.defaultValue && service.defaultValue > 0 
                                                    ? `R$ ${service.defaultValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                                                    : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                    {services.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-8 text-center text-slate-500">Nenhum serviço cadastrado no financeiro.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'materia_prima' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        {materials.length < initialRawMaterials.length && (
                            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-200 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-sm">Seu navegador possui dados antigos salvos localmente</p>
                                        <p className="text-xs text-amber-300/80">
                                            Existem novos insumos odontológicos pré-cadastrados (total de {initialRawMaterials.length} itens) que estão ocultos. 
                                            Clique ao lado para carregar a lista completa de insumos e as fichas técnicas atualizadas!
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleRestoreDefaults}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-text text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shrink-0"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    Carregar Novos Insumos
                                </button>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-text">Matéria-prima / Insumos / Ingredientes</h3>
                                <p className="text-xs text-slate-400 mt-1">Gerencie custos unitários, pesos brutos e líquidos, embalagens e fator de correção</p>
                            </div>
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <div className="relative flex-1 sm:flex-initial">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Buscar matéria prima..." 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="bg-panel border border-border rounded-lg pl-9 pr-4 py-1.5 text-sm text-text focus:outline-none focus:border-indigo-500 w-full sm:w-64"
                                    />
                                </div>
                                <button 
                                    onClick={handleAddMaterial}
                                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-text px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Adicionar
                                </button>
                                <button 
                                    onClick={handleRestoreDefaults}
                                    title="Restaurar Insumos e Fichas Técnicas originais"
                                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-border px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                                >
                                    <RefreshCw className="w-4 h-4 text-amber-400" />
                                    Restaurar Padrões
                                </button>
                            </div>
                        </div>

                        <div className="w-full border border-border rounded-lg overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-300 min-w-[1100px]">
                                <thead className="bg-panel text-slate-400 uppercase text-xs">
                                    <tr>
                                        <th className="px-4 py-3 border-b border-border w-16">Código</th>
                                        <th className="px-4 py-3 border-b border-border">Matéria Prima</th>
                                        <th className="px-4 py-3 border-b border-border w-32">Peso Bruto (Embalagem)</th>
                                        <th className="px-4 py-3 border-b border-border w-32">Peso Líquido (Real)</th>
                                        <th className="px-4 py-3 border-b border-border w-28">Un. Medida</th>
                                        <th className="px-4 py-3 border-b border-border w-36">Custo Compra (R$)</th>
                                        <th className="px-4 py-3 border-b border-border w-32 text-center">Fator de Correção</th>
                                        <th className="px-4 py-3 border-b border-border w-36">Custo p/ Un. Real</th>
                                        <th className="px-4 py-3 border-b border-border w-16 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMaterials.map((m) => {
                                        const divisor = m.netWeight || 1;
                                        const factorMultiplier = m.correctionFactor / 100;
                                        const calculatedPricePerMeasure = (m.pricePerUom / divisor) * factorMultiplier;

                                        return (
                                            <tr key={m.id} className="border-b border-border hover:bg-panel">
                                                <td className="px-4 py-2 font-mono text-slate-500 text-xs">{m.id}</td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        className="w-full bg-transparent outline-none text-text focus:border-b border-indigo-500/50 py-1 font-semibold" 
                                                        value={m.name} 
                                                        onChange={(e) => handleMaterialChange(m.id, 'name', e.target.value)}
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        type="number"
                                                        className="w-full bg-transparent outline-none text-text focus:border-b border-indigo-500/50 py-1 font-mono text-sm" 
                                                        value={m.grossWeight} 
                                                        onChange={(e) => handleMaterialChange(m.id, 'grossWeight', Number(e.target.value))}
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        type="number"
                                                        className="w-full bg-transparent outline-none text-text focus:border-b border-indigo-500/50 py-1 font-mono text-sm" 
                                                        value={m.netWeight} 
                                                        onChange={(e) => handleMaterialChange(m.id, 'netWeight', Number(e.target.value))}
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        className="w-full bg-transparent outline-none text-text focus:border-b border-indigo-500/50 py-1 text-sm" 
                                                        value={m.uom} 
                                                        onChange={(e) => handleMaterialChange(m.id, 'uom', e.target.value)}
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center gap-1 font-mono text-sm">
                                                        <span className="text-slate-500">R$</span>
                                                        <input 
                                                            type="number"
                                                            step="0.01"
                                                            className="w-full bg-transparent outline-none text-text focus:border-b border-indigo-500/50 py-1 font-semibold" 
                                                            value={m.pricePerUom} 
                                                            onChange={(e) => handleMaterialChange(m.id, 'pricePerUom', Number(e.target.value))}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <div className="flex items-center justify-center gap-1 font-mono text-sm">
                                                        <input 
                                                            type="number"
                                                            className="w-16 bg-transparent outline-none text-text focus:border-b border-indigo-500/50 py-1 text-center" 
                                                            value={m.correctionFactor} 
                                                            onChange={(e) => handleMaterialChange(m.id, 'correctionFactor', Number(e.target.value))}
                                                        />
                                                        <span className="text-slate-500">%</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 font-mono text-indigo-400 font-bold text-sm">
                                                    R$ {calculatedPricePerMeasure.toFixed(4)} <span className="text-[10px] text-slate-500">/ {m.uom}</span>
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <button 
                                                        onClick={() => handleDeleteMaterial(m.id)}
                                                        className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredMaterials.length === 0 && (
                                        <tr>
                                            <td colSpan={9} className="px-4 py-8 text-center text-slate-500">Nenhuma matéria prima encontrada.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'ficha_tecnica' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-text">Ficha Técnica dos Procedimentos</h3>
                                <p className="text-xs text-slate-400 mt-1">Gerencie a composição de materiais e calcule o custo real de insumos de cada procedimento</p>
                            </div>
                            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 w-full sm:w-auto">
                                <button
                                    onClick={handleManualSaveFichas}
                                    disabled={isSavingSupabase}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-text rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all shadow-lg shadow-indigo-900/20 h-10 self-end sm:self-center mt-4 sm:mt-0 disabled:opacity-50"
                                    title="Forçar salvamento das fichas técnicas no Supabase"
                                >
                                    <Database className="w-3.5 h-3.5" />
                                    {isSavingSupabase ? "Salvando..." : "Salvar no Supabase"}
                                </button>
                                <button
                                    onClick={handleExportFichaTecnica}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-text rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all shadow-lg shadow-emerald-900/20 h-10 self-end sm:self-center mt-4 sm:mt-0"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Exportar Todas
                                </button>
                                <div className="w-full sm:w-80">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Selecione o Procedimento</label>
                                    <select 
                                        value={selectedFichaServiceId} 
                                        onChange={(e) => {
                                            setSelectedFichaServiceId(e.target.value);
                                            setNewFichaMatId('');
                                            setNewFichaMatQty('1');
                                        }} 
                                        className="w-full bg-slate-800 border border-border rounded-lg p-2.5 text-text text-sm focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="">Ver Todos os Procedimentos (Visão Geral)</option>
                                        {services.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {selectedFichaServiceId ? (
                            (() => {
                                const selectedService = services.find(s => s.id === selectedFichaServiceId);
                                const items = fichaTecnicas[selectedFichaServiceId] || [];
                                const external = thirdPartyCosts[selectedFichaServiceId] || [];
                                
                                // Calculate costs with unified list (materials & labor)
                                const fichaItemsDetails = items.map(item => {
                                    if (item.employeeId) {
                                        const emp = employees.find(e => e.id === item.employeeId);
                                        if (!emp) {
                                            return {
                                                item,
                                                id: item.employeeId,
                                                isLabor: true,
                                                isThirdParty: false,
                                                name: 'Profissional Removido',
                                                uom: 'min',
                                                price: 0,
                                                cost: 0
                                            };
                                        }
                                        const hourlyRate = getEmployeeHourlyRate(emp);
                                        const calculatedCost = (item.quantity / 6) * hourlyRate;
                                        return {
                                            item,
                                            id: emp.id,
                                            isLabor: true,
                                            isThirdParty: false,
                                            name: `${emp.name} (${emp.role})`,
                                            uom: 'tempo',
                                            price: hourlyRate,
                                            cost: calculatedCost
                                        };
                                    } else {
                                        const material = materials.find(m => m.id === item.materialId);
                                        if (!material) {
                                            return {
                                                item,
                                                id: String(item.materialId),
                                                isLabor: false,
                                                isThirdParty: false,
                                                name: 'Insumo Removido',
                                                uom: 'un',
                                                price: 0,
                                                cost: 0
                                            };
                                        }
                                        const divisor = material.netWeight || 1;
                                        const factorMultiplier = material.correctionFactor / 100;
                                        const pricePerMeasure = (material.pricePerUom / divisor) * factorMultiplier;
                                        const calculatedCost = item.quantity * pricePerMeasure;
                                        return {
                                            item,
                                            id: String(material.id),
                                            isLabor: false,
                                            isThirdParty: false,
                                            name: material.name,
                                            uom: material.uom,
                                            price: pricePerMeasure,
                                            cost: calculatedCost
                                         };
                                    }
                                });

                                const thirdPartyDetails = external.map(ec => ({
                                    item: ec,
                                    id: ec.id,
                                    isLabor: false,
                                    isThirdParty: true,
                                    name: ec.name,
                                    uom: 'serviço',
                                    price: ec.cost,
                                    cost: ec.cost
                                }));

                                const totalFichaCostItems = fichaItemsDetails.reduce((sum, item) => sum + item.cost, 0);
                                const totalThirdPartyCost = thirdPartyDetails.reduce((sum, item) => sum + item.cost, 0);
                                const totalFichaCost = totalFichaCostItems + totalThirdPartyCost;
                                const totalFichaTime = calculateFichaTime(items);

                                return (
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        {/* Materials & Labor Table */}
                                        <div className="lg:col-span-2 space-y-4">
                                            <div className="bg-panel border border-border rounded-xl p-4 flex justify-between items-center">
                                                <div>
                                                    <h4 className="text-md font-bold text-slate-200">{selectedService?.name}</h4>
                                                    <span className="text-xs text-slate-400">
                                                        Preço base cadastrado: {selectedService?.defaultValue && selectedService.defaultValue > 0 ? `R$ ${selectedService.defaultValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não informado'}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xs text-slate-400 block">Custo Total de Ficha</span>
                                                    <span className="text-2xl font-black text-indigo-400 font-mono">R$ {totalFichaCost.toFixed(2)}</span>
                                                </div>
                                            </div>

                                            {selectedService?.name.toLowerCase().includes('manutenção') && selectedService?.name.toLowerCase().includes('85') && (
                                                <div className="bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-xl p-3 text-xs flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                                                    <span><strong>Sincronização Ativa:</strong> Qualquer alteração feita aqui será automaticamente replicada para todas as outras manutenções da clínica!</span>
                                                </div>
                                            )}

                                            {selectedService?.name.toLowerCase().includes('manutenção') && !selectedService?.name.toLowerCase().includes('85') && (
                                                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl p-3 text-xs flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                                    <span>Esta ficha técnica está sincronizada com a <strong>Manutenção 85</strong>. Edite a Manutenção 85 para alterar os dados de todas as manutenções simultaneamente.</span>
                                                </div>
                                            )}

                                            <div className="border border-border rounded-lg overflow-hidden bg-surface">
                                                <table className="w-full text-left text-sm text-slate-300">
                                                    <thead className="bg-panel text-slate-400 uppercase text-xs">
                                                        <tr>
                                                            <th className="px-4 py-3 border-b border-border">Insumo / Mão de Obra / Terceiro</th>
                                                            <th className="px-4 py-3 border-b border-border w-44 text-center">Quantidade / Nome</th>
                                                            <th className="px-4 py-3 border-b border-border w-32">Custo Unit.</th>
                                                            <th className="px-4 py-3 border-b border-border w-32">Subtotal</th>
                                                            <th className="px-4 py-3 border-b border-border w-16 text-center">Remover</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {fichaItemsDetails.map((mc, idx) => (
                                                            <tr key={`${mc.id}-${idx}`} className="border-b border-border hover:bg-panel">
                                                                <td className="px-4 py-2.5 font-semibold text-slate-100">
                                                                    <div className="flex items-center gap-2">
                                                                        {mc.isLabor ? (
                                                                            <span className="inline-flex items-center gap-1 bg-indigo-500/15 border border-indigo-500/20 text-indigo-300 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                                                                <Users className="w-2.5 h-2.5" /> Mão de Obra
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1 bg-teal-500/15 border border-teal-500/20 text-teal-300 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                                                                Insumo
                                                                            </span>
                                                                        )}
                                                                        <span>{mc.name}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-2.5 text-center">
                                                                    <div className="flex flex-col items-center justify-center gap-0.5">
                                                                        <div className="flex items-center justify-center gap-1.5">
                                                                            <input 
                                                                                type="number"
                                                                                step="any"
                                                                                value={mc.item.quantity}
                                                                                onChange={(e) => handleFichaQuantityChange(
                                                                                    selectedFichaServiceId, 
                                                                                    mc.isLabor ? { employeeId: String(mc.id) } : { materialId: Number(mc.id) }, 
                                                                                    Number(e.target.value)
                                                                                )}
                                                                                className="w-16 bg-panel border border-border rounded px-2 py-1 text-center text-text font-mono text-xs focus:outline-none focus:border-indigo-500"
                                                                            />
                                                                            <span className="text-[10px] text-slate-500 font-medium">{mc.uom}</span>
                                                                        </div>
                                                                        {mc.isLabor && (
                                                                            <span className="text-[9px] text-slate-400 font-medium leading-none">
                                                                                = {((mc.item.quantity || 0) * 10).toFixed(0)} min
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-2.5 font-mono text-slate-400 text-xs">
                                                                    {mc.isLabor ? (
                                                                        <span>R$ {mc.price.toFixed(2)} <span className="text-[10px] text-slate-500">/h</span></span>
                                                                    ) : (
                                                                        <span>R$ {mc.price.toFixed(4)}</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-2.5 font-mono text-text text-xs font-bold">
                                                                    R$ {mc.cost.toFixed(2)}
                                                                </td>
                                                                <td className="px-4 py-2.5 text-center">
                                                                    <button 
                                                                        onClick={() => handleRemoveFichaItem(
                                                                            selectedFichaServiceId, 
                                                                            mc.isLabor ? { employeeId: String(mc.id) } : { materialId: Number(mc.id) }
                                                                        )}
                                                                        className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        
                                                        {/* Render Third Party Costs */}
                                                        {thirdPartyDetails.map((tp, idx) => (
                                                            <tr key={`${tp.id}-${idx}`} className="border-b border-border hover:bg-panel">
                                                                <td className="px-4 py-2.5 font-semibold text-slate-100">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="inline-flex items-center gap-1 bg-amber-500/15 border border-amber-500/20 text-amber-300 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                                                            Terceirizado
                                                                        </span>
                                                                        {editingThirdPartyId === tp.id ? (
                                                                            <input 
                                                                                type="text"
                                                                                value={editingThirdPartyName}
                                                                                onChange={(e) => setEditingThirdPartyName(e.target.value)}
                                                                                className="bg-panel border border-indigo-500/50 rounded px-2 py-1 text-xs text-text focus:outline-none w-full"
                                                                            />
                                                                        ) : (
                                                                            <span>{tp.name}</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-2.5 text-center text-slate-400 text-[10px]">
                                                                    Valor Fixo / Terceiro
                                                                </td>
                                                                <td className="px-4 py-2.5 font-mono text-slate-400 text-xs">
                                                                    {editingThirdPartyId === tp.id ? (
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="text-slate-500">R$</span>
                                                                            <input 
                                                                                type="number"
                                                                                step="any"
                                                                                value={editingThirdPartyCost}
                                                                                onChange={(e) => setEditingThirdPartyCost(e.target.value)}
                                                                                className="bg-panel border border-indigo-500/50 rounded px-2 py-1 text-xs text-text font-mono focus:outline-none w-20"
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        `R$ ${tp.price.toFixed(2)}`
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-2.5 font-mono text-text text-xs font-bold">
                                                                    R$ {editingThirdPartyId === tp.id ? Number(editingThirdPartyCost || 0).toFixed(2) : tp.cost.toFixed(2)}
                                                                </td>
                                                                <td className="px-4 py-2.5 text-center">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        {editingThirdPartyId === tp.id ? (
                                                                            <>
                                                                                <button 
                                                                                    onClick={() => handleUpdateThirdPartyCost(selectedFichaServiceId)}
                                                                                    className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors"
                                                                                    title="Salvar"
                                                                                >
                                                                                    <Check className="w-3.5 h-3.5" />
                                                                                </button>
                                                                                <button 
                                                                                    onClick={() => setEditingThirdPartyId(null)}
                                                                                    className="p-1 text-slate-400 hover:text-slate-300 hover:bg-panel/80 rounded transition-colors"
                                                                                    title="Cancelar"
                                                                                >
                                                                                    <X className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <button 
                                                                                    onClick={() => {
                                                                                        setEditingThirdPartyId(tp.id);
                                                                                        setEditingThirdPartyName(tp.name);
                                                                                        setEditingThirdPartyCost(String(tp.price));
                                                                                    }}
                                                                                    className="p-1 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded transition-colors"
                                                                                    title="Editar"
                                                                                >
                                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                                </button>
                                                                                <button 
                                                                                    onClick={() => handleRemoveFichaItem(
                                                                                        selectedFichaServiceId, 
                                                                                        { thirdPartyId: tp.id }
                                                                                    )}
                                                                                    className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                                                                                    title="Remover"
                                                                                >
                                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        
                                                        {fichaItemsDetails.length === 0 && thirdPartyDetails.length === 0 && (
                                                            <tr>
                                                                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                                                    Nenhum material ou profissional adicionado a esta Ficha Técnica ainda.
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Action Controls Sidebar */}
                                        <div className="space-y-4">
                                            <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
                                                <h4 className="text-sm font-bold text-text flex items-center gap-2">
                                                    <Plus className="w-4 h-4 text-indigo-400" />
                                                    Adicionar Componente
                                                </h4>

                                                {/* Segmented Control / Tabs for choosing Component Type */}
                                                <div className="grid grid-cols-3 bg-panel p-1 rounded-lg border border-border">
                                                    <button
                                                        onClick={() => {
                                                            setNewFichaItemType('material');
                                                            setNewFichaMatQty('1');
                                                        }}
                                                        className={`py-1.5 rounded text-[9px] font-bold transition-all ${newFichaItemType === 'material' ? 'bg-indigo-600 text-text' : 'text-slate-400 hover:text-text'}`}
                                                    >
                                                        Insumo
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setNewFichaItemType('labor');
                                                            setNewFichaMatQty('3.0'); // defaults to 30 mins
                                                        }}
                                                        className={`py-1.5 rounded text-[9px] font-bold transition-all ${newFichaItemType === 'labor' ? 'bg-indigo-600 text-text' : 'text-slate-400 hover:text-text'}`}
                                                    >
                                                        Mão de Obra
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setNewFichaItemType('third_party');
                                                        }}
                                                        className={`py-1.5 rounded text-[9px] font-bold transition-all ${newFichaItemType === 'third_party' ? 'bg-indigo-600 text-text' : 'text-slate-400 hover:text-text'}`}
                                                    >
                                                        Terceiros
                                                    </button>
                                                </div>
                                                
                                                <div className="space-y-3 pt-1">
                                                    {newFichaItemType === 'material' && (
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Insumo / Matéria Prima</label>
                                                            <select 
                                                                value={newFichaMatId} 
                                                                onChange={(e) => setNewFichaMatId(e.target.value)}
                                                                className="w-full bg-panel border border-border rounded-lg p-2.5 text-text text-xs focus:outline-none focus:border-indigo-500"
                                                            >
                                                                <option value="">Selecione um material...</option>
                                                                {materials.map(m => (
                                                                    <option key={m.id} value={m.id}>{m.name} ({m.uom})</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                    
                                                    {newFichaItemType === 'labor' && (
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Profissional / Dentista</label>
                                                            <select 
                                                                value={newFichaEmpId} 
                                                                onChange={(e) => setNewFichaEmpId(e.target.value)}
                                                                className="w-full bg-panel border border-border rounded-lg p-2.5 text-text text-xs focus:outline-none focus:border-indigo-500"
                                                            >
                                                                <option value="">Selecione um profissional...</option>
                                                                {employees.map(e => {
                                                                    const hrRate = getEmployeeHourlyRate(e);
                                                                    return (
                                                                        <option key={e.id} value={e.id}>
                                                                            {e.name} ({e.role}) - R$ {hrRate.toFixed(2)}/h
                                                                        </option>
                                                                    );
                                                                })}
                                                            </select>
                                                        </div>
                                                    )}

                                                    {newFichaItemType === 'third_party' && (
                                                        <div className="space-y-3">
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Nome do Serviço (Lab/Imagem)</label>
                                                                <input 
                                                                    type="text"
                                                                    value={newFichaThirdPartyName}
                                                                    onChange={(e) => setNewFichaThirdPartyName(e.target.value)}
                                                                    placeholder="Ex: Laboratório Prótese"
                                                                    className="w-full bg-panel border border-border rounded-lg p-2.5 text-text text-xs focus:outline-none focus:border-indigo-500"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Custo Direto (R$)</label>
                                                                <input 
                                                                    type="number"
                                                                    step="any"
                                                                    value={newFichaThirdPartyCost}
                                                                    onChange={(e) => setNewFichaThirdPartyCost(e.target.value)}
                                                                    placeholder="Ex: 150.00"
                                                                    className="w-full bg-panel border border-border rounded-lg p-2.5 text-text text-xs font-mono focus:outline-none focus:border-indigo-500"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
 
                                                    {newFichaItemType !== 'third_party' && (
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                                                                {newFichaItemType === 'labor' ? 'Tempo / Quantidade (ex: 3.0 = 30min, 4.5 = 45min)' : 'Quantidade'}
                                                            </label>
                                                            <div className="flex flex-col gap-1.5">
                                                                <div className="flex gap-2">
                                                                    <input 
                                                                        type="number"
                                                                        step="any"
                                                                        value={newFichaMatQty} 
                                                                        onChange={(e) => setNewFichaMatQty(e.target.value)}
                                                                        placeholder="Ex: 1" 
                                                                        className="flex-1 bg-panel border border-border rounded-lg px-3 py-1.5 text-text font-mono text-xs focus:outline-none focus:border-indigo-500"
                                                                    />
                                                                    <button 
                                                                        onClick={() => handleAddFichaItem(selectedFichaServiceId)}
                                                                        className="bg-indigo-600 hover:bg-indigo-500 text-text px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                                                                    >
                                                                        Adicionar
                                                                    </button>
                                                                </div>
                                                                {newFichaItemType === 'labor' && (
                                                                    <span className="text-[10px] text-indigo-300 block mt-0.5 font-medium">
                                                                        Equivale a {((Number(newFichaMatQty) || 0) * 10).toFixed(0)} minutos de trabalho.
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {newFichaItemType === 'third_party' && (
                                                        <button 
                                                            onClick={() => handleAddFichaItem(selectedFichaServiceId)}
                                                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-text py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                                                        >
                                                            Adicionar Serviço Terceirizado
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="bg-surface border border-border rounded-xl p-5 flex flex-col justify-between">
                                                <div className="space-y-2">
                                                    <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                                                        <Check className="w-4 h-4" />
                                                        Integração de Custos
                                                    </h4>
                                                    <p className="text-xs text-slate-400 leading-relaxed">
                                                        Cálculo Total: <strong>R$ {totalFichaCost.toFixed(2)}</strong> e <strong>{totalFichaTime.toFixed(2)}h</strong> de tempo clínico. 
                                                        Vincule-os à tabela de precificação para automatizar o cálculo de lucro.
                                                    </p>
                                                </div>
                                                <button 
                                                    onClick={() => handleSyncFichaCostToService(selectedFichaServiceId, totalFichaCost, totalFichaTime)}
                                                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-text py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all mt-6 shadow-lg shadow-emerald-900/20"
                                                >
                                                    <Zap className="w-3.5 h-3.5" />
                                                    Vincular à Precificação
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()
                        ) : (
                            <div className="space-y-6 animate-in fade-in duration-500">
                                <div className="bg-panel border border-border rounded-2xl overflow-hidden shadow-xl">
                                    <div className="bg-indigo-600/10 px-4 py-3 border-b border-border flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <List className="w-4 h-4 text-indigo-400" />
                                            <span className="text-xs font-bold text-text uppercase tracking-wider">Visão Geral de Todas as Fichas Técnicas</span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-medium">Total de {services.length} procedimentos cadastrados</span>
                                    </div>
                                    
                                    <div className="overflow-x-auto custom-scrollbar">
                                        <table className="w-full text-left text-sm text-slate-300">
                                            <thead className="bg-panel text-slate-400 uppercase text-[10px] font-bold">
                                                <tr className="divide-x divide-white/5">
                                                    <th className="px-4 py-3 border-b border-border w-1/3">Procedimento</th>
                                                    <th className="px-4 py-3 border-b border-border">Insumos, Mão de Obra e Medidas</th>
                                                    <th className="px-4 py-3 border-b border-border w-40 text-right">Custo Total (R$)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {services.map(service => {
                                                    const items = fichaTecnicas[service.id] || [];
                                                    const external = thirdPartyCosts[service.id] || [];
                                                    const breakdown = getFichaCostBreakdown(service.id);
                                                    const total = breakdown.cmv + breakdown.labor + (breakdown.thirdParty || 0);
                                                    
                                                    return (
                                                        <tr key={service.id} className="hover:bg-panel transition-colors divide-x divide-white/5 group">
                                                            <td className="px-4 py-4 align-top">
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="font-bold text-text group-hover:text-indigo-400 transition-colors">{service.name}</span>
                                                                    <button 
                                                                        onClick={() => setSelectedFichaServiceId(service.id)}
                                                                        className="text-[10px] text-indigo-500 hover:text-indigo-400 font-bold uppercase tracking-tighter flex items-center gap-1 mt-1"
                                                                    >
                                                                        <Edit className="w-3 h-3" />
                                                                        Editar Composição
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4">
                                                                <div className="flex flex-wrap gap-2">
                                                                    {items.length > 0 ? (
                                                                        items.map((item, idx) => {
                                                                            const isEmployee = !!item.employeeId;
                                                                            const mat = !isEmployee ? materials.find(m => m.id === item.materialId) : null;
                                                                            const emp = isEmployee ? employees.find(e => e.id === item.employeeId) : null;
                                                                            const label = mat?.name || emp?.name || 'Item não encontrado';
                                                                            
                                                                            return (
                                                                                <div key={idx} className="bg-slate-800/50 border border-border rounded px-2 py-1 flex items-center gap-1.5">
                                                                                    <span className="text-[10px] text-slate-300 font-medium">{label}</span>
                                                                                    <span className="text-[10px] text-indigo-400 font-mono font-bold">
                                                                                        {item.quantity}{item.unit || (isEmployee ? 'min' : 'un')}
                                                                                    </span>
                                                                                </div>
                                                                            );
                                                                        })
                                                                    ) : (
                                                                        <span className="text-xs text-slate-600 italic font-medium">Nenhuma composição cadastrada</span>
                                                                    )}
                                                                    {external.map((cost, idx) => (
                                                                        <div key={`ext-${idx}`} className="bg-amber-950/20 border border-amber-500/20 rounded px-2 py-1 flex items-center gap-1.5">
                                                                            <span className="text-[10px] text-amber-200 font-medium">{cost.name}</span>
                                                                            <span className="text-[10px] text-amber-400 font-mono font-bold">
                                                                                R$ {cost.cost.toFixed(2)}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4 text-right align-top">
                                                                <span className="font-mono font-bold text-emerald-400 text-sm">
                                                                    R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {services.length === 0 && (
                                                    <tr>
                                                        <td colSpan={3} className="px-4 py-12 text-center text-slate-500">
                                                            <ClipboardList className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                                                            <p className="text-sm font-medium">Nenhum procedimento cadastrado para exibir fichas técnicas.</p>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'precificacao' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div>
                            <h3 className="text-xl font-bold text-text">Calculadora de Precificação Odontológica</h3>
                            <p className="text-xs text-slate-400 mt-1">Calculadora baseada em custos reais de hora clínica ativa, insumos diretos e margens operacionais</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Procedimento / Serviço</label>
                                    <select 
                                        className="w-full bg-slate-800 border border-border rounded-lg p-3 text-text text-sm focus:outline-none focus:border-indigo-500" 
                                        onChange={(e) => handleServiceSelect(e.target.value)} 
                                        value={selectedServiceId}
                                    >
                                        <option value="">Selecione o procedimento...</option>
                                        {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Input 
                                            label="Custo Hora Clínica (R$)" 
                                            value={cHora} 
                                            onChange={(v) => { setCHora(v); updateServiceSetting('cHora', v); }} 
                                        />
                                        <button 
                                            onClick={() => { setCHora(suggestedCHora); updateServiceSetting('cHora', suggestedCHora); }}
                                            className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                                        >
                                            <Info className="w-3 h-3" />
                                            Sugerido pela Folha: R$ {suggestedCHora.toFixed(2)}
                                        </button>
                                    </div>
                                    <Input 
                                        label="Tempo de Cadeira (Horas)" 
                                        value={time} 
                                        onChange={(v) => { setTime(v); updateServiceSetting('time', v); }} 
                                    />
                                    <Input 
                                        label="Custo Insumos Direto (R$)" 
                                        value={cDireto} 
                                        onChange={(v) => { setCDireto(v); updateServiceSetting('cDireto', v); }} 
                                    />
                                    <Input 
                                        label="Custo do Laboratório (R$)" 
                                        value={cLaboratorio} 
                                        onChange={(v) => { setCLaboratorio(v); updateServiceSetting('cLaboratorio', v); }} 
                                    />
                                    <Input 
                                        label="Margem Líquida (%)" 
                                        value={mLiquida} 
                                        onChange={(v) => { setMLiquida(v); updateServiceSetting('mLiquida', v); }} 
                                    />
                                    <Input 
                                        label="Tributos / Impostos (%)" 
                                        value={tTributos} 
                                        onChange={(v) => { setTTributos(v); updateServiceSetting('tTributos', v); }} 
                                    />
                                    <Input 
                                        label="Taxas de Cartão (%)" 
                                        value={tFinanceira} 
                                        onChange={(v) => { setTFinanceira(v); updateServiceSetting('tFinanceira', v); }} 
                                    />
                                    <Input 
                                        label="Comissões / Dentista (%)" 
                                        value={cComissao} 
                                        onChange={(v) => { setCComissao(v); updateServiceSetting('cComissao', v); }} 
                                    />
                                    <div className="col-span-2 mt-2 pt-2 border-t border-border">
                                        <label className="block text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1.5">Preço Praticado Atual (R$)</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <span className="text-emerald-500 font-mono font-bold">R$</span>
                                            </div>
                                            <input 
                                                type="number"
                                                step="any"
                                                value={customPracticedPrices[selectedServiceId] !== undefined ? customPracticedPrices[selectedServiceId] : (services.find(s => s.id === selectedServiceId)?.defaultValue || 0)}
                                                onChange={(e) => {
                                                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                                                    handleScenarioPriceChange(selectedServiceId, val);
                                                }}
                                                className="w-full bg-emerald-950/20 border border-emerald-500/30 rounded-xl pl-10 pr-4 py-3 text-text text-lg font-mono font-black focus:outline-none focus:border-emerald-500 transition-all placeholder-emerald-900"
                                                placeholder="Informe o preço cobrado hoje..."
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-2 italic leading-relaxed">
                                            💡 Informe quanto você cobra atualmente por este procedimento para comparar com a sugestão ideal e analisar suas margens reais.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-800/80 p-8 rounded-2xl border border-border flex flex-col justify-center items-center gap-5 text-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full filter blur-2xl -mr-10 -mt-10"></div>
                                <span className="text-xs uppercase font-bold text-slate-400 tracking-widest leading-none">Preço de Venda Sugerido</span>
                                <span className="text-5xl font-black text-indigo-400 font-mono">
                                    R$ {price.toFixed(2)}
                                </span>

                                {selectedServiceId && (() => {
                                    const currentPracticedPrice = customPracticedPrices[selectedServiceId] !== undefined 
                                        ? customPracticedPrices[selectedServiceId] 
                                        : (services.find(s => s.id === selectedServiceId)?.defaultValue || 0);
                                    
                                    const costNumerator = (cHora * time) + cDireto + cLaboratorio;
                                    const variableRate = (tTributos + tFinanceira + cComissao) / 100;
                                    const practicedDeductions = currentPracticedPrice * variableRate;
                                    const practicedRealProfit = currentPracticedPrice - practicedDeductions - costNumerator;
                                    const practicedRealMarginPercent = currentPracticedPrice > 0 ? (practicedRealProfit / currentPracticedPrice) * 100 : 0;

                                    return (
                                        <div className="w-full space-y-3 mt-2 px-4">
                                            {/* KPI CARD: MARGEM REAL PRATICADA */}
                                            {currentPracticedPrice > 0 && (
                                                <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-xl p-3.5 shadow-lg relative overflow-hidden text-left">
                                                    <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2 mb-2">
                                                        <span className="text-[10px] uppercase font-extrabold text-indigo-300 tracking-wider flex items-center gap-1.5">
                                                            <span className="size-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                                            Margem Real com Preço Praticado (R$ {currentPracticedPrice.toFixed(2)})
                                                        </span>
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                                            practicedRealMarginPercent >= mLiquida 
                                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                                                                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                                        }`}>
                                                            {practicedRealMarginPercent >= mLiquida 
                                                                ? `+${(practicedRealMarginPercent - mLiquida).toFixed(1)}% acima da meta` 
                                                                : `${(mLiquida - practicedRealMarginPercent).toFixed(1)}% abaixo da meta`}
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2 text-center pt-1">
                                                        <div className="bg-panel/60 p-2 rounded-lg border border-border">
                                                            <span className="text-[9px] uppercase font-bold text-slate-400 block">Margem de Lucro Real</span>
                                                            <span className={`text-lg font-black font-mono ${practicedRealMarginPercent >= mLiquida ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                                {practicedRealMarginPercent.toFixed(1)}%
                                                            </span>
                                                            <span className="text-[8px] text-slate-500 block">Meta configurada: {mLiquida}%</span>
                                                        </div>
                                                        <div className="bg-panel/60 p-2 rounded-lg border border-border">
                                                            <span className="text-[9px] uppercase font-bold text-slate-400 block">Lucro Líquido Real / Proced.</span>
                                                            <span className={`text-lg font-black font-mono ${practicedRealProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                R$ {practicedRealProfit.toFixed(2)}
                                                            </span>
                                                            <span className="text-[8px] text-slate-500 block">Deduções Variáveis: R$ {practicedDeductions.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex justify-between items-center bg-panel rounded-xl p-3 border border-border">
                                                <div className="text-left">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Diferença de Preço (Gap):</span>
                                                    <span className={`text-[9px] font-bold ${
                                                        (price - currentPracticedPrice) > 0 ? 'text-amber-400' : (price - currentPracticedPrice) < 0 ? 'text-emerald-400' : 'text-blue-400'
                                                    }`}>
                                                        {(price - currentPracticedPrice) > 0 
                                                            ? 'Abaixo do Sugerido (Defasado)' 
                                                            : (price - currentPracticedPrice) < 0 
                                                            ? 'Acima do Sugerido (Lucro Extra)' 
                                                            : 'Exatamente no Preço Sugerido'}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-sm font-mono font-black ${
                                                        (price - currentPracticedPrice) > 0 ? 'text-amber-400' : 'text-emerald-400'
                                                    }`}>
                                                        {(price - currentPracticedPrice) > 0 
                                                            ? `-R$ ${(price - currentPracticedPrice).toFixed(2)}` 
                                                            : (price - currentPracticedPrice) < 0 
                                                            ? `+R$ ${(currentPracticedPrice - price).toFixed(2)}` 
                                                            : 'R$ 0.00'}
                                                    </span>
                                                    <span className="block text-[9px] text-slate-400 font-mono">
                                                        {currentPracticedPrice > 0 
                                                            ? (price - currentPracticedPrice) > 0
                                                                ? `${(((price / currentPracticedPrice) - 1) * 100).toFixed(1)}% abaixo do ideal`
                                                                : (price - currentPracticedPrice) < 0
                                                                ? `${(((currentPracticedPrice / price) - 1) * 100).toFixed(1)}% acima do sugerido`
                                                                : 'Preço alinhado com o sugerido'
                                                            : 'Informe o preço atual'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="text-[11px] text-slate-400 space-y-2.5 w-full mt-4">
                                                <div className="flex items-center justify-between border-b border-border pb-1">
                                                    <p className="font-extrabold text-slate-200 uppercase tracking-wider text-[11px]">
                                                        📊 Detalhamento Financeiro Comparativo
                                                    </p>
                                                    <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                                        Meta de Lucro: {mLiquida}%
                                                    </span>
                                                </div>

                                                {/* Comparative Table */}
                                                <div className="bg-panel rounded-xl border border-border p-3 overflow-x-auto shadow-md">
                                                    <table className="w-full text-left font-mono text-[10px] border-collapse">
                                                        <thead>
                                                            <tr className="border-b border-border text-slate-400 uppercase text-[9px]">
                                                                <th className="pb-2 font-bold">Linha de Cálculo</th>
                                                                <th className="pb-2 text-right text-indigo-300 font-bold">Preço Sugerido</th>
                                                                <th className="pb-2 text-right text-emerald-400 font-bold">Preço Praticado</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-border/50 text-slate-300">
                                                            {/* Preço de Venda */}
                                                            <tr>
                                                                <td className="py-1.5 font-bold text-slate-200">
                                                                    (+) Preço de Venda Bruto
                                                                </td>
                                                                <td className="py-1.5 text-right font-black text-indigo-400">
                                                                    R$ {price.toFixed(2)}
                                                                </td>
                                                                <td className="py-1.5 text-right font-black text-emerald-400">
                                                                    R$ {currentPracticedPrice.toFixed(2)}
                                                                </td>
                                                            </tr>

                                                            {/* Impostos + Taxas Financ */}
                                                            <tr>
                                                                <td className="py-1.5 text-slate-400">
                                                                    (-) Impostos & Cartão ({tTributos + tFinanceira}%)
                                                                </td>
                                                                <td className="py-1.5 text-right text-amber-400 font-medium">
                                                                    -R$ {(price * ((tTributos + tFinanceira) / 100)).toFixed(2)}
                                                                </td>
                                                                <td className="py-1.5 text-right text-amber-400 font-medium">
                                                                    -R$ {(currentPracticedPrice * ((tTributos + tFinanceira) / 100)).toFixed(2)}
                                                                </td>
                                                            </tr>

                                                            {/* Comissão */}
                                                            <tr>
                                                                <td className="py-1.5 text-slate-400">
                                                                    (-) Comissão Dentista ({cComissao}%)
                                                                </td>
                                                                <td className="py-1.5 text-right text-slate-300 font-medium">
                                                                    -R$ {(price * (cComissao / 100)).toFixed(2)}
                                                                </td>
                                                                <td className="py-1.5 text-right text-slate-300 font-medium">
                                                                    -R$ {(currentPracticedPrice * (cComissao / 100)).toFixed(2)}
                                                                </td>
                                                            </tr>

                                                            {/* Custo Operacional (Hora Cadeira + Direto + Lab) */}
                                                            <tr>
                                                                <td className="py-1.5 text-slate-400">
                                                                    (-) Custo Fixo Operacional
                                                                    <span className="block text-[8px] text-slate-500 italic">
                                                                        (Cadeira R$ {(cHora * time).toFixed(2)} + Mat. R$ {cDireto.toFixed(2)} + Lab R$ {cLaboratorio.toFixed(2)})
                                                                    </span>
                                                                </td>
                                                                <td className="py-1.5 text-right text-red-400 font-medium">
                                                                    -R$ {costNumerator.toFixed(2)}
                                                                </td>
                                                                <td className="py-1.5 text-right text-red-400 font-medium">
                                                                    -R$ {costNumerator.toFixed(2)}
                                                                </td>
                                                            </tr>

                                                            {/* Lucro Líquido Real */}
                                                            <tr className="bg-white/[0.03] font-bold border-t border-border">
                                                                <td className="py-2 text-slate-100">
                                                                    (=) Lucro Líquido Real (R$)
                                                                </td>
                                                                <td className="py-2 text-right text-indigo-300 font-black">
                                                                    R$ {(price - (price * variableRate) - costNumerator).toFixed(2)}
                                                                </td>
                                                                <td className="py-2 text-right text-emerald-400 font-black">
                                                                    R$ {practicedRealProfit.toFixed(2)}
                                                                </td>
                                                            </tr>

                                                            {/* Margem Líquida % */}
                                                            <tr className="bg-indigo-500/10 font-bold">
                                                                <td className="py-2 text-indigo-300">
                                                                    (=) Margem Líquida Real (%)
                                                                </td>
                                                                <td className="py-2 text-right text-indigo-300 font-black">
                                                                    {mLiquida.toFixed(1)}% <span className="text-[8px] text-slate-400 font-normal">(Meta)</span>
                                                                </td>
                                                                <td className={`py-2 text-right font-black ${practicedRealMarginPercent >= mLiquida ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                                    {practicedRealMarginPercent.toFixed(1)}%
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Clarifying Legend Box */}
                                                <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-lg p-2.5 text-[9.5px] text-slate-300 space-y-1 text-left">
                                                    <p className="font-bold text-indigo-300 flex items-center gap-1">
                                                        💡 O que estes números mostram?
                                                    </p>
                                                    <p>
                                                        • <strong className="text-white">Preço Sugerido (R$ {price.toFixed(2)}):</strong> É o valor exato calculado pela fórmula da folha para garantir a sua meta de <strong className="text-emerald-400">{mLiquida}% de margem líquida</strong>.
                                                    </p>
                                                    {currentPracticedPrice > 0 && (
                                                        <p>
                                                            • <strong className="text-white">Preço Praticado (R$ {currentPracticedPrice.toFixed(2)}):</strong> Como seu preço atual é maior que o sugerido, você ganha <strong className="text-emerald-400">R$ {(practicedRealProfit - (price - (price * variableRate) - costNumerator)).toFixed(2)} a mais de lucro por procedimento</strong>, elevando sua margem real para <strong className="text-emerald-400">{practicedRealMarginPercent.toFixed(1)}%</strong>!
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'pagamento' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div>
                            <h3 className="text-xl font-bold text-text">Simulador de Folha de Pagamento & Encargos</h3>
                            <p className="text-xs text-slate-400 mt-1">
                                Calcule o custo real de cada funcionário e dentista para o consultório incluindo impostos, benefícios, encargos sociais e trabalhistas.
                            </p>
                        </div>

                        {/* Two Columns Grid */}
                        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
                            
                            {/* Left Column: Encargos (1 part) */}
                            <div className="xl:col-span-1 space-y-4">
                                
                                {/* Encargos Trabalhistas Card */}
                                <div className="bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-xl">
                                    <h4 className="text-sm font-extrabold text-indigo-400 uppercase tracking-widest border-b border-border pb-2">
                                        Encargos Trabalhistas
                                    </h4>
                                    
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400">Provisão de Férias + 1/3:</span>
                                            <div className="flex items-center gap-1">
                                                <input 
                                                    type="number" 
                                                    step="0.01" 
                                                    value={provFerias} 
                                                    onChange={e => setProvFerias(Number(e.target.value))} 
                                                    className="w-16 bg-panel border border-border rounded px-1.5 py-1 text-right text-text font-mono text-xs focus:outline-none focus:border-indigo-500"
                                                />
                                                <span className="text-slate-500">%</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400">Provisão 13º Salário:</span>
                                            <div className="flex items-center gap-1">
                                                <input 
                                                    type="number" 
                                                    step="0.01" 
                                                    value={prov13Salario} 
                                                    onChange={e => setProv13Salario(Number(e.target.value))} 
                                                    className="w-16 bg-panel border border-border rounded px-1.5 py-1 text-right text-text font-mono text-xs focus:outline-none focus:border-indigo-500"
                                                />
                                                <span className="text-slate-500">%</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400">Previsão 13º s/ Férias:</span>
                                            <div className="flex items-center gap-1">
                                                <input 
                                                    type="number" 
                                                    step="0.01" 
                                                    value={prov13Ferias} 
                                                    onChange={e => setProv13Ferias(Number(e.target.value))} 
                                                    className="w-16 bg-panel border border-border rounded px-1.5 py-1 text-right text-text font-mono text-xs focus:outline-none focus:border-indigo-500"
                                                />
                                                <span className="text-slate-500">%</span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-border">
                                            <span className="text-text uppercase text-[10px] tracking-wider">Total Trabalhistas:</span>
                                            <span className="text-indigo-400 font-mono text-sm">
                                                {(provFerias + prov13Salario + prov13Ferias).toFixed(2)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Encargos Sociais Card */}
                                <div className="bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-xl">
                                    <h4 className="text-sm font-extrabold text-indigo-400 uppercase tracking-widest border-b border-border pb-2">
                                        Encargos Sociais
                                    </h4>
                                    
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400">INSS:</span>
                                            <div className="flex items-center gap-1">
                                                <input 
                                                    type="number" 
                                                    step="0.01" 
                                                    value={inss} 
                                                    onChange={e => setInss(Number(e.target.value))} 
                                                    className="w-16 bg-panel border border-border rounded px-1.5 py-1 text-right text-text font-mono text-xs focus:outline-none focus:border-indigo-500"
                                                />
                                                <span className="text-slate-500">%</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400">SAT/RAT:</span>
                                            <div className="flex items-center gap-1">
                                                <input 
                                                    type="number" 
                                                    step="0.01" 
                                                    value={satRat} 
                                                    onChange={e => setSatRat(Number(e.target.value))} 
                                                    className="w-16 bg-panel border border-border rounded px-1.5 py-1 text-right text-text font-mono text-xs focus:outline-none focus:border-indigo-500"
                                                />
                                                <span className="text-slate-500">%</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400">Salário Educação:</span>
                                            <div className="flex items-center gap-1">
                                                <input 
                                                    type="number" 
                                                    step="0.01" 
                                                    value={salarioEducacao} 
                                                    onChange={e => setSalarioEducacao(Number(e.target.value))} 
                                                    className="w-16 bg-panel border border-border rounded px-1.5 py-1 text-right text-text font-mono text-xs focus:outline-none focus:border-indigo-500"
                                                />
                                                <span className="text-slate-500">%</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400">Sistemas (Sebrae, etc):</span>
                                            <div className="flex items-center gap-1">
                                                <input 
                                                    type="number" 
                                                    step="0.01" 
                                                    value={incraSebrae} 
                                                    onChange={e => setIncraSebrae(Number(e.target.value))} 
                                                    className="w-16 bg-panel border border-border rounded px-1.5 py-1 text-right text-text font-mono text-xs focus:outline-none focus:border-indigo-500"
                                                />
                                                <span className="text-slate-500">%</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400">FGTS:</span>
                                            <div className="flex items-center gap-1">
                                                <input 
                                                    type="number" 
                                                    step="0.01" 
                                                    value={fgts} 
                                                    onChange={e => setFgts(Number(e.target.value))} 
                                                    className="w-16 bg-panel border border-border rounded px-1.5 py-1 text-right text-text font-mono text-xs focus:outline-none focus:border-indigo-500"
                                                />
                                                <span className="text-slate-500">%</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400">Rescisão Contratual:</span>
                                            <div className="flex items-center gap-1">
                                                <input 
                                                    type="number" 
                                                    step="0.01" 
                                                    value={fgtsRescisao} 
                                                    onChange={e => setFgtsRescisao(Number(e.target.value))} 
                                                    className="w-16 bg-panel border border-border rounded px-1.5 py-1 text-right text-text font-mono text-xs focus:outline-none focus:border-indigo-500"
                                                />
                                                <span className="text-slate-500">%</span>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-border">
                                            <span className="text-text uppercase text-[10px] tracking-wider">Total Sociais:</span>
                                            <span className="text-indigo-400 font-mono text-sm">
                                                {(inss + satRat + salarioEducacao + incraSebrae + fgts + fgtsRescisao).toFixed(2)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Sum of Charges */}
                                <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-5 flex justify-between items-center shadow-lg">
                                    <span className="text-xs font-extrabold text-text uppercase tracking-wider">Total Geral de Encargos:</span>
                                    <span className="text-xl font-black text-indigo-400 font-mono">
                                        {(provFerias + prov13Salario + prov13Ferias + inss + satRat + salarioEducacao + incraSebrae + fgts + fgtsRescisao).toFixed(2)}%
                                    </span>
                                </div>
                            </div>

                            {/* Right Column: Employees list (3 parts) */}
                            <div className="xl:col-span-3 space-y-6">
                                
                                {/* Metrics Cards Banner */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-panel p-5 border border-border rounded-2xl shadow-md">
                                    <div className="p-4 bg-panel rounded-2xl border border-border">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Equipe Total</span>
                                        <span className="text-2xl font-black text-text font-mono mt-2 block">
                                            {employees.length.toString().padStart(2, '0')} <span className="text-xs text-slate-500 font-medium">Pessoas</span>
                                        </span>
                                    </div>
                                    <div className="p-4 bg-panel rounded-2xl border border-border">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Salário Base Total</span>
                                        <span className="text-2xl font-black text-text font-mono mt-2 block text-indigo-400">
                                            R$ {employees.reduce((sum, e) => sum + e.salary, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="p-4 bg-panel rounded-2xl border border-border">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Total Encargos</span>
                                        <span className="text-2xl font-black text-amber-500 font-mono mt-2 block">
                                            R$ {employees.reduce((sum, e) => {
                                                if (e.contractType !== 'CLT') return sum;
                                                const totalTrab = (provFerias + prov13Salario + prov13Ferias) / 100;
                                                const totalSoc = (inss + satRat + salarioEducacao + incraSebrae + fgts + fgtsRescisao) / 100;
                                                return sum + (e.salary * (totalTrab + totalSoc));
                                            }, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="p-4 bg-panel rounded-2xl border border-border">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Custo Folha Geral</span>
                                        <span className="text-2xl font-black text-emerald-400 font-mono mt-2 block">
                                            R$ {employees.reduce((sum, e) => {
                                                const totalTrab = e.contractType === 'CLT' ? (provFerias + prov13Salario + prov13Ferias) / 100 : 0;
                                                const totalSoc = e.contractType === 'CLT' ? (inss + satRat + salarioEducacao + incraSebrae + fgts + fgtsRescisao) / 100 : 0;
                                                const charges = e.salary * (totalTrab + totalSoc);
                                                return sum + e.salary + charges + e.valeTransporte + e.valeRefeicao + e.convenioMedico;
                                            }, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>

                                {/* Spreadsheet View Container */}
                                <div className="border border-border rounded-2xl overflow-hidden bg-panel shadow-lg">
                                    <div className="overflow-x-auto custom-scrollbar">
                                        <table className="w-full text-left text-xs text-slate-300 min-w-[1500px] border-collapse">
                                            <thead className="bg-panel text-slate-400 uppercase font-bold tracking-wider text-[10px] border-b border-border">
                                                <tr>
                                                    <th className="px-4 py-3 w-20 text-center">Código</th>
                                                    <th className="px-4 py-3 w-56">Nome do Colaborador / Dentista</th>
                                                    <th className="px-4 py-3 w-32">Contratação</th>
                                                    <th className="px-4 py-3 w-36 text-right">Salário Base (R$)</th>
                                                    <th className="px-4 py-3 w-32">Setor</th>
                                                    <th className="px-4 py-3 w-32">Cargo</th>
                                                    <th className="px-4 py-3 w-32 text-right">Enc. Sociais</th>
                                                    <th className="px-4 py-3 w-32 text-right">Enc. Trabalhistas</th>
                                                    <th className="px-4 py-3 w-28 text-right">V. Transporte (R$)</th>
                                                    <th className="px-4 py-3 w-28 text-right">V. Refeição (R$)</th>
                                                    <th className="px-4 py-3 w-28 text-right">Conv. Médico (R$)</th>
                                                    <th className="px-4 py-3 w-36 font-black text-text text-right">Total Custo (R$)</th>
                                                    <th className="px-4 py-3 w-24 text-center">Horas/Mês</th>
                                                    <th className="px-4 py-3 w-32 font-bold text-indigo-300 text-right">Valor por Hora (R$)</th>
                                                    <th className="px-4 py-3 w-16 text-center">Remover</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5 font-medium">
                                                {employees.map((emp) => {
                                                    const isClt = emp.contractType === 'CLT';
                                                    
                                                    const totalTrabPct = provFerias + prov13Salario + prov13Ferias;
                                                    const totalSocPct = inss + satRat + salarioEducacao + incraSebrae + fgts + fgtsRescisao;

                                                    const calculatedSoc = isClt ? emp.salary * (totalSocPct / 100) : 0;
                                                    const calculatedTrab = isClt ? emp.salary * (totalTrabPct / 100) : 0;

                                                    const totalCusto = emp.salary + calculatedSoc + calculatedTrab + emp.valeTransporte + emp.valeRefeicao + emp.convenioMedico;
                                                    const valorHora = emp.hoursPerMonth > 0 ? totalCusto / emp.hoursPerMonth : 0;

                                                    return (
                                                        <tr key={emp.id} className="hover:bg-panel transition-all text-slate-200">
                                                            <td className="px-4 py-3 text-center font-mono text-slate-500 text-xs">{emp.code}</td>
                                                            <td className="px-4 py-3">
                                                                <input 
                                                                    type="text"
                                                                    value={emp.name}
                                                                    onChange={e => handleEmployeeChange(emp.id, 'name', e.target.value)}
                                                                    className="w-full bg-transparent focus:bg-panel border border-transparent focus:border-border rounded px-2 py-1 text-text font-semibold outline-none"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <select 
                                                                    value={emp.contractType}
                                                                    onChange={e => handleEmployeeChange(emp.id, 'contractType', e.target.value as any)}
                                                                    className="w-full bg-slate-800 border border-border rounded px-2 py-1 text-text text-xs outline-none focus:border-indigo-500 [&>option]:bg-surface"
                                                                >
                                                                    <option value="PJ">PJ</option>
                                                                    <option value="CLT">CLT</option>
                                                                    <option value="Dentista">Dentista (Parceiro)</option>
                                                                    <option value="Autônomo">Autônomo</option>
                                                                </select>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input 
                                                                    type="number"
                                                                    step="any"
                                                                    value={emp.salary || ''}
                                                                    placeholder="0,00"
                                                                    onChange={e => handleEmployeeChange(emp.id, 'salary', Number(e.target.value))}
                                                                    className="w-full bg-transparent focus:bg-panel border border-transparent focus:border-border rounded px-2 py-1 text-text text-right font-mono text-xs outline-none"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input 
                                                                    type="text"
                                                                    value={emp.sector}
                                                                    onChange={e => handleEmployeeChange(emp.id, 'sector', e.target.value)}
                                                                    className="w-full bg-transparent focus:bg-panel border border-transparent focus:border-border rounded px-2 py-1 text-slate-300 text-xs outline-none"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input 
                                                                    type="text"
                                                                    value={emp.role}
                                                                    onChange={e => handleEmployeeChange(emp.id, 'role', e.target.value)}
                                                                    className="w-full bg-transparent focus:bg-panel border border-transparent focus:border-border rounded px-2 py-1 text-slate-300 text-xs outline-none"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono text-[11px] text-slate-400">
                                                                R$ {calculatedSoc.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono text-[11px] text-slate-400">
                                                                R$ {calculatedTrab.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input 
                                                                    type="number"
                                                                    step="any"
                                                                    value={emp.valeTransporte || ''}
                                                                    placeholder="0,00"
                                                                    onChange={e => handleEmployeeChange(emp.id, 'valeTransporte', Number(e.target.value))}
                                                                    className="w-full bg-transparent focus:bg-panel border border-transparent focus:border-border rounded px-2 py-1 text-text text-right font-mono text-xs outline-none"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input 
                                                                    type="number"
                                                                    step="any"
                                                                    value={emp.valeRefeicao || ''}
                                                                    placeholder="0,00"
                                                                    onChange={e => handleEmployeeChange(emp.id, 'valeRefeicao', Number(e.target.value))}
                                                                    className="w-full bg-transparent focus:bg-panel border border-transparent focus:border-border rounded px-2 py-1 text-text text-right font-mono text-xs outline-none"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input 
                                                                    type="number"
                                                                    step="any"
                                                                    value={emp.convenioMedico || ''}
                                                                    placeholder="0,00"
                                                                    onChange={e => handleEmployeeChange(emp.id, 'convenioMedico', Number(e.target.value))}
                                                                    className="w-full bg-transparent focus:bg-panel border border-transparent focus:border-border rounded px-2 py-1 text-text text-right font-mono text-xs outline-none"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 font-mono text-xs font-black text-text text-right">
                                                                R$ {totalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input 
                                                                    type="number"
                                                                    step="any"
                                                                    value={emp.hoursPerMonth || ''}
                                                                    placeholder="220"
                                                                    onChange={e => handleEmployeeChange(emp.id, 'hoursPerMonth', Number(e.target.value))}
                                                                    className="w-full bg-transparent focus:bg-panel border border-transparent focus:border-border rounded px-2 py-1 text-text text-center font-mono text-xs outline-none"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 font-mono text-xs font-black text-indigo-300 text-right">
                                                                R$ {valorHora.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <button 
                                                                    onClick={() => handleDeleteEmployee(emp.id)}
                                                                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {employees.length === 0 && (
                                                    <tr>
                                                        <td colSpan={15} className="px-4 py-10 text-center text-slate-500">
                                                            Nenhum colaborador ou dentista cadastrado na folha de pagamento.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center bg-panel p-4 border border-border rounded-2xl">
                                    <span className="text-[11px] text-slate-400 leading-relaxed max-w-md">
                                        💡 <strong>Dica de Cálculo:</strong> Mantenha a carga horária e os salários corretos para que o valor por hora de cada colaborador reflita o custo operacional exato na aba <strong>Tabela de Precificação</strong>.
                                    </span>
                                    <button 
                                        onClick={handleAddEmployee}
                                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-text px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-lg shadow-indigo-600/15"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Adicionar Colaborador
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'fixas' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h3 className="text-xl font-bold text-text">Gestão de Despesas Fixas</h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Monitore e edite todas as despesas de manutenção da clínica. Os valores e itens abaixo são baseados na planilha consolidada de despesas da clínica.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button 
                                    onClick={handleAddFixedExpense}
                                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-text px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-md shadow-indigo-600/15"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Adicionar Item
                                </button>
                                <button 
                                    onClick={handleResetFixedExpenses}
                                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-border px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    Padrão do Print
                                </button>
                                <button 
                                    onClick={handleClearAllFixedExpenses}
                                    className="flex items-center gap-1.5 bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-500/10 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Zerar Valores
                                </button>
                            </div>
                        </div>

                        {/* Spreadsheet View similar to print */}
                        <div className="max-w-xl mx-auto border border-border rounded-2xl overflow-hidden shadow-2xl bg-surface">
                            {/* Blue Banner Header */}
                            <div className="bg-surface p-3 text-text flex justify-between items-center font-extrabold tracking-wider border-b border-border shadow-lg">
                                <span className="text-sm font-sans tracking-widest pl-2">TOTAL DE DESPESAS FIXAS</span>
                                <span className="text-base font-mono bg-panel px-3 py-1 rounded-lg">
                                    R$ {totalFixedExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>

                            {/* Column Header (Grey) */}
                            <div className="bg-surface text-slate-200 text-xs font-bold py-2 px-4 grid grid-cols-12 border-b border-border select-none">
                                <div className="col-span-8 text-center uppercase tracking-wider text-[11px]">Descrição</div>
                                <div className="col-span-3 text-center uppercase tracking-wider text-[11px]">TOTAL</div>
                                <div className="col-span-1"></div>
                            </div>

                            {/* Section Header (Despesas Fixas) */}
                            <div className="bg-surface text-text text-xs font-extrabold py-2 px-4 grid grid-cols-12 border-b border-border select-none">
                                <div className="col-span-8 pl-2">Despesas Fixas</div>
                                <div className="col-span-3 text-right pr-2 font-mono">
                                    R$&nbsp;&nbsp;&nbsp;{totalFixedExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="col-span-1"></div>
                            </div>

                            {/* Spreadsheet rows */}
                            <div className="max-h-[500px] overflow-y-auto custom-scrollbar divide-y divide-white/5">
                                {processedFixedExpenses.map((item) => {
                                    const isHighlight = item.isHighlighted;
                                    const isPayroll = item.id === '1';
                                    return (
                                        <div 
                                            key={item.id} 
                                            className={`grid grid-cols-12 items-center py-1.5 px-4 text-xs transition-colors group ${
                                                isPayroll
                                                    ? 'bg-indigo-950/20 hover:bg-indigo-950/30 border-l-4 border-indigo-500 text-indigo-300 font-medium'
                                                    : isHighlight 
                                                        ? 'bg-emerald-950/20 hover:bg-emerald-950/30 border-l-4 border-emerald-500/40 text-emerald-300' 
                                                        : 'hover:bg-panel text-slate-200'
                                            }`}
                                        >
                                            {/* Description field */}
                                            <div className="col-span-8 pr-3 pl-1 flex items-center gap-2">
                                                {isPayroll ? (
                                                    <RefreshCw className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                                ) : isHighlight ? (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                                                ) : null}
                                                <input 
                                                    type="text"
                                                    value={item.description}
                                                    onChange={e => handleFixedExpenseChange(item.id, 'description', e.target.value)}
                                                    disabled={isPayroll}
                                                    className={`w-full bg-transparent border border-transparent rounded px-2 py-1 outline-none ${
                                                        isPayroll 
                                                            ? 'text-indigo-200 font-bold cursor-default select-none' 
                                                            : 'text-slate-100 focus:bg-panel focus:border-border hover:border-border focus:text-text'
                                                    }`}
                                                    placeholder="Descreva a despesa..."
                                                />
                                                {isPayroll && (
                                                    <span className="bg-indigo-500/20 text-indigo-300 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider scale-95 shrink-0 select-none border border-indigo-500/15" title="Sincronizado automaticamente da Folha de Pagamento">
                                                        Auto Sinc
                                                    </span>
                                                )}
                                            </div>

                                            {/* Value field */}
                                            <div className="col-span-3 flex items-center gap-1 font-mono">
                                                <span className={`${isPayroll ? 'text-indigo-400/80' : 'text-slate-500'} shrink-0 select-none`}>R$</span>
                                                <input 
                                                    type="number"
                                                    step="any"
                                                    value={item.value === null ? '' : item.value}
                                                    onChange={e => {
                                                        const val = e.target.value === '' ? null : Number(e.target.value);
                                                        handleFixedExpenseChange(item.id, 'value', val);
                                                    }}
                                                    disabled={isPayroll}
                                                    placeholder="--"
                                                    className={`w-full bg-transparent text-right border border-transparent rounded px-2 py-1 outline-none font-semibold ${
                                                        isPayroll 
                                                            ? 'text-indigo-300 cursor-default select-none' 
                                                            : 'text-text focus:bg-panel focus:border-border focus:text-indigo-300'
                                                    }`}
                                                />
                                            </div>

                                            {/* Delete button */}
                                            <div className="col-span-1 text-center">
                                                {!isPayroll && (
                                                    <button 
                                                        onClick={() => handleDeleteFixedExpense(item.id)}
                                                        className="text-slate-600 hover:text-red-400 hover:bg-red-500/10 p-1 rounded transition-colors"
                                                        title="Remover Despesa"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {processedFixedExpenses.length === 0 && (
                                    <div className="text-center py-10 text-slate-500 text-xs">
                                        Nenhuma despesa fixa cadastrada. Clique em "Adicionar Item" ou "Padrão do Print" para preencher.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Extra Tip Card */}
                        <div className="max-w-xl mx-auto bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-4 text-xs text-slate-300 flex items-start gap-3">
                            <span className="text-base select-none shrink-0 mt-0.5">💡</span>
                            <div>
                                <p className="font-bold text-text mb-0.5">Informação de Integração:</p>
                                <p className="leading-relaxed text-slate-400">
                                    Essas despesas fixas estão salvas de forma local e segura no seu navegador. Você pode editá-las a qualquer momento para refletir as flutuações mensais da sua clínica, adicionando novos compromissos ou redefinindo para as configurações iniciais da planilha de base.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'cenarios' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {/* Header & Controls */}
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                            <div>
                                <h3 className="text-xl font-bold text-text">Simulador de Cenários & Forecast</h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Simule o impacto de volumes de venda e preços praticados no faturamento, margens de contribuição e no lucro líquido final.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button 
                                    onClick={handleRestoreScenarioQuantitiesPattern}
                                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-text px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                                    title="Preencher com volumes de vendas reais do print de referência"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    Padrão do Print
                                </button>
                                <button 
                                    onClick={handleClearScenarioQuantities}
                                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-border px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Zerar Quantidades
                                </button>
                                <button 
                                    onClick={handleResetScenarioPricesToDefaults}
                                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-border px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                                >
                                    <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                                    Resetar Preços
                                </button>
                            </div>
                        </div>

                        {/* Search and Filters */}
                        <div className="flex items-center gap-2 max-w-md bg-panel border border-border rounded-xl px-3 py-2">
                            <Search className="w-4 h-4 text-slate-500 shrink-0" />
                            <input 
                                type="text"
                                placeholder="Buscar procedimento para simular..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-transparent text-xs text-text placeholder-slate-500 focus:outline-none"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="text-xs text-slate-400 hover:text-text"
                                >
                                    Limpar
                                </button>
                            )}
                        </div>

                        {/* Excel-like Totalizers Header Panel */}
                        <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-2xl">
                            {/* Title bar */}
                            <div className="bg-surface px-4 py-2.5 text-text flex justify-between items-center border-b border-border shadow-md">
                                <span className="text-xs font-extrabold tracking-wider uppercase">TOTALIZADORES DO CENÁRIO SIMULADO</span>
                                <span className="text-[10px] bg-panel text-slate-300 px-2.5 py-1 rounded border border-border font-semibold">
                                    Base Despesas Fixas: R$ {totalFixedExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>

                            {/* Aggregates row */}
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 divide-y lg:divide-y-0 lg:divide-x divide-white/10 bg-panel text-center">
                                {/* Qty */}
                                <div className="p-3">
                                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Volume Total</span>
                                    <span className="block text-sm font-mono font-bold text-slate-200 mt-1">
                                        {scenarioTotals.totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} un
                                    </span>
                                </div>

                                {/* Faturamento */}
                                <div className="p-3 bg-indigo-950/10">
                                    <span className="block text-[10px] text-indigo-300 font-bold uppercase tracking-wider">Faturamento Previsto</span>
                                    <span className="block text-[9px] text-indigo-400/80 font-medium italic">Origem: Tab Precificação / Cenários</span>
                                    <span className="block text-sm font-mono font-bold text-text mt-1">
                                        R$ {scenarioTotals.totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>

                                {/* Custos Variáveis */}
                                <div className="p-3">
                                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Custos Variáveis</span>
                                    <span className="block text-[9px] text-slate-500 font-medium italic">Origem: Matéria Prima e Ficha Técnica</span>
                                    <span className="block text-sm font-mono font-semibold text-slate-200 mt-1">
                                        R$ {scenarioTotals.totalVariableCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    <span className="block text-[9px] font-mono text-slate-500">
                                        {scenarioTotals.totalFaturamento > 0 ? ((scenarioTotals.totalVariableCost / scenarioTotals.totalFaturamento) * 100).toFixed(1) : '0.0'}% do fat.
                                    </span>
                                </div>

                                {/* Impostos */}
                                <div className="p-3">
                                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Impostos s/ Vendas</span>
                                    <span className="block text-sm font-mono font-semibold text-slate-200 mt-1">
                                        R$ {scenarioTotals.totalTaxes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    <span className="block text-[9px] font-mono text-slate-500">
                                        {scenarioTotals.totalFaturamento > 0 ? ((scenarioTotals.totalTaxes / scenarioTotals.totalFaturamento) * 100).toFixed(1) : '0.0'}% do fat.
                                    </span>
                                </div>

                                {/* Margem de Contribuição */}
                                <div className="p-3 bg-emerald-950/10">
                                    <span className="block text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Margem de Contribuição</span>
                                    <span className="block text-sm font-mono font-bold text-emerald-400 mt-1">
                                        R$ {scenarioTotals.totalMargemContribuicaoValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    <span className="block text-[10px] font-mono font-bold text-emerald-300">
                                        {scenarioTotals.totalMargemContribuicaoPct.toFixed(1)}%
                                    </span>
                                </div>

                                {/* Rateio Fixo */}
                                <div className="p-3">
                                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Despesas Fixas</span>
                                    <span className="block text-[9px] text-slate-500 font-medium italic">Origem: Tab Despesas Fixas</span>
                                    <span className="block text-sm font-mono font-semibold text-slate-200 mt-1">
                                        R$ {totalFixedExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    <span className="block text-[9px] font-mono text-slate-500">
                                        100.0% rateado
                                    </span>
                                </div>

                                {/* Margem de Lucro */}
                                <div className={`p-3 ${scenarioTotals.totalProfitValue >= 0 ? 'bg-emerald-950/20' : 'bg-red-950/20'}`}>
                                    <span className={`block text-[10px] font-bold uppercase tracking-wider ${scenarioTotals.totalProfitValue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        Margem de Lucro
                                    </span>
                                    <span className={`block text-sm font-mono font-black mt-1 ${scenarioTotals.totalProfitValue >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                                        R$ {scenarioTotals.totalProfitValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    <span className={`block text-[10px] font-mono font-bold ${scenarioTotals.totalProfitValue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {scenarioTotals.totalProfitPct.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Dynamic Spreadsheet Table */}
                        <div className="border border-border rounded-2xl bg-panel shadow-xl">
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse min-w-[1700px]">
                                    <thead>
                                        <tr className="bg-surface text-text text-[11px] font-bold tracking-wider select-none divide-x divide-white/10">
                                            <th className="py-2.5 px-3 text-center w-16">Código</th>
                                            <th className="py-2.5 px-4 text-left w-72">Produtos / Serviços</th>
                                            <th className="py-2.5 px-3 text-right w-36 text-emerald-300">Preço Sugerido (Meta)</th>
                                            <th className="py-2.5 px-3 text-right w-36 bg-surface">Preço Praticado Atual</th>
                                            <th className="py-2.5 px-3 text-right w-32">Previsão de Vendas</th>
                                            <th className="py-2.5 px-3 text-right w-36 bg-surface">
                                                <div className="group relative flex items-center justify-end gap-1">
                                                    Faturamento Previsto
                                                    <HelpCircle className="w-3 h-3 text-indigo-400" />
                                                    <div className="absolute hidden group-hover:block bg-slate-900 text-text text-[10px] p-2 rounded z-[100] w-48 top-full mt-2 right-0 shadow-lg border border-border whitespace-normal">
                                                        Receita total prevista baseada no preço e quantidade
                                                    </div>
                                                </div>
                                            </th>
                                            <th className="py-2.5 px-3 text-right w-32">
                                                <div className="group relative flex items-center justify-end gap-1">
                                                    Custos Variáveis
                                                    <HelpCircle className="w-3 h-3 text-indigo-400" />
                                                    <div className="absolute hidden group-hover:block bg-slate-900 text-text text-[10px] p-2 rounded z-[100] w-48 top-full mt-2 right-0 shadow-lg border border-border whitespace-normal">
                                                        Soma de custos diretos (materiais/mão de obra) e custos laboratoriais da Ficha Técnica
                                                    </div>
                                                </div>
                                            </th>
                                            <th className="py-2.5 px-3 text-right w-32">
                                                <div className="group relative flex items-center justify-end gap-1">
                                                    Impostos s/ Vendas
                                                    <HelpCircle className="w-3 h-3 text-indigo-400" />
                                                    <div className="absolute hidden group-hover:block bg-slate-900 text-text text-[10px] p-2 rounded z-[100] w-48 top-full mt-2 right-0 shadow-lg border border-border whitespace-normal">
                                                        Percentual de impostos aplicado sobre o faturamento
                                                    </div>
                                                </div>
                                            </th>
                                            <th className="py-2.5 px-3 text-right w-32">
                                                <div className="group relative flex items-center justify-end gap-1">
                                                    Taxa Cartão
                                                    <HelpCircle className="w-3 h-3 text-indigo-400" />
                                                    <div className="absolute hidden group-hover:block bg-slate-900 text-text text-[10px] p-2 rounded z-[100] w-48 top-full mt-2 right-0 shadow-lg border border-border whitespace-normal">
                                                        Taxa financeira de cartão aplicada sobre o faturamento
                                                    </div>
                                                </div>
                                            </th>
                                            <th className="py-2.5 px-3 text-right w-32">
                                                <div className="group relative flex items-center justify-end gap-1">
                                                    Taxa Aplicativo
                                                    <HelpCircle className="w-3 h-3 text-indigo-400" />
                                                    <div className="absolute hidden group-hover:block bg-slate-900 text-text text-[10px] p-2 rounded z-[100] w-48 top-full mt-2 right-0 shadow-lg border border-border whitespace-normal">
                                                        Taxa do aplicativo sobre o faturamento
                                                    </div>
                                                </div>
                                            </th>
                                            <th className="py-2.5 px-3 text-right w-32">
                                                <div className="group relative flex items-center justify-end gap-1">
                                                    Comissão Vendas
                                                    <HelpCircle className="w-3 h-3 text-indigo-400" />
                                                    <div className="absolute hidden group-hover:block bg-slate-900 text-text text-[10px] p-2 rounded z-[100] w-48 top-full mt-2 right-0 shadow-lg border border-border whitespace-normal">
                                                        Comissão de vendas sobre o faturamento
                                                    </div>
                                                </div>
                                            </th>
                                            <th className="py-2.5 px-3 text-right w-36 bg-emerald-950/20">
                                                <div className="group relative flex items-center justify-end gap-1">
                                                    Margem Contribuição (R$)
                                                    <HelpCircle className="w-3 h-3 text-emerald-400" />
                                                    <div className="absolute hidden group-hover:block bg-slate-900 text-text text-[10px] p-2 rounded z-[100] w-48 top-full mt-2 right-0 shadow-lg border border-border whitespace-normal">
                                                        Faturamento - Custos Variáveis - Impostos - Taxas - Comissão
                                                    </div>
                                                </div>
                                            </th>
                                            <th className="py-2.5 px-3 text-center w-24 bg-emerald-950/10">
                                                <div className="group relative flex items-center justify-center gap-1">
                                                    Margem Contrib. (%)
                                                    <HelpCircle className="w-3 h-3 text-emerald-400" />
                                                    <div className="absolute hidden group-hover:block bg-slate-900 text-text text-[10px] p-2 rounded z-[100] w-48 top-full mt-2 right-0 shadow-lg border border-border whitespace-normal">
                                                        Margem de Contribuição / Faturamento
                                                    </div>
                                                </div>
                                            </th>
                                            <th className="py-2.5 px-3 text-right w-32">
                                                <div className="group relative flex items-center justify-end gap-1">
                                                    Rateio Despesas Fixas
                                                    <HelpCircle className="w-3 h-3 text-indigo-400" />
                                                    <div className="absolute hidden group-hover:block bg-slate-900 text-text text-[10px] p-2 rounded z-[100] w-48 top-full mt-2 right-0 shadow-lg border border-border whitespace-normal">
                                                        Rateio das despesas fixas baseado na participação deste serviço no faturamento total
                                                    </div>
                                                </div>
                                            </th>
                                            <th className="py-2.5 px-3 text-right w-36">
                                                <div className="group relative flex items-center justify-end gap-1">
                                                    Margem Lucro (R$)
                                                    <HelpCircle className="w-3 h-3 text-indigo-400" />
                                                    <div className="absolute hidden group-hover:block bg-slate-900 text-text text-[10px] p-2 rounded z-[100] w-48 top-full mt-2 right-0 shadow-lg border border-border whitespace-normal">
                                                        Margem de Contribuição - Rateio das Despesas Fixas
                                                    </div>
                                                </div>
                                            </th>
                                            <th className="py-2.5 px-3 text-center w-24">
                                                <div className="group relative flex items-center justify-center gap-1">
                                                    Margem Lucro (%)
                                                    <HelpCircle className="w-3 h-3 text-indigo-400" />
                                                    <div className="absolute hidden group-hover:block bg-slate-900 text-text text-[10px] p-2 rounded z-[100] w-48 top-full mt-2 right-0 shadow-lg border border-border whitespace-normal">
                                                        Margem de Lucro / Faturamento
                                                    </div>
                                                </div>
                                            </th>
                                            <th className="py-2.5 px-3 text-center w-24">
                                                <div className="group relative flex items-center justify-center gap-1">
                                                    Mark-up Mult.
                                                    <HelpCircle className="w-3 h-3 text-indigo-400" />
                                                    <div className="absolute hidden group-hover:block bg-slate-900 text-text text-[10px] p-2 rounded z-[100] w-48 top-full mt-2 right-0 shadow-lg border border-border whitespace-normal">
                                                        Preço de Venda / Custo Variável Unitário
                                                    </div>
                                                </div>
                                            </th>
                                            <th className="py-2.5 px-3 text-center w-20">
                                                <div className="group relative flex items-center justify-center gap-1">
                                                    % do Mix
                                                    <HelpCircle className="w-3 h-3 text-indigo-400" />
                                                    <div className="absolute hidden group-hover:block bg-slate-900 text-text text-[10px] p-2 rounded z-[100] w-48 top-full mt-2 right-0 shadow-lg border border-border whitespace-normal">
                                                        Participação deste serviço no Faturamento Total
                                                    </div>
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-[11px] font-sans">
                                        {filteredItems.map((item) => {
                                            const hasVolume = item.quantity > 0;
                                            const isNegativeProfit = item.margemLucroValue < 0;
                                            return (
                                                <tr 
                                                    key={item.id} 
                                                    className={`hover:bg-panel transition-colors divide-x divide-white/5 ${
                                                        hasVolume 
                                                            ? 'bg-indigo-950/10 text-slate-100 font-medium' 
                                                            : 'text-slate-400'
                                                    }`}
                                                >
                                                    {/* Código */}
                                                    <td className="py-2 px-3 text-center font-mono font-semibold text-slate-500">{item.code}</td>

                                                    {/* Nome do Serviço */}
                                                    <td className="py-2 px-4 font-medium text-slate-200">
                                                        <div className="truncate max-w-[280px]" title={item.name}>
                                                            {item.name}
                                                        </div>
                                                    </td>

                                                    {/* Preço Sugerido (Calculado) */}
                                                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400/90">
                                                        R$ {item.suggestedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>

                                                    {/* Preço de Vendas Praticado (Editable) */}
                                                    <td className="py-1 px-2 text-right bg-surface">
                                                        <div className="flex items-center justify-end gap-1 bg-panel border border-border hover:border-indigo-500/30 focus-within:border-indigo-500 rounded px-1.5 py-1">
                                                            <span className="text-slate-500 select-none text-[10px]">R$</span>
                                                            <input 
                                                                type="number"
                                                                step="any"
                                                                value={customPracticedPrices[item.id] !== undefined ? customPracticedPrices[item.id] : item.price}
                                                                onChange={(e) => {
                                                                    const val = e.target.value === '' ? item.price : Number(e.target.value);
                                                                    handleScenarioPriceChange(item.id, val);
                                                                }}
                                                                className="w-full bg-transparent border-none text-right font-mono font-bold text-text outline-none"
                                                            />
                                                        </div>
                                                    </td>

                                                    {/* Previsão de Vendas (Editable) */}
                                                    <td className="py-1 px-2 text-right">
                                                        <div className="flex items-center justify-end bg-panel border border-border hover:border-indigo-500/30 focus-within:border-indigo-500 rounded px-1.5 py-1">
                                                            <input 
                                                                type="number"
                                                                step="any"
                                                                value={scenarioQuantities[item.id] !== undefined && scenarioQuantities[item.id] !== 0 ? scenarioQuantities[item.id] : ''}
                                                                placeholder="0"
                                                                onChange={(e) => {
                                                                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                                                                    handleScenarioQuantityChange(item.id, val);
                                                                }}
                                                                className="w-full bg-transparent border-none text-right font-mono font-bold text-indigo-300 outline-none placeholder-slate-600"
                                                            />
                                                        </div>
                                                    </td>

                                                    {/* Faturamento Previsto */}
                                                    <td className="py-2 px-3 text-right font-mono font-bold text-text bg-surface">
                                                        {item.faturamento > 0 ? `R$ ${item.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ -'}
                                                    </td>

                                                    {/* Custos Variáveis */}
                                                    <td className="py-2 px-3 text-right font-mono text-slate-300">
                                                        {item.totalVariableCost > 0 ? `R$ ${item.totalVariableCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ -'}
                                                    </td>

                                                    {/* Impostos s/ Vendas */}
                                                    <td className="py-2 px-3 text-right font-mono text-slate-300">
                                                        {item.totalTaxes > 0 ? `R$ ${item.totalTaxes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ -'}
                                                    </td>

                                                    {/* Taxa Cartão */}
                                                    <td className="py-2 px-3 text-right font-mono text-slate-300">
                                                        {item.totalCardFee > 0 ? `R$ ${item.totalCardFee.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ -'}
                                                    </td>

                                                    {/* Taxa Aplicativo */}
                                                    <td className="py-2 px-3 text-right font-mono text-slate-500">-</td>

                                                    {/* Comissão Vendas */}
                                                    <td className="py-2 px-3 text-right font-mono text-slate-300">
                                                        {item.totalCommission > 0 ? `R$ ${item.totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ -'}
                                                    </td>

                                                    {/* Margem Contribuição (R$) */}
                                                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400 bg-emerald-950/5">
                                                        {item.faturamento > 0 ? `R$ ${item.margemContribuicaoValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ -'}
                                                    </td>

                                                    {/* Margem Contribuição (%) */}
                                                    <td className="py-2 px-3 text-center font-mono font-bold text-emerald-300 bg-emerald-950/10">
                                                        {item.faturamento > 0 ? `${item.margemContribuicaoPct.toFixed(1)}%` : '0,0%'}
                                                    </td>

                                                    {/* Rateio Despesas Fixas */}
                                                    <td className="py-2 px-3 text-right font-mono text-slate-300">
                                                        {item.rateioDespesasFixas > 0 ? `R$ ${item.rateioDespesasFixas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ -'}
                                                    </td>

                                                    {/* Margem Lucro (R$) */}
                                                    <td className={`py-2 px-3 text-right font-mono font-bold ${
                                                        item.faturamento === 0 
                                                            ? 'text-slate-500' 
                                                            : isNegativeProfit 
                                                                ? 'text-red-400 bg-red-950/5' 
                                                                : 'text-emerald-400 bg-emerald-950/5'
                                                    }`}>
                                                        {item.faturamento > 0 ? `R$ ${item.margemLucroValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ -'}
                                                    </td>

                                                    {/* Margem Lucro (%) */}
                                                    <td className={`py-2 px-3 text-center font-mono font-bold ${
                                                        item.faturamento === 0 
                                                            ? 'text-slate-500' 
                                                            : isNegativeProfit 
                                                                ? 'text-red-400/90' 
                                                                : 'text-emerald-400/90'
                                                    }`}>
                                                        {item.faturamento > 0 ? `${item.margemLucroPct.toFixed(1)}%` : '0,0%'}
                                                    </td>

                                                    {/* Mark-up Multiplicador */}
                                                    <td className="py-2 px-3 text-center font-mono text-slate-300">
                                                        {item.markup > 0 ? item.markup.toFixed(2) : '-'}
                                                    </td>

                                                    {/* % do Mix */}
                                                    <td className="py-2 px-3 text-center font-mono text-slate-400">
                                                        {item.faturamento > 0 ? `${item.mixPct.toFixed(1)}%` : '0,0%'}
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {filteredItems.length === 0 && (
                                            <tr>
                                                <td colSpan={18} className="text-center py-12 text-slate-500 text-xs font-medium">
                                                    Nenhum procedimento encontrado com o termo "{searchQuery}".
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Extra Guidance Banner */}
                        <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-4 text-xs text-slate-300 flex items-start gap-3">
                            <span className="text-base select-none shrink-0 mt-0.5">💡</span>
                            <div>
                                <p className="font-bold text-text mb-0.5">Dinâmica de Cálculo:</p>
                                <p className="leading-relaxed text-slate-400">
                                    Esta planilha calcula dinamicamente o Rateio das Despesas Fixas proporcionalmente à participação de cada serviço no faturamento total (% do Mix). A Margem de Lucro líquido é calculada descontando o custo variável direto, impostos, taxas financeiras e o rateio fixo correspondente de cada item.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'relatorios' && (
                    <div className="p-6 space-y-6 animate-in fade-in duration-300">
                        {/* Sub Tab Switcher */}
                        <div className="flex gap-2 p-1 bg-slate-900 border border-border rounded-xl max-w-lg">
                            <button 
                                onClick={() => setRelatoriosSubTab('dre_gerencial')}
                                className={`flex-1 text-center py-2 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                                    relatoriosSubTab === 'dre_gerencial' 
                                        ? 'bg-surface text-text shadow-lg border border-border' 
                                        : 'text-slate-400 hover:text-text hover:bg-panel'
                                }`}
                            >
                                DRE Simulado & PE Geral
                            </button>
                            <button 
                                onClick={() => setRelatoriosSubTab('analise_produto')}
                                className={`flex-1 text-center py-2 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                                    relatoriosSubTab === 'analise_produto' 
                                        ? 'bg-surface text-text shadow-lg border border-border' 
                                        : 'text-slate-400 hover:text-text hover:bg-panel'
                                }`}
                            >
                                Análise por Produto
                            </button>
                        </div>

                        {relatoriosSubTab === 'dre_gerencial' ? (
                            /* Print simulation page */
                            <div className="bg-white text-slate-800 border border-slate-300 rounded-2xl p-6 shadow-2xl space-y-6">
                            {/* Document Header */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 gap-4">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Relatório Gerencial</h3>
                                    <p className="text-xs text-slate-500 font-medium">Demonstração de Resultado & Ponto de Equilíbrio Econômico</p>
                                </div>
                                <div className="text-right sm:text-right">
                                    <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100 font-bold">
                                        SIMULAÇÃO ATIVA
                                    </span>
                                </div>
                            </div>

                            {/* Main Grid: 12 Cols */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                {/* Left Side: Ponto de Equilíbrio (8 Cols) */}
                                <div className="lg:col-span-8 space-y-6">
                                    <div>
                                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2 mb-3">
                                            Parâmetros de Simulação
                                        </h4>
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {/* Despesas Fixas */}
                                            <div className="bg-white border border-slate-200 px-4 py-3 rounded-lg shadow-xs flex flex-col justify-center">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Despesas Fixas Totais</span>
                                                <span className="font-mono text-slate-800 text-sm font-black mt-1">
                                                    R$ {totalFixedExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>

                                            {/* Margem Contribuição */}
                                            <div className="bg-white border border-slate-200 px-4 py-3 rounded-lg shadow-xs flex flex-col justify-center">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Margem Contribuição Média</span>
                                                <span className="font-mono text-emerald-600 text-sm font-black mt-1">
                                                    {scenarioTotals.totalMargemContribuicaoPct.toFixed(1)}%
                                                </span>
                                            </div>

                                            {/* Lucro Desejado */}
                                            <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-lg shadow-xs flex flex-col justify-center">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Lucro Desejado</span>
                                                <div className="flex items-center gap-1">
                                                    <div className="flex items-center border border-slate-200 rounded px-1.5 py-0.5 w-1/2">
                                                        <span className="text-[10px] text-slate-400 font-bold mr-0.5">R$</span>
                                                        <input
                                                            type="number"
                                                            value={desiredProfit || ''}
                                                            onChange={(e) => setDesiredProfit(parseFloat(e.target.value) || 0)}
                                                            className="w-full text-right font-mono text-xs font-bold text-slate-800 outline-none bg-transparent"
                                                            placeholder="0,00"
                                                        />
                                                    </div>
                                                    <span className="text-[9px] text-slate-400 font-extrabold select-none shrink-0 px-0.5">OU</span>
                                                    <div className="flex items-center border border-slate-200 rounded px-1.5 py-0.5 w-1/2">
                                                        <input
                                                            type="number"
                                                            value={scenarioTotals.totalFaturamento > 0 ? Number(((desiredProfit / scenarioTotals.totalFaturamento) * 100).toFixed(1)) : ''}
                                                            onChange={(e) => {
                                                                const pct = parseFloat(e.target.value) || 0;
                                                                setDesiredProfit((pct / 100) * scenarioTotals.totalFaturamento);
                                                            }}
                                                            className="w-full text-right font-mono text-xs font-bold text-slate-800 outline-none bg-transparent"
                                                            placeholder="0.0"
                                                        />
                                                        <span className="text-[10px] text-slate-400 font-bold ml-0.5">%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Fraction Equations block */}
                                    <div className="space-y-4 overflow-x-auto pb-2">
                                        <div className="min-w-[760px] space-y-4">
                                            {/* 1. Ponto de Equilíbrio */}
                                            {(() => {
                                                const peValue = scenarioTotals.totalMargemContribuicaoPct > 0 
                                                    ? (totalFixedExpenses / (scenarioTotals.totalMargemContribuicaoPct / 100)) 
                                                    : 0;
                                                return (
                                                    <div className="grid grid-cols-[1.5fr,auto,2fr,auto,2fr,auto,1.5fr,2.5fr] gap-2 items-center bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-xs">
                                                        <div className="font-extrabold text-slate-700 text-xs pl-2 uppercase tracking-tight">Ponto de Equilíbrio</div>
                                                        <div className="text-slate-400 font-bold text-xs">=</div>
                                                        <div className="flex flex-col items-center px-1">
                                                            <div className="border-b border-slate-300 pb-1 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider w-full">
                                                                Despesas Fixas
                                                            </div>
                                                            <div className="pt-1 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider w-full">
                                                                Margem de Contribuição
                                                            </div>
                                                        </div>
                                                        <div className="text-slate-400 font-bold text-xs">=</div>
                                                        <div className="flex flex-col items-center px-1">
                                                            <div className="border-b border-slate-300 pb-1 text-center text-xs font-mono font-bold text-slate-700 w-full">
                                                                R$ {totalFixedExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </div>
                                                            <div className="pt-1 text-center text-xs font-mono font-bold text-slate-700 w-full">
                                                                {scenarioTotals.totalMargemContribuicaoPct.toFixed(1)}%
                                                            </div>
                                                        </div>
                                                        <div className="text-slate-400 font-bold text-xs">=</div>
                                                        <div className="bg-surface text-text font-mono font-black text-xs text-center py-2.5 px-3 rounded-lg shadow-sm min-w-[120px]">
                                                            R$ {peValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>
                                                        <div className="bg-surface text-black font-semibold p-3 text-[10px] leading-tight flex items-center justify-center rounded-lg shadow-xs h-full border border-amber-300">
                                                            Esse é o valor que sua empresa precisa vender para ficar no 0 a 0, ou seja, não terá lucro, nem prejuízo.
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* 2. Ponto de Equilíbrio Econômico */}
                                            {(() => {
                                                const peeValue = scenarioTotals.totalMargemContribuicaoPct > 0 
                                                    ? ((totalFixedExpenses + desiredProfit) / (scenarioTotals.totalMargemContribuicaoPct / 100)) 
                                                    : 0;
                                                return (
                                                    <div className="grid grid-cols-[1.5fr,auto,2fr,auto,2fr,auto,1.5fr,2.5fr] gap-2 items-center bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-xs">
                                                        <div className="font-extrabold text-slate-700 text-xs pl-2 uppercase tracking-tight">Ponto de Equilíbrio Econômico</div>
                                                        <div className="text-slate-400 font-bold text-xs">=</div>
                                                        <div className="flex flex-col items-center px-1">
                                                            <div className="border-b border-slate-300 pb-1 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider w-full">
                                                                Despesas Fixas + Lucro
                                                            </div>
                                                            <div className="pt-1 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider w-full">
                                                                Margem de Contribuição
                                                            </div>
                                                        </div>
                                                        <div className="text-slate-400 font-bold text-xs">=</div>
                                                        <div className="flex flex-col items-center px-1">
                                                            <div className="border-b border-slate-300 pb-1 text-center text-xs font-mono font-bold text-slate-700 w-full">
                                                                R$ {(totalFixedExpenses + desiredProfit).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </div>
                                                            <div className="pt-1 text-center text-xs font-mono font-bold text-slate-700 w-full">
                                                                {scenarioTotals.totalMargemContribuicaoPct.toFixed(1)}%
                                                            </div>
                                                        </div>
                                                        <div className="text-slate-400 font-bold text-xs">=</div>
                                                        <div className="bg-surface text-text font-mono font-black text-xs text-center py-2.5 px-3 rounded-lg shadow-sm min-w-[120px]">
                                                            R$ {peeValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>
                                                        <div className="bg-surface text-text font-semibold p-3 text-[10px] leading-tight flex items-center justify-center rounded-lg shadow-xs h-full border border-emerald-600">
                                                            Esse é o valor que sua empresa precisa vender para obter o lucro desejado.
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* 3. Ticket Médio */}
                                            {(() => {
                                                const tmValue = scenarioTotals.totalQty > 0 
                                                    ? (scenarioTotals.totalFaturamento / scenarioTotals.totalQty) 
                                                    : 0;
                                                return (
                                                    <div className="grid grid-cols-[1.5fr,auto,2fr,auto,2fr,auto,1.5fr,2.5fr] gap-2 items-center bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-xs">
                                                        <div className="font-extrabold text-slate-700 text-xs pl-2 uppercase tracking-tight">Ticket Médio</div>
                                                        <div className="text-slate-400 font-bold text-xs">=</div>
                                                        <div className="flex flex-col items-center px-1">
                                                            <div className="border-b border-slate-300 pb-1 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider w-full">
                                                                Faturamento Total R$
                                                            </div>
                                                            <div className="pt-1 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider w-full">
                                                                Total de Vendas em Qtd
                                                            </div>
                                                        </div>
                                                        <div className="text-slate-400 font-bold text-xs">=</div>
                                                        <div className="flex flex-col items-center px-1">
                                                            <div className="border-b border-slate-300 pb-1 text-center text-xs font-mono font-bold text-slate-700 w-full">
                                                                R$ {scenarioTotals.totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </div>
                                                            <div className="pt-1 text-center text-xs font-mono font-bold text-slate-700 w-full">
                                                                {scenarioTotals.totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} un
                                                            </div>
                                                        </div>
                                                        <div className="text-slate-400 font-bold text-xs">=</div>
                                                        <div className="bg-surface text-text font-mono font-black text-xs text-center py-2.5 px-3 rounded-lg shadow-sm min-w-[120px]">
                                                            R$ {tmValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>
                                                        <div className="bg-surface text-text font-semibold p-3 text-[10px] leading-tight flex items-center justify-center rounded-lg shadow-xs h-full border border-blue-900">
                                                            Esse é o valor que sua empresa vende em média para cada cliente.
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Demonstração de Resultado (4 Cols) */}
                                <div className="lg:col-span-4 space-y-6">
                                    <div className="border border-slate-300 rounded-xl overflow-hidden shadow-md">
                                        {/* Header */}
                                        <div className="bg-surface text-text text-xs font-black px-4 py-3 text-center uppercase tracking-wider">
                                            Demonstração de Resultado (DRE)
                                        </div>

                                        {/* Table content */}
                                        <div className="bg-white divide-y divide-slate-100 text-xs font-medium">
                                            {/* Row 1: Faturamento Bruto */}
                                            <div className="flex justify-between px-4 py-2.5 bg-slate-50 font-bold text-slate-800">
                                                <span>Faturamento Bruto</span>
                                                <div className="flex justify-between w-40 font-mono">
                                                    <span className="text-right flex-1">R$ {scenarioTotals.totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                    <span className="text-right w-12 text-slate-500">100,0%</span>
                                                </div>
                                            </div>

                                            {/* Row 2: Deduções Sobre Vendas */}
                                            {(() => {
                                                const totalDeducoes = scenarioTotals.totalTaxes + scenarioTotals.totalCardFee + scenarioTotals.totalAppFee + scenarioTotals.totalCommission;
                                                const deducoesPct = scenarioTotals.totalFaturamento > 0 ? (totalDeducoes / scenarioTotals.totalFaturamento) * 100 : 0;
                                                return (
                                                    <div className="flex justify-between px-4 py-2 text-slate-600">
                                                        <span>(-) Deduções Sobre Vendas</span>
                                                        <div className="flex justify-between w-40 font-mono">
                                                            <span className="text-right flex-1 text-rose-600">
                                                                R$ {totalDeducoes > 0 ? `(${totalDeducoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})` : '-'}
                                                            </span>
                                                            <span className="text-right w-12 text-rose-500">
                                                                {deducoesPct > 0 ? `-${deducoesPct.toFixed(1)}%` : '0,0%'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Row 3: Faturamento Líquido */}
                                            {(() => {
                                                const totalDeducoes = scenarioTotals.totalTaxes + scenarioTotals.totalCardFee + scenarioTotals.totalAppFee + scenarioTotals.totalCommission;
                                                const fatLiquido = scenarioTotals.totalFaturamento - totalDeducoes;
                                                const fatLiquidoPct = scenarioTotals.totalFaturamento > 0 ? (fatLiquido / scenarioTotals.totalFaturamento) * 100 : 0;
                                                return (
                                                    <div className="flex justify-between px-4 py-2 bg-slate-50 font-bold text-slate-800 border-t border-slate-200">
                                                        <span>(=) Faturamento Líquido</span>
                                                        <div className="flex justify-between w-40 font-mono">
                                                            <span className="text-right flex-1">R$ {fatLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                            <span className="text-right w-12 text-slate-500">{fatLiquidoPct.toFixed(1)}%</span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Row 4: Custos Diretos */}
                                            {(() => {
                                                const totalCustosDirectos = scenarioTotals.totalVariableCost;
                                                const custosPct = scenarioTotals.totalFaturamento > 0 ? (totalCustosDirectos / scenarioTotals.totalFaturamento) * 100 : 0;
                                                return (
                                                    <div className="flex justify-between px-4 py-2 text-slate-600">
                                                        <span>(-) Custos Diretos</span>
                                                        <div className="flex justify-between w-40 font-mono">
                                                            <span className="text-right flex-1 text-rose-600">
                                                                R$ {totalCustosDirectos > 0 ? `(${totalCustosDirectos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})` : '-'}
                                                            </span>
                                                            <span className="text-right w-12 text-rose-500">
                                                                {custosPct > 0 ? `-${custosPct.toFixed(1)}%` : '0,0%'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Row 5: Margem de Contribuição */}
                                            {(() => {
                                                const mContribPct = scenarioTotals.totalMargemContribuicaoPct;
                                                return (
                                                    <div className="flex justify-between px-4 py-2.5 bg-emerald-50 font-bold text-emerald-900 border-t border-slate-200">
                                                        <span>(=) Margem de Contribuição</span>
                                                        <div className="flex justify-between w-40 font-mono">
                                                            <span className="text-right flex-1">R$ {scenarioTotals.totalMargemContribuicaoValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                            <span className="text-right w-12 text-emerald-700">{mContribPct.toFixed(1)}%</span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Row 6: Despesas Fixas */}
                                            {(() => {
                                                const fixasPct = scenarioTotals.totalFaturamento > 0 ? (totalFixedExpenses / scenarioTotals.totalFaturamento) * 100 : 0;
                                                return (
                                                    <div className="flex justify-between px-4 py-2 text-slate-600">
                                                        <span>(-) Despesas Fixas</span>
                                                        <div className="flex justify-between w-40 font-mono">
                                                            <span className="text-right flex-1 text-rose-600">
                                                                R$ {totalFixedExpenses > 0 ? `(${totalFixedExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})` : '-'}
                                                            </span>
                                                            <span className="text-right w-12 text-rose-500">
                                                                {fixasPct > 0 ? `-${fixasPct.toFixed(1)}%` : '0,0%'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Row 7: Lucro Operacional */}
                                            {(() => {
                                                const profitVal = scenarioTotals.totalProfitValue;
                                                const profitPct = scenarioTotals.totalFaturamento > 0 ? (profitVal / scenarioTotals.totalFaturamento) * 100 : 0;
                                                const isNegative = profitVal < 0;
                                                return (
                                                    <div className={`flex justify-between px-4 py-3 border-t-2 border-slate-300 font-extrabold text-sm ${isNegative ? 'bg-red-50 text-red-900' : 'bg-emerald-100 text-emerald-900'}`}>
                                                        <span>(=) Lucro Operacional</span>
                                                        <div className="flex justify-between w-40 font-mono">
                                                            <span className="text-right flex-1">
                                                                {isNegative 
                                                                    ? `R$ (${Math.abs(profitVal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})` 
                                                                    : `R$ ${profitVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                                            </span>
                                                            <span className="text-right w-12">
                                                                {isNegative ? `-${Math.abs(profitPct).toFixed(1)}%` : `${profitPct.toFixed(1)}%`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {/* Actionable analysis card exactly like the print */}
                                    {(() => {
                                        const isNegative = scenarioTotals.totalProfitValue < 0;
                                        return (
                                            <div className="border border-slate-300 rounded-xl overflow-hidden shadow-md">
                                                <div className="bg-surface text-text text-xs font-black px-4 py-2 uppercase tracking-wider">
                                                    Análise
                                                </div>
                                                <div className="bg-slate-50 p-4 text-xs font-semibold leading-relaxed">
                                                    {isNegative ? (
                                                        <p className="text-red-600">
                                                            <span className="font-extrabold uppercase block mb-1">⚠️ ATENÇÃO:</span>
                                                            Sua empresa está com PREJUÍZO. Analise sua estrutura de preços, negocie preços melhores com fornecedores e reduza suas despesas fixas.
                                                        </p>
                                                    ) : (
                                                        <p className="text-emerald-700">
                                                            <span className="font-extrabold uppercase block mb-1">🎉 PARABÉNS!</span>
                                                            Sua empresa está com LUCRO OPERACIONAL POSITIVO. Mantenha o controle de custos e busque aumentar o volume para potencializar seus ganhos!
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                        ) : (
                            /* INDIVIDUAL PRODUCT ANALYSIS SUB-TAB */
                            (() => {
                                const analiseService = services.find(s => s.id === selectedAnaliseServiceId) || services[0];
                                if (!analiseService) {
                                    return (
                                        <div className="bg-white border border-slate-300 p-8 rounded-2xl text-center text-slate-500 text-xs font-bold shadow-xl">
                                            Nenhum produto ou serviço cadastrado para análise.
                                        </div>
                                    );
                                }

                                const price = customPracticedPrices[analiseService.id] ?? analiseService.defaultValue;
                                const breakdown = getFichaCostBreakdown(analiseService.id);
                                const settings = serviceSettings[analiseService.id] || {
                                    cHora: 150,
                                    time: 1,
                                    cDireto: breakdown.cmv + breakdown.labor > 0 ? breakdown.cmv + breakdown.labor : 0,
                                    cLaboratorio: 0,
                                    mLiquida: 30,
                                    tTributos: 6,
                                    tFinanceira: 3,
                                    cComissao: 10
                                };
                                
                                // CMV and Labor split
                                let cmvValue = breakdown.cmv + (settings.cLaboratorio || 0);
                                let laborValue = breakdown.labor;
                                if (cmvValue === 0 && laborValue === 0) {
                                    cmvValue = (settings.cDireto || 0) * 0.15 + (settings.cLaboratorio || 0);
                                    laborValue = (settings.cDireto || 0) * 0.85;
                                }

                                if (analiseType === 'revenda') {
                                    cmvValue = cmvValue + laborValue;
                                    laborValue = 0;
                                }

                                const custosVariaveisVal = cmvValue + laborValue;

                                // Percentages
                                const taxesPct = settings.tTributos || 0;
                                const cardFeePct = settings.tFinanceira || 0;
                                const appFeePct = 0;
                                const commissionPct = settings.cComissao || 0;
                                const despesasVariaveisPct = taxesPct + cardFeePct + appFeePct + commissionPct;

                                // Rateio % from scenarioTotals
                                const totalFaturamento = scenarioTotals.totalFaturamento;
                                const rateioPct = totalFaturamento > 0 ? (totalFixedExpenses / totalFaturamento) * 100 : 20;

                                // Left Side: practiced price
                                const practicedPrice = price;
                                const practicedCMV = cmvValue;
                                const practicedLabor = laborValue;
                                const practicedCustosVariaveis = custosVariaveisVal;

                                const practicedTaxes = practicedPrice * (taxesPct / 100);
                                const practicedCardFee = practicedPrice * (cardFeePct / 100);
                                const practicedAppFee = practicedPrice * (appFeePct / 100);
                                const practicedCommission = practicedPrice * (commissionPct / 100);
                                const practicedDespesasVariaveis = practicedTaxes + practicedCardFee + practicedAppFee + practicedCommission;

                                const practicedMargemContribuicao = practicedPrice - practicedCustosVariaveis - practicedDespesasVariaveis;
                                const practicedRateioDF = practicedPrice * (rateioPct / 100);
                                const practicedMargemLucro = practicedMargemContribuicao - practicedRateioDF;

                                const practicedMarkup = practicedCustosVariaveis > 0 ? practicedPrice / practicedCustosVariaveis : 0;

                                // Right Side: suggested price based on desired profit %
                                const suggestedDenominator = 1 - (despesasVariaveisPct + rateioPct + analiseDesiredProfitPct) / 100;
                                const safeDenominator = suggestedDenominator > 0.02 ? suggestedDenominator : 0.02;
                                const suggestedPrice = practicedCustosVariaveis / safeDenominator;

                                const suggestedCMV = cmvValue;
                                const suggestedLabor = laborValue;
                                const suggestedCustosVariaveis = custosVariaveisVal;

                                const suggestedTaxes = suggestedPrice * (taxesPct / 100);
                                const suggestedCardFee = suggestedPrice * (cardFeePct / 100);
                                const suggestedAppFee = suggestedPrice * (appFeePct / 100);
                                const suggestedCommission = suggestedPrice * (commissionPct / 100);
                                const suggestedDespesasVariaveis = suggestedTaxes + suggestedCardFee + suggestedAppFee + suggestedCommission;

                                const suggestedMargemContribuicao = suggestedPrice - suggestedCustosVariaveis - suggestedDespesasVariaveis;
                                const suggestedRateioDF = suggestedPrice * (rateioPct / 100);
                                const suggestedMargemLucro = suggestedPrice * (analiseDesiredProfitPct / 100);

                                const suggestedMarkup = suggestedCustosVariaveis > 0 ? suggestedPrice / suggestedCustosVariaveis : 0;

                                // Donut Slices Helper
                                const getDonutData = (cv: number, dv: number, df: number, ml: number) => {
                                    const absMl = Math.abs(ml);
                                    const total = cv + dv + df + absMl;
                                    if (total === 0) return [];
                                    return [
                                        { name: 'Custos Variáveis', value: cv, percentage: (cv / total) * 100 },
                                        { name: 'Despesas Variáveis', value: dv, percentage: (dv / total) * 100 },
                                        { name: 'Rateio de Despesas Fixas', value: df, percentage: (df / total) * 100 },
                                        { name: 'Margem de Lucro', value: absMl, percentage: (absMl / total) * 100 }
                                    ];
                                };

                                const COLORS = ['#1d63b8', '#ed7d31', '#a5a5a5', '#ffc000'];

                                const donutDataPracticed = getDonutData(practicedCustosVariaveis, practicedDespesasVariaveis, practicedRateioDF, practicedMargemLucro);
                                const donutDataSuggested = getDonutData(suggestedCustosVariaveis, suggestedDespesasVariaveis, suggestedRateioDF, suggestedMargemLucro);

                                const filteredServicesForSidebar = services.filter(s => {
                                    if (!analiseSearchQuery.trim()) return true;
                                    const q = analiseSearchQuery.toLowerCase();
                                    return s.name.toLowerCase().includes(q);
                                });

                                const renderSpreadsheetRow = (
                                    label: string, 
                                    value: number, 
                                    pct: number, 
                                    isHeader: boolean = false, 
                                    indent: boolean = false,
                                    textRed: boolean = false
                                ) => {
                                    const bgClass = isHeader 
                                        ? 'bg-surface text-text font-extrabold' 
                                        : 'bg-white hover:bg-slate-50 border-b border-slate-200 text-slate-800 font-semibold';
                                    
                                    return (
                                        <tr className={`text-[11px] transition-colors ${bgClass}`}>
                                            <td className={`py-1.5 px-3 ${indent ? 'pl-6 font-normal text-slate-500' : ''}`}>
                                                {label}
                                            </td>
                                            <td className={`py-1.5 px-3 text-right font-mono font-bold ${textRed ? 'text-red-600' : ''}`}>
                                                {value < 0 ? `-R$ ${Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                            </td>
                                            <td className={`py-1.5 px-3 text-right font-mono font-bold ${textRed ? 'text-red-600' : ''}`}>
                                                {pct < 0 ? `-${Math.abs(pct).toFixed(1)}%` : `${pct.toFixed(1)}%`}
                                            </td>
                                        </tr>
                                    );
                                };

                                const renderMarkupRow = (label: string, value: number) => {
                                    return (
                                        <tr className="text-[11px] bg-surface text-text font-extrabold">
                                            <td className="py-1.5 px-3">
                                                {label}
                                            </td>
                                            <td colSpan={2} className="py-1.5 px-3 text-right font-mono font-bold">
                                                {value.toFixed(2)}
                                            </td>
                                        </tr>
                                    );
                                };

                                return (
                                    <div className="bg-white text-slate-800 border border-slate-300 rounded-2xl p-6 shadow-2xl space-y-6">
                                        {/* Document Header */}
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 gap-4">
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Análise Individual do Produto ou Serviço</h3>
                                                <p className="text-xs text-slate-500 font-medium">Demonstração e simulação de rentabilidade por item individual</p>
                                            </div>
                                            <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-300 shadow-sm shrink-0">
                                                <button
                                                    onClick={() => setAnaliseType('revenda')}
                                                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                                                        analiseType === 'revenda'
                                                            ? 'bg-surface text-text shadow'
                                                            : 'text-slate-500 hover:text-slate-800'
                                                    }`}
                                                >
                                                    ANÁLISE REVENDA
                                                </button>
                                                <button
                                                    onClick={() => setAnaliseType('prod_serv')}
                                                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                                                        analiseType === 'prod_serv'
                                                            ? 'bg-surface text-text shadow'
                                                            : 'text-slate-500 hover:text-slate-800'
                                                    }`}
                                                >
                                                    ANÁLISE PROD/SERV
                                                </button>
                                            </div>
                                        </div>

                                        {/* Main 12-Column Grid */}
                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                            {/* Left Column: Sidebar Selection (3 Cols) */}
                                            <div className="lg:col-span-3">
                                                <div className="border border-slate-300 rounded-xl bg-slate-50 p-3 h-[580px] flex flex-col gap-2">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Produtos/Serviços</span>
                                                    <div className="relative">
                                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                                        <input 
                                                            type="text" 
                                                            placeholder="Buscar..." 
                                                            value={analiseSearchQuery}
                                                            onChange={(e) => setAnaliseSearchQuery(e.target.value)}
                                                            className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-semibold"
                                                        />
                                                    </div>
                                                    <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                                                        {filteredServicesForSidebar.map(s => {
                                                            const isSelected = s.id === selectedAnaliseServiceId;
                                                            return (
                                                                <button
                                                                    key={s.id}
                                                                    onClick={() => setSelectedAnaliseServiceId(s.id)}
                                                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold tracking-tight transition-all cursor-pointer flex items-center justify-between ${
                                                                        isSelected 
                                                                            ? 'bg-surface text-text font-bold shadow' 
                                                                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-xs'
                                                                    }`}
                                                                >
                                                                    <span className="truncate">{s.name}</span>
                                                                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 ml-2"></span>}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Center-Left Column: Desconto / Preço Praticado (4.5 Cols) */}
                                            <div className="lg:col-span-4 space-y-4">
                                                <div className="border border-slate-300 rounded-xl overflow-hidden shadow">
                                                    <div className="bg-surface text-text px-3 py-2 text-xs font-black uppercase tracking-wider text-center">
                                                        Desconto / Praticado:
                                                    </div>
                                                    <table className="w-full border-collapse">
                                                        <tbody>
                                                            {renderSpreadsheetRow("Preço de Venda", practicedPrice, 100.0, true)}
                                                            {renderSpreadsheetRow("Custos Variáveis", practicedCustosVariaveis, (practicedCustosVariaveis / practicedPrice) * 100, true)}
                                                            {renderSpreadsheetRow("CMV", practicedCMV, (practicedCMV / practicedPrice) * 100, false, true)}
                                                            {renderSpreadsheetRow("Custo Mão de Obra Direta", practicedLabor, (practicedLabor / practicedPrice) * 100, false, true)}
                                                            {renderSpreadsheetRow("Frete", 0, 0, false, true)}
                                                            
                                                            {renderSpreadsheetRow("Despesas Variáveis", practicedDespesasVariaveis, (practicedDespesasVariaveis / practicedPrice) * 100, true)}
                                                            {renderSpreadsheetRow("Impostos", practicedTaxes, (practicedTaxes / practicedPrice) * 100, false, true)}
                                                            {renderSpreadsheetRow("Taxa da Máquina", practicedCardFee, (practicedCardFee / practicedPrice) * 100, false, true)}
                                                            {renderSpreadsheetRow("Taxa Aplicativo", practicedAppFee, (practicedAppFee / practicedPrice) * 100, false, true)}
                                                            {renderSpreadsheetRow("Comissão", practicedCommission, (practicedCommission / practicedPrice) * 100, false, true)}

                                                            {renderSpreadsheetRow("Margem de Contribuição", practicedMargemContribuicao, (practicedMargemContribuicao / practicedPrice) * 100, true, false, practicedMargemContribuicao < 0)}
                                                            {renderSpreadsheetRow("Rateio de Despesas Fixas", practicedRateioDF, (practicedRateioDF / practicedPrice) * 100, true)}
                                                            {renderSpreadsheetRow("Margem de Lucro", practicedMargemLucro, (practicedMargemLucro / practicedPrice) * 100, true, false, practicedMargemLucro < 0)}
                                                            {renderMarkupRow("Mark-up Multiplicador", practicedMarkup)}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Left Summary badges */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className={`p-3 rounded-xl border flex flex-col justify-center text-center ${practicedMargemLucro >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Margem de Lucro %</span>
                                                        <span className={`text-base font-black font-mono mt-0.5 ${practicedMargemLucro >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                                            {practicedMargemLucro >= 0 ? '+' : ''}{((practicedMargemLucro / practicedPrice) * 100).toFixed(1)}%
                                                        </span>
                                                    </div>
                                                    <div className={`p-3 rounded-xl border flex flex-col justify-center text-center ${practicedMargemLucro >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Margem de Lucro R$</span>
                                                        <span className={`text-base font-black font-mono mt-0.5 ${practicedMargemLucro >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                                            {practicedMargemLucro < 0 ? `-` : ''}R$ {Math.abs(practicedMargemLucro).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Left Donut Chart */}
                                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center">
                                                    <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider mb-2">Distribuição % do Preço</span>
                                                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
                                                        <div className="shrink-0 flex items-center justify-center">
                                                            <PieChart width={140} height={140}>
                                                                <Pie
                                                                    data={donutDataPracticed}
                                                                    cx="50%"
                                                                    cy="50%"
                                                                    innerRadius={35}
                                                                    outerRadius={55}
                                                                    paddingAngle={2}
                                                                    dataKey="value"
                                                                >
                                                                    {donutDataPracticed.map((entry, idx) => (
                                                                        <Cell key={`cell-practiced-${idx}`} fill={COLORS[idx % COLORS.length]} />
                                                                    ))}
                                                                </Pie>
                                                            </PieChart>
                                                        </div>
                                                        <div className="flex-1 space-y-1.5 w-full">
                                                            {donutDataPracticed.map((item, idx) => (
                                                                <div key={`legend-practiced-${item.name}`} className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-600">
                                                                    <span className="w-2.5 h-2.5 rounded shrink-0" style={{ backgroundColor: COLORS[idx] }}></span>
                                                                    <span className="truncate">{item.name}:</span>
                                                                    <span className="font-mono font-bold text-slate-800 ml-auto">{item.percentage.toFixed(1)}%</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Center-Right Column: Lucro Desejado % / Preço Sugerido (4.5 Cols) */}
                                            <div className="lg:col-span-4 space-y-4">
                                                <div className="border border-slate-300 rounded-xl overflow-hidden shadow">
                                                    {/* Desired Margin Header Row with input */}
                                                    <div className="flex items-center gap-1 bg-surface px-3 py-1.5 text-text justify-between">
                                                        <span className="text-xs font-black tracking-wider uppercase">LUCRO DESEJADO %:</span>
                                                        <div className="flex items-center bg-panel/80 border border-white/20 rounded px-1.5 py-0.5 w-20">
                                                            <input 
                                                                type="number" 
                                                                min="0"
                                                                max="95"
                                                                value={analiseDesiredProfitPct}
                                                                onChange={(e) => setAnaliseDesiredProfitPct(Math.max(0, Math.min(95, parseFloat(e.target.value) || 0)))}
                                                                className="w-full bg-transparent text-right font-mono text-xs font-black text-text focus:outline-none"
                                                            />
                                                            <span className="text-xs text-text/70 font-bold ml-1">%</span>
                                                        </div>
                                                    </div>
                                                    <table className="w-full border-collapse">
                                                        <tbody>
                                                            {renderSpreadsheetRow("Preço Sugerido", suggestedPrice, 100.0, true)}
                                                            {renderSpreadsheetRow("Custos Variáveis", suggestedCustosVariaveis, (suggestedCustosVariaveis / suggestedPrice) * 100, true)}
                                                            {renderSpreadsheetRow("CMV", suggestedCMV, (suggestedCMV / suggestedPrice) * 100, false, true)}
                                                            {renderSpreadsheetRow("Custo Mão de Obra Direta", suggestedLabor, (suggestedLabor / suggestedPrice) * 100, false, true)}
                                                            {renderSpreadsheetRow("Frete", 0, 0, false, true)}
                                                            
                                                            {renderSpreadsheetRow("Despesas Variáveis", suggestedDespesasVariaveis, (suggestedDespesasVariaveis / suggestedPrice) * 100, true)}
                                                            {renderSpreadsheetRow("Impostos", suggestedTaxes, (suggestedTaxes / suggestedPrice) * 100, false, true)}
                                                            {renderSpreadsheetRow("Taxa da Máquina", suggestedCardFee, (suggestedCardFee / suggestedPrice) * 100, false, true)}
                                                            {renderSpreadsheetRow("Taxa Aplicativo", suggestedAppFee, (suggestedAppFee / suggestedPrice) * 100, false, true)}
                                                            {renderSpreadsheetRow("Comissão", suggestedCommission, (suggestedCommission / suggestedPrice) * 100, false, true)}

                                                            {renderSpreadsheetRow("Margem de Contribuição", suggestedMargemContribuicao, (suggestedMargemContribuicao / suggestedPrice) * 100, true, false, suggestedMargemContribuicao < 0)}
                                                            {renderSpreadsheetRow("Rateio de Despesas Fixas", suggestedRateioDF, (suggestedRateioDF / suggestedPrice) * 100, true)}
                                                            {renderSpreadsheetRow("Margem de Lucro", suggestedMargemLucro, (suggestedMargemLucro / suggestedPrice) * 100, true, false, suggestedMargemLucro < 0)}
                                                            {renderMarkupRow("Mark-up Multiplicador", suggestedMarkup)}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Right Summary badges */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col justify-center text-center">
                                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Margem de Lucro %</span>
                                                        <span className="text-base font-black font-mono text-emerald-700 mt-0.5">
                                                            +{analiseDesiredProfitPct.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col justify-center text-center">
                                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Margem de Lucro R$</span>
                                                        <span className="text-base font-black font-mono text-emerald-700 mt-0.5">
                                                            R$ {suggestedMargemLucro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Right Donut Chart */}
                                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center">
                                                    <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider mb-2">Distribuição % do Preço</span>
                                                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
                                                        <div className="shrink-0 flex items-center justify-center">
                                                            <PieChart width={140} height={140}>
                                                                <Pie
                                                                    data={donutDataSuggested}
                                                                    cx="50%"
                                                                    cy="50%"
                                                                    innerRadius={35}
                                                                    outerRadius={55}
                                                                    paddingAngle={2}
                                                                    dataKey="value"
                                                                >
                                                                    {donutDataSuggested.map((entry, idx) => (
                                                                        <Cell key={`cell-suggested-${idx}`} fill={COLORS[idx % COLORS.length]} />
                                                                    ))}
                                                                </Pie>
                                                            </PieChart>
                                                        </div>
                                                        <div className="flex-1 space-y-1.5 w-full">
                                                            {donutDataSuggested.map((item, idx) => (
                                                                <div key={`legend-suggested-${item.name}`} className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-600">
                                                                    <span className="w-2.5 h-2.5 rounded shrink-0" style={{ backgroundColor: COLORS[idx] }}></span>
                                                                    <span className="truncate">{item.name}:</span>
                                                                    <span className="font-mono font-bold text-slate-800 ml-auto">{item.percentage.toFixed(1)}%</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const Input: React.FC<{label: string, value: number, onChange: (val: number) => void}> = ({label, value, onChange}) => (
    <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</label>
        <input 
            type="number" 
            step="any"
            value={value} 
            onChange={(e) => onChange(Number(e.target.value))} 
            className="w-full bg-panel border border-border rounded-lg px-4 py-2 text-text font-semibold text-sm focus:outline-none focus:border-indigo-500 font-mono" 
        />
    </div>
);
