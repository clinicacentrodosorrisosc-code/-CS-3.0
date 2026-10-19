import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

type PageHeaderProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, icon: Icon, actions, tabs, className }: PageHeaderProps) {
  return (
    <header className={cn('module-command-bar operational-page-header', className)}>
      <div className="operational-page-header__main">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="size-5 shrink-0 text-[var(--primary)]" aria-hidden="true" />}
            <h1>{title}</h1>
          </div>
          {description && <p className="mt-1 max-w-[72ch]">{description}</p>}
        </div>
        {actions && <div className="operational-page-header__actions">{actions}</div>}
      </div>
      {tabs && <div className="operational-page-header__tabs">{tabs}</div>}
    </header>
  );
}

type PanelProps = React.HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'article' | 'aside' | 'div';
};

export function Panel({ as: Component = 'section', className, ...props }: PanelProps) {
  return <Component className={cn('operational-panel', className)} {...props} />;
}

type MetricCardProps = {
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
  icon?: LucideIcon;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
};

export function MetricCard({ label, value, helper, icon: Icon, tone = 'neutral', className }: MetricCardProps) {
  return (
    <article className={`analytics-card analytics-metric ${cn('operational-metric', 'operational-metric--' + tone, className)}`}>
      <div className="operational-metric__top">
        <span>{label}</span>
        {Icon && <Icon className="size-4" aria-hidden="true" />}
      </div>
      <strong className="analytics-value">{value}</strong>
      {helper && <small>{helper}</small>}
    </article>
  );
}

type StatusBadgeProps = {
  children: React.ReactNode;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
};

export function StatusBadge({ children, tone = 'neutral', className }: StatusBadgeProps) {
  return <span className={cn('operational-status', 'operational-status--' + tone, className)}>{children}</span>;
}

export function FilterBar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('operational-filter-bar', className)} {...props} />;
}

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: LucideIcon;
  tone?: 'neutral' | 'primary' | 'danger';
};

export function IconButton({ label, icon: Icon, tone = 'neutral', className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn('operational-icon-button', 'operational-icon-button--' + tone, className)}
      {...props}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

type StatePanelProps = {
  kind: 'loading' | 'empty' | 'error';
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function StatePanel({ kind, title, description, action, className }: StatePanelProps) {
  const Icon = kind === 'loading' ? Loader2 : kind === 'error' ? AlertCircle : Inbox;
  const defaultTitle = kind === 'loading' ? 'Carregando informações' : kind === 'error' ? 'Não foi possível carregar' : 'Nenhum registro encontrado';

  return (
    <div className={cn('operational-state', 'operational-state--' + kind, className)} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon className={cn('size-5', kind === 'loading' && 'animate-spin')} aria-hidden="true" />
      <strong>{title || defaultTitle}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
