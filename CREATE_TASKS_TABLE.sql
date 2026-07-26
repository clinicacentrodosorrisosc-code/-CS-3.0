CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    responsible TEXT,
    start_date DATE,
    deadline DATE,
    priority TEXT DEFAULT 'Baixa',
    status TEXT DEFAULT 'Pendente',
    progress INTEGER DEFAULT 0,
    labels TEXT[],
    followers TEXT[],
    remind_me BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total tasks" ON public.tasks;
CREATE POLICY "Acesso total tasks" ON public.tasks FOR ALL TO public USING (true) WITH CHECK (true);
