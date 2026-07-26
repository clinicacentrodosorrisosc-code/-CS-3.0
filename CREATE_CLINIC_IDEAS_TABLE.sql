-- Script to create clinic_ideas table
CREATE TABLE IF NOT EXISTS public.clinic_ideas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT, -- e.g., 'Atendimento', 'Marketing', 'Estrutura', 'Processos'
    status TEXT DEFAULT 'Idea', -- 'Idea', 'Planning', 'Implementing', 'Done', 'Archived'
    priority TEXT DEFAULT 'Medium', -- 'Low', 'Medium', 'High'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID -- Optional: track who created it
);

-- Enable RLS
ALTER TABLE public.clinic_ideas ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Allow authenticated all clinic_ideas" ON public.clinic_ideas;
CREATE POLICY "Allow authenticated all clinic_ideas" ON public.clinic_ideas
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all clinic_ideas" ON public.clinic_ideas;
CREATE POLICY "Allow anon all clinic_ideas" ON public.clinic_ideas
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_clinic_ideas_status ON public.clinic_ideas(status);
CREATE INDEX IF NOT EXISTS idx_clinic_ideas_created_at ON public.clinic_ideas(created_at);
