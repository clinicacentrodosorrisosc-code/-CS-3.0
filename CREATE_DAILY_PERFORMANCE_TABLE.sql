-- SQL Script para criar/atualizar a tabela daily_performance
-- Este script cria a tabela de desempenho diário e adiciona defensivamente todas as colunas necessárias.

CREATE TABLE IF NOT EXISTS public.daily_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL UNIQUE,
    user_id UUID REFERENCES auth.users(id),
    leads_received INTEGER DEFAULT 0,
    new_leads INTEGER DEFAULT 0,
    appointments_made INTEGER DEFAULT 0,
    budgets_presented DECIMAL(12,2) DEFAULT 0,
    contracts_closed DECIMAL(12,2) DEFAULT 0,
    ortho_starts INTEGER DEFAULT 0,
    objections JSONB DEFAULT '[]'::jsonb,
    appointments_by_time JSONB DEFAULT '[]'::jsonb,
    main_challenges TEXT,
    opportunities TEXT,
    raw_answers JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Adicionar colunas caso a tabela já exista (migração segura sem perda de dados)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_performance' AND column_name='user_id') THEN
        ALTER TABLE public.daily_performance ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_performance' AND column_name='leads_received') THEN
        ALTER TABLE public.daily_performance ADD COLUMN leads_received INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_performance' AND column_name='new_leads') THEN
        ALTER TABLE public.daily_performance ADD COLUMN new_leads INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_performance' AND column_name='appointments_made') THEN
        ALTER TABLE public.daily_performance ADD COLUMN appointments_made INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_performance' AND column_name='budgets_presented') THEN
        ALTER TABLE public.daily_performance ADD COLUMN budgets_presented DECIMAL(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_performance' AND column_name='contracts_closed') THEN
        ALTER TABLE public.daily_performance ADD COLUMN contracts_closed DECIMAL(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_performance' AND column_name='ortho_starts') THEN
        ALTER TABLE public.daily_performance ADD COLUMN ortho_starts INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_performance' AND column_name='objections') THEN
        ALTER TABLE public.daily_performance ADD COLUMN objections JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_performance' AND column_name='appointments_by_time') THEN
        ALTER TABLE public.daily_performance ADD COLUMN appointments_by_time JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_performance' AND column_name='main_challenges') THEN
        ALTER TABLE public.daily_performance ADD COLUMN main_challenges TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_performance' AND column_name='opportunities') THEN
        ALTER TABLE public.daily_performance ADD COLUMN opportunities TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_performance' AND column_name='raw_answers') THEN
        ALTER TABLE public.daily_performance ADD COLUMN raw_answers JSONB;
    END IF;
END $$;

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.daily_performance ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
DROP POLICY IF EXISTS "Acesso total daily_performance" ON public.daily_performance;
CREATE POLICY "Acesso total daily_performance" ON public.daily_performance FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated daily_performance" ON public.daily_performance;
CREATE POLICY "Allow authenticated daily_performance" ON public.daily_performance FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon daily_performance" ON public.daily_performance;
CREATE POLICY "Allow anon daily_performance" ON public.daily_performance FOR ALL TO anon USING (true) WITH CHECK (true);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_daily_performance_date ON public.daily_performance(report_date);
CREATE INDEX IF NOT EXISTS idx_daily_performance_user ON public.daily_performance(user_id);

-- Recarregar cache de schema do PostgREST
NOTIFY pgrst, 'reload schema';
