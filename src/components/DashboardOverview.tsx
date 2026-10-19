import React, { useEffect, useId, useRef, useState } from 'react';
import { Banknote, ChevronRight, Info, ReceiptText, Target, Users, X } from 'lucide-react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from 'motion/react';
import { AnimatedNumber } from './ui/animated-number';
import './dashboard-overview.css';

type View = 'diaria' | 'mensal' | 'performance';
type Props = {
  revenue: number;
  goalRevenue: number;
  goal: number;
  averageTicket: number;
  receipts: number;
  pendingIncome: number;
  teams: Record<string, number>;
  period: string;
  year: number;
  currentPeriod: boolean;
  trendData: { label: string; vendas: number }[];
  view: View;
  onViewChange: (view: View) => void;
  performance: React.ReactNode;
};

const currency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const percentage = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function DashboardOverview(props: Props) {
  const { revenue, goalRevenue, goal, pendingIncome, period, teams, view } = props;
  const [detailOpen, setDetailOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const hasGoal = Number.isFinite(goal) && goal > 0;
  const attainment = hasGoal ? goalRevenue / goal * 100 : 0;
  const missing = hasGoal ? Math.max(0, goal - goalRevenue) : 0;
  const excess = hasGoal ? Math.max(0, goalRevenue - goal) : 0;
  const teamEntries = Object.entries(teams).sort((a, b) => b[1] - a[1]);
  const teamTotal = teamEntries.reduce((sum, [, value]) => sum + value, 0);
  const status = !hasGoal ? 'Meta não definida' : attainment >= 100 ? 'Meta atingida' : 'Em acompanhamento';

  useEffect(() => {
    const element = dialog.current;
    if (detailOpen && element && !element.open) element.showModal();
    if (!detailOpen && element?.open) element.close();
  }, [detailOpen]);

  const closeDetail = () => {
    setDetailOpen(false);
    trigger.current?.focus();
  };

  const containFocus = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter(element => element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (first && ((!event.shiftKey && document.activeElement === last) || (event.shiftKey && document.activeElement === first))) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  };

  return (
    <div className="reference-overview">
      <div className="reference-section-heading">
        <div><h2>Resultados do mês</h2><p>Financeiro · {period}</p></div>
        {props.currentPeriod && <span className="reference-badge">Mês em andamento</span>}
      </div>

      <div className="reference-summary">
        <section className="reference-card reference-goal" aria-labelledby={`${uid}-goal`}>
          <div className="reference-card-heading"><Target size={15} aria-hidden="true" /><h3 id={`${uid}-goal`}>Atingimento da meta</h3></div>
          <div className="reference-gauge">
            <svg viewBox="0 0 240 138" aria-hidden="true">
              <path className="reference-gauge-track" d="M 22 116 A 98 98 0 0 1 218 116" pathLength="100" />
              <path className="reference-gauge-fill" d="M 22 116 A 98 98 0 0 1 218 116" pathLength="100" strokeDasharray={`${clamp(attainment)} 100`} />
            </svg>
            <div className="reference-gauge-value"><strong>{hasGoal ? percentage(attainment) : '—'}</strong><span className="reference-badge" data-positive={hasGoal && attainment >= 100}>{status}</span></div>
          </div>
          <p className="reference-goal-caption">{hasGoal ? <>{currency(goalRevenue)} de {currency(goal)}</> : 'Configure uma meta mensal para acompanhar.'}</p>
          <button ref={trigger} type="button" className="reference-detail-button" onClick={() => setDetailOpen(true)} aria-haspopup="dialog"><Info size={14} aria-hidden="true" /> Entender este resultado <ChevronRight size={14} aria-hidden="true" /></button>
        </section>

        <div className="reference-metrics">
          <article className="reference-card reference-metric"><div className="reference-card-heading"><Banknote size={15} aria-hidden="true" /><h3>Faturamento do mês</h3></div><AnimatedNumber value={revenue} format={currency} className="reference-number" /><p>Receitas recebidas no período</p></article>
          <article className="reference-card reference-metric"><div className="reference-card-heading"><ReceiptText size={15} aria-hidden="true" /><h3>Ticket médio</h3></div><span className="reference-number">{currency(props.averageTicket)}</span><p>{props.receipts.toLocaleString('pt-BR')} recebimento{props.receipts === 1 ? '' : 's'} no mês</p></article>
          <article className="reference-card reference-metric"><div className="reference-card-heading"><ReceiptText size={15} aria-hidden="true" /><h3>A receber</h3></div><span className="reference-number">{currency(pendingIncome)}</span><p>Lançamentos pendentes no mês</p></article>
          <article className="reference-card reference-metric"><div className="reference-card-heading"><Target size={15} aria-hidden="true" /><h3>{excess > 0 ? 'Acima da meta' : 'Falta realizar'}</h3></div><span className="reference-number">{hasGoal ? currency(excess > 0 ? excess : missing) : '—'}</span><p>{hasGoal ? 'Sobre a receita considerada na meta' : 'Meta mensal ainda não definida'}</p></article>
        </div>
      </div>

      <div className="reference-analysis">
        <section className="reference-card reference-trend" aria-labelledby={`${uid}-trend`}>
          <div className="reference-trend-heading"><div><h3 id={`${uid}-trend`}>{view === 'performance' ? 'Performance comercial' : 'Tendência de vendas'}</h3><p>{view === 'mensal' ? `Evolução mensal · ${props.year}` : period}</p></div><div className="reference-segments" role="group" aria-label="Visualização dos resultados">{([['diaria', 'Diária'], ['mensal', 'Mensal'], ['performance', 'Performance']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={view === value} onClick={() => props.onViewChange(value)}>{label}</button>)}</div></div>
          {view === 'performance' ? props.performance : <>
            <div className="reference-chart" role="img" aria-label={`Evolução do faturamento ${view === 'mensal' ? `em ${props.year}` : `em ${period}`}. Os valores estão disponíveis na tabela de dados.`}>
              <ResponsiveContainer width="100%" height="100%"><ComposedChart data={props.trendData} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}><defs><linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--reference-series)" stopOpacity={0.16} /><stop offset="100%" stopColor="var(--reference-series)" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--border-subtle)" /><XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={20} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} /><YAxis width={70} axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} tickFormatter={(value: number) => currency(value).replace(/,00$/, '')} /><Tooltip formatter={(value: number) => [currency(value), 'Faturamento']} labelFormatter={(label) => view === 'mensal' ? `${label} de ${props.year}` : `${label} · ${period}`} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)' }} /><Area dataKey="vendas" stroke="none" fill={`url(#${uid}-fill)`} isAnimationActive={!reducedMotion} animationDuration={350} /><Line name="Faturamento" dataKey="vendas" stroke="var(--reference-series)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={!reducedMotion} animationDuration={350} /></ComposedChart></ResponsiveContainer>
            </div>
            {!props.trendData.some(day => day.vendas !== 0) && <p className="reference-empty">Nenhum recebimento registrado neste período.</p>}
            <details className="reference-data"><summary>Consultar valores do gráfico</summary><div><table><caption>Faturamento · {view === 'mensal' ? props.year : period}</caption><thead><tr><th scope="col">{view === 'mensal' ? 'Mês' : 'Dia'}</th><th scope="col">Faturamento</th></tr></thead><tbody>{props.trendData.map(day => <tr key={day.label}><th scope="row">{day.label}</th><td>{currency(day.vendas)}</td></tr>)}</tbody></table></div></details>
          </>}
        </section>

        <section className="reference-card reference-teams" aria-labelledby={`${uid}-teams`}><div className="reference-card-heading"><Users size={15} aria-hidden="true" /><h3 id={`${uid}-teams`}>Vendas por time</h3></div><p>Participação no faturamento · {period}</p><div className="reference-team-list">{teamEntries.length ? teamEntries.map(([team, value], index) => { const share = teamTotal > 0 ? value / teamTotal * 100 : 0; return <div className="reference-team" key={team} style={{ '--team-color': `var(--reference-team-${index % 4})` } as React.CSSProperties}><div className="reference-team-label"><span><i aria-hidden="true" />{team}</span><strong>{percentage(share)}</strong></div><div className="reference-team-track" aria-hidden="true"><div style={{ width: `${clamp(share)}%` }} /></div><p>{currency(value)}</p></div>; }) : <p className="reference-empty">Nenhum recebimento por time neste mês.</p>}</div></section>
      </div>

      <dialog ref={dialog} className="reference-dialog" aria-labelledby={`${uid}-detail-title`} aria-describedby={`${uid}-detail-description`} onKeyDown={containFocus} onCancel={(event) => { event.preventDefault(); closeDetail(); }} onClose={() => { setDetailOpen(false); }}>
        <header className="reference-dialog-heading"><div><h2 id={`${uid}-detail-title`}>Como está o atingimento da meta</h2><p>{period}{props.currentPeriod ? ' · Mês em andamento' : ''}</p></div><button type="button" autoFocus onClick={closeDetail} aria-label="Fechar análise da meta"><X size={20} /></button></header>
        <section className="reference-dialog-body">
          <div className="reference-explanation"><strong>{hasGoal ? percentage(attainment) : '—'}</strong><p id={`${uid}-detail-description`}>{!hasGoal ? 'Defina uma meta mensal no botão Metas do Dashboard para calcular o atingimento.' : attainment >= 100 ? `A receita considerada na meta é de ${currency(goalRevenue)}. A meta mensal de ${currency(goal)} foi atingida${excess > 0 ? ` e superada em ${currency(excess)}` : ''}.` : `A receita considerada na meta é de ${currency(goalRevenue)}, de uma meta de ${currency(goal)}. Faltam ${currency(missing)} para atingir o valor definido.`}</p></div>
          <section className="reference-card"><h3>Do faturamento à meta</h3><dl className="reference-breakdown"><div><dt>Faturamento recebido</dt><dd>{currency(revenue)}</dd></div><div><dt>Fora da base da meta</dt><dd>{currency(revenue - goalRevenue)}</dd></div><div><dt>Receita considerada na meta</dt><dd>{currency(goalRevenue)}</dd></div><div><dt>Meta mensal</dt><dd>{hasGoal ? currency(goal) : 'Não definida'}</dd></div></dl><p className="reference-method">A regra atual exclui documentação e panorâmica da base da meta. Os valores a receber ({currency(pendingIncome)}) continuam pendentes e não entram no faturamento recebido.</p></section>
          {hasGoal && <section className="reference-card"><h3>Realizado versus meta</h3><div className="reference-comparison"><span>Receita considerada</span><strong>{currency(goalRevenue)}</strong><div aria-hidden="true"><i style={{ width: `${clamp(attainment)}%` }} /></div><span>Referência: {currency(goal)} · {percentage(attainment)}</span></div></section>}
        </section>
      </dialog>
    </div>
  );
}
