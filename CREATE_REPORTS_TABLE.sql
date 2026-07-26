-- RODAR ESTE SCRIPT NO SQL EDITOR DO SUPABASE PARA CRIAR/ATUALIZAR A TABELA DE RELATÓRIO COMERCIAL
-- Este script adiciona todos os campos necessários para o novo relatório de performance diária

CREATE TABLE IF NOT EXISTS public.commercial_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL UNIQUE,
    user_id UUID,
    leads_received INTEGER DEFAULT 0,
    new_leads INTEGER DEFAULT 0,
    appointments_made INTEGER DEFAULT 0,
    budgets_presented DECIMAL(12, 2) DEFAULT 0,
    contracts_closed DECIMAL(12, 2) DEFAULT 0,
    objections JSONB DEFAULT '[]'::JSONB,
    appointments_by_time JSONB DEFAULT '[]'::JSONB,
    main_challenges TEXT,
    opportunities TEXT,
    raw_answers JSONB,
    ortho_starts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Adicionar colunas caso a tabela já exista (migração manual segura)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commercial_reports' AND column_name='user_id') THEN
        ALTER TABLE public.commercial_reports ADD COLUMN user_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commercial_reports' AND column_name='new_leads') THEN
        ALTER TABLE public.commercial_reports ADD COLUMN new_leads INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commercial_reports' AND column_name='objections') THEN
        ALTER TABLE public.commercial_reports ADD COLUMN objections JSONB DEFAULT '[]'::JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commercial_reports' AND column_name='appointments_by_time') THEN
        ALTER TABLE public.commercial_reports ADD COLUMN appointments_by_time JSONB DEFAULT '[]'::JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commercial_reports' AND column_name='raw_answers') THEN
        ALTER TABLE public.commercial_reports ADD COLUMN raw_answers JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commercial_reports' AND column_name='ortho_starts') THEN
        ALTER TABLE public.commercial_reports ADD COLUMN ortho_starts INTEGER DEFAULT 0;
    END IF;
END $$;

-- Habilitar RLS
ALTER TABLE public.commercial_reports ENABLE ROW LEVEL SECURITY;

-- Criar políticas de acesso
DROP POLICY IF EXISTS "Allow authenticated all" ON public.commercial_reports;
CREATE POLICY "Allow authenticated all" ON public.commercial_reports
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all" ON public.commercial_reports;
CREATE POLICY "Allow anon all" ON public.commercial_reports
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_commercial_reports_date ON public.commercial_reports(report_date);

-- Recarregar cache do PostgREST
NOTIFY pgrst, 'reload schema';
