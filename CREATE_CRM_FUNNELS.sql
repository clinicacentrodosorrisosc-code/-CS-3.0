
-- ==========================================
-- CRM FUNNELS AND KANBAN TABLES
-- ==========================================

-- 1. CRM FUNNELS
CREATE TABLE IF NOT EXISTS public.crm_funnels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. CRM STAGES
CREATE TABLE IF NOT EXISTS public.crm_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funnel_id UUID REFERENCES public.crm_funnels(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    color TEXT DEFAULT '#orange-500',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. CRM LEADS (The cards)
CREATE TABLE IF NOT EXISTS public.crm_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funnel_id UUID REFERENCES public.crm_funnels(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES public.crm_stages(id) ON DELETE SET NULL,
    chat_id UUID REFERENCES public.whatsapp_chats(id) ON DELETE CASCADE,
    contact_name TEXT,
    last_message TEXT,
    status TEXT DEFAULT 'active',
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ENABLE RLS
ALTER TABLE public.crm_funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "Acesso total crm_funnels" ON public.crm_funnels FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total crm_stages" ON public.crm_stages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total crm_leads" ON public.crm_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_funnels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_stages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_leads;
