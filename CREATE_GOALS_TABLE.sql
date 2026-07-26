-- RODAR NO SQL EDITOR DO SUPABASE
CREATE TABLE IF NOT EXISTS public.commercial_settings (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS
ALTER TABLE public.commercial_settings ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS "Acesso total commercial_settings" ON public.commercial_settings;
CREATE POLICY "Acesso total commercial_settings" ON public.commercial_settings FOR ALL TO anon USING (true) WITH CHECK (true);

-- Inicializar metas padrão se não existirem
INSERT INTO public.commercial_settings (key, value)
VALUES ('daily_goals', '{"leads": 10, "contracts": 5000}')
ON CONFLICT (key) DO NOTHING;
