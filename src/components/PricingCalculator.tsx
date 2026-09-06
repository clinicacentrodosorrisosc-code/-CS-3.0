import React, { useState, useMemo } from 'react';
import { Calculator, DollarSign, Percent, Clock, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabaseClient';
import { Service, Product } from '../types';

export const PricingCalculator: React.FC<{ services: Service[]; products: Product[] }> = ({ services, products }) => {
    const [selectedServiceId, setSelectedServiceId] = useState<string>('');
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    const [fixedCosts, setFixedCosts] = useState(5000);
    const [monthlyVolume, setMonthlyVolume] = useState(100);
    const [hourlyRate, setHourlyRate] = useState(100);
    const [estimatedTime, setEstimatedTime] = useState(1);
    const [materialCost, setMaterialCost] = useState(200);
    const [taxRate, setTaxRate] = useState(15);
    const [desiredMargin, setDesiredMargin] = useState(30);

    const selectedService = useMemo(() => services.find(s => s.id === selectedServiceId), [services, selectedServiceId]);
    const selectedProducts = useMemo(() => products.filter(p => selectedProductIds.includes(p.id)), [products, selectedProductIds]);

    const calculation = useMemo(() => {
        const laborCost = hourlyRate * estimatedTime;
        const matCost = selectedService ? selectedService.defaultValue : materialCost; 
        const productsCost = selectedProducts.reduce((sum, p) => sum + p.cost, 0);
        const fixedCostPerUnit = monthlyVolume > 0 ? fixedCosts / monthlyVolume : fixedCosts;
        const totalCost = laborCost + matCost + productsCost + fixedCostPerUnit; 
        const basePrice = totalCost / (1 - (desiredMargin + taxRate) / 100);
        const profit = basePrice - totalCost;
        
        return {
            totalCost,
            basePrice,
            profit,
            marginPercentage: (profit / basePrice) * 100,
            fixedCostPerUnit
        };
    }, [fixedCosts, monthlyVolume, hourlyRate, estimatedTime, materialCost, taxRate, desiredMargin, selectedService, selectedProducts]);

    const toggleProduct = (productId: string) => {
        setSelectedProductIds(prev => prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]);
    };

    return (
        <div className="flex flex-col gap-6 p-6 animate-in fade-in">
            <h3 className="text-xl font-bold text-text flex items-center gap-2">
                <Calculator className="w-5 h-5 text-indigo-400" /> Calculadora de Precificação Robusta
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-panel p-6 rounded-2xl border border-border bg-surface space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Serviço/Procedimento</label>
                        <select value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)} className="w-full bg-panel border border-border rounded-lg px-4 py-2 text-text">
                            <option value="">Selecione um serviço...</option>
                            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Registrar Produto</label>
                        <div className="flex gap-2">
                            <input id="new-prod-name" placeholder="Nome" className="flex-1 bg-panel border border-border rounded-lg px-3 py-1.5 text-xs text-text" />
                            <input id="new-prod-cost" type="number" placeholder="Custo" className="w-20 bg-panel border border-border rounded-lg px-3 py-1.5 text-xs text-text" />
                            <button onClick={async () => {
                                const name = (document.getElementById('new-prod-name') as HTMLInputElement).value;
                                const cost = parseFloat((document.getElementById('new-prod-cost') as HTMLInputElement).value);
                                if (name && !isNaN(cost)) {
                                    await supabase.from('products').insert({ id: 'prod_' + Date.now(), name, cost });
                                    toast.success("Produto adicionado!");
                                }
                            }} className="bg-emerald-600 p-1.5 rounded-lg text-text"><Plus className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Produtos Utilizados</label>
                        <div className="flex flex-col gap-2">
                            {products.map(p => (
                                <div key={p.id} className="flex justify-between items-center bg-panel p-3 rounded-lg border border-border">
                                    <div className='flex items-center gap-2'>
                                        <input type="checkbox" checked={selectedProductIds.includes(p.id)} onChange={() => toggleProduct(p.id)} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-transparent border-white/20"/>
                                        <span className="text-sm text-slate-300">{p.name}</span>
                                    </div>
                                    <span className="text-xs font-mono text-slate-500">R$ {p.cost.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Custos Fixos Mensais (R$)</label>
                        <input type="number" value={fixedCosts} onChange={(e) => setFixedCosts(Number(e.target.value))} className="w-full bg-panel border border-border rounded-lg px-4 py-2 text-text" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Volume de Vendas Mensal (Unidades)</label>
                        <input type="number" value={monthlyVolume} onChange={(e) => setMonthlyVolume(Number(e.target.value))} className="w-full bg-panel border border-border rounded-lg px-4 py-2 text-text" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Valor Hora (R$)</label>
                        <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(Number(e.target.value))} className="w-full bg-panel border border-border rounded-lg px-4 py-2 text-text" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tempo Estimado (Horas)</label>
                        <input type="number" value={estimatedTime} onChange={(e) => setEstimatedTime(Number(e.target.value))} className="w-full bg-panel border border-border rounded-lg px-4 py-2 text-text" />
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl border border-border bg-surface space-y-4">
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Impostos (%)</label>
                        <input type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="w-full bg-panel border border-border rounded-lg px-4 py-2 text-text" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Margem de Lucro Desejada (%)</label>
                        <input type="number" value={desiredMargin} onChange={(e) => setDesiredMargin(Number(e.target.value))} className="w-full bg-panel border border-border rounded-lg px-4 py-2 text-text" />
                    </div>
                    
                    <div className="mt-8 p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20 space-y-2">
                        <div className="flex justify-between text-sm text-slate-400">
                            <span>Custo Fixo/Unit:</span>
                            <span>R$ {calculation.fixedCostPerUnit.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-400">
                            <span>Custo Variável:</span>
                            <span>R$ {(calculation.totalCost - calculation.fixedCostPerUnit).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-200 font-bold border-t border-indigo-500/20 pt-2">
                            <span>Custo Total:</span>
                            <span>R$ {calculation.totalCost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-lg pt-4">
                            <span className="text-slate-200 font-bold">Preço Sugerido:</span>
                            <span className="font-black text-indigo-400 text-2xl">R$ {calculation.basePrice.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
