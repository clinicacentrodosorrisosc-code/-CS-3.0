
-- SQL Script to create daily_performance table
CREATE TABLE IF NOT EXISTS public.daily_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL UNIQUE,
    user_id UUID REFERENCES auth.users(id),
    leads_received INTEGER DEFAULT 0,
    new_leads INTEGER DEFAULT 0,
    appointments_made INTEGER DEFAULT 0,
    budgets_presented DECIMAL(12,2) DEFAULT 0,
    contracts_closed DECIMAL(12,2) DEFAULT 0,
    objections JSONB DEFAULT '[]'::jsonb,
    appointments_by_time JSONB DEFAULT '[]'::jsonb,
    main_challenges TEXT,
    opportunities TEXT,
    raw_answers JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.daily_performance ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Acesso total daily_performance" ON public.daily_performance;
CREATE POLICY "Acesso total daily_performance" ON public.daily_performance FOR ALL TO public USING (true) WITH CHECK (true);

-- Reload schema
NOTIFY pgrst, 'reload schema';
