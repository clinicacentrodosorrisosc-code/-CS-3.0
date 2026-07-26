
-- ==========================================
-- 1. TABELA DE TRANSAÇÕES (FINANCEIRO)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    procedure TEXT,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount DECIMAL(12,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    payment_method TEXT,
    professional TEXT,
    installments INTEGER DEFAULT 1,
    account_id TEXT,
    reconciliation_status TEXT DEFAULT 'pending',
    invoice_emitted BOOLEAN DEFAULT false,
    observation TEXT,
    is_partial BOOLEAN DEFAULT false,
    applied_fee_rate DECIMAL(5,2),
    explicit_fee_amount DECIMAL(12,2),
    card_brand TEXT,
    external_id TEXT UNIQUE,
    source TEXT,
    sales_team TEXT,
    supplier TEXT,
    settlement_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total autenticado" ON public.transactions;
CREATE POLICY "Acesso total autenticado" ON public.transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==========================================
-- 1.1 TABELA DE TIMES DE VENDA
-- ==========================================
CREATE TABLE IF NOT EXISTS public.sales_teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.sales_teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total sales_teams" ON public.sales_teams;
CREATE POLICY "Acesso total sales_teams" ON public.sales_teams FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==========================================
-- 2. TABELA DE CONFIGURAÇÕES DO DASHBOARD
-- ==========================================
CREATE TABLE IF NOT EXISTS public.dashboard_configs (
    month_key TEXT PRIMARY KEY,
    revenue_goal DECIMAL(12,2) DEFAULT 0,
    business_days INTEGER DEFAULT 22,
    ana_eval_goal INTEGER DEFAULT 30,
    comercial_eval_goal INTEGER DEFAULT 30,
    leads_ana INTEGER DEFAULT 0,
    leads_com INTEGER DEFAULT 0,
    meta_token TEXT,
    meta_account_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.dashboard_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total dashboard" ON public.dashboard_configs;
CREATE POLICY "Acesso total dashboard" ON public.dashboard_configs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==========================================
-- 2.5 TABELA DE CONTAS (TENANCY)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_user_id UUID REFERENCES auth.users(id),
    default_currency TEXT DEFAULT 'BRL',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total contas" ON public.accounts;
CREATE POLICY "Acesso total contas" ON public.accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==========================================
-- 3. PROFILES E AVALIAÇÕES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.daily_evaluations (
    date DATE PRIMARY KEY,
    ana_scheduled INTEGER DEFAULT 0,
    ana_evaluated INTEGER DEFAULT 0,
    com_scheduled INTEGER DEFAULT 0,
    com_evaluated INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.daily_evaluations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total daily_evaluations" ON public.daily_evaluations;
CREATE POLICY "Acesso total daily_evaluations" ON public.daily_evaluations FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT,
    role TEXT DEFAULT 'user',
    allowed_tabs TEXT[],
    allowed_sub_tabs TEXT[],
    full_name TEXT,
    avatar_url TEXT,
    beta_features TEXT[] DEFAULT ARRAY[]::TEXT[],
    account_id UUID REFERENCES public.accounts(id),
    account_role TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total profiles" ON public.profiles;
CREATE POLICY "Acesso total profiles" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==========================================
-- CRM TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.accounts(id),
    phone TEXT NOT NULL,
    name TEXT,
    email TEXT,
    company TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total contacts" ON public.contacts;
CREATE POLICY "Acesso total contacts" ON public.contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total tags" ON public.tags;
CREATE POLICY "Acesso total tags" ON public.tags FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.contact_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(contact_id, tag_id)
);
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total contact_tags" ON public.contact_tags;
CREATE POLICY "Acesso total contact_tags" ON public.contact_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'open',
    assigned_agent_id UUID REFERENCES auth.users(id),
    last_message_text TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE,
    unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total conversations" ON public.conversations;
CREATE POLICY "Acesso total conversations" ON public.conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL,
    sender_id UUID,
    content_type TEXT NOT NULL DEFAULT 'text',
    content_text TEXT,
    media_url TEXT,
    template_name TEXT,
    message_id TEXT,
    status TEXT NOT NULL DEFAULT 'sent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total messages" ON public.messages;
CREATE POLICY "Acesso total messages" ON public.messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.whatsapp_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number_id TEXT NOT NULL,
    waba_id TEXT,
    access_token TEXT NOT NULL,
    verify_token TEXT,
    status TEXT NOT NULL DEFAULT 'disconnected',
    connected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id)
);
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total whatsapp_config" ON public.whatsapp_config;
CREATE POLICY "Acesso total whatsapp_config" ON public.whatsapp_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total pipelines" ON public.pipelines;
CREATE POLICY "Acesso total pipelines" ON public.pipelines FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total pipeline_stages" ON public.pipeline_stages;
CREATE POLICY "Acesso total pipeline_stages" ON public.pipeline_stages FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id),
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    value NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'BRL',
    notes TEXT,
    expected_close_date DATE,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total deals" ON public.deals;
CREATE POLICY "Acesso total deals" ON public.deals FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    actor_type TEXT NOT NULL,
    actor_id UUID,
    emoji TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total message_reactions" ON public.message_reactions;
CREATE POLICY "Acesso total message_reactions" ON public.message_reactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    language TEXT DEFAULT 'pt_BR',
    body_text TEXT NOT NULL,
    status TEXT DEFAULT 'APPROVED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total message_templates" ON public.message_templates;
CREATE POLICY "Acesso total message_templates" ON public.message_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==========================================
-- LABORATORIO E SUPORTE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.lab_prosthesis_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    default_value DECIMAL(12,2) DEFAULT 0,
    default_cost DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.lab_prosthesis_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo lab_prosthesis_types" ON public.lab_prosthesis_types;
CREATE POLICY "Permitir tudo lab_prosthesis_types" ON public.lab_prosthesis_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.lab_orders (
    id TEXT PRIMARY KEY,
    patient_name TEXT NOT NULL,
    protese_id UUID REFERENCES public.lab_prosthesis_types(id),
    details TEXT,
    lab_name TEXT,
    start_date DATE NOT NULL,
    due_date DATE,
    sale_value DECIMAL(12,2) DEFAULT 0,
    cost DECIMAL(12,2) DEFAULT 0,
    status TEXT DEFAULT 'Moldagem',
    type TEXT DEFAULT 'Prótese',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.lab_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo lab" ON public.lab_orders;
CREATE POLICY "Permitir tudo lab" ON public.lab_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.lab_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT REFERENCES public.lab_orders(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    method TEXT DEFAULT 'Geral',
    payment_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.lab_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo lab_payments" ON public.lab_payments;
CREATE POLICY "Permitir tudo lab_payments" ON public.lab_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.support_tickets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'Sistema',
    priority TEXT DEFAULT 'Media',
    status TEXT DEFAULT 'Aberto',
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo suporte" ON public.support_tickets;
CREATE POLICY "Permitir tudo suporte" ON public.support_tickets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==========================================
-- SENHAS E OUTROS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.service_passwords (
    id TEXT PRIMARY KEY,
    service_name TEXT NOT NULL,
    username TEXT NOT NULL,
    password_value TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.service_passwords ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total service_passwords" ON public.service_passwords;
CREATE POLICY "Acesso total service_passwords" ON public.service_passwords FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.kommo_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    subdomain TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.kommo_tokens DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.meta_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    access_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    app_id TEXT NOT NULL,
    app_secret TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.meta_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total meta_tokens" ON public.meta_tokens;
CREATE POLICY "Acesso total meta_tokens" ON public.meta_tokens FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.commercial_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL UNIQUE,
    leads_received INTEGER DEFAULT 0,
    appointments_made INTEGER DEFAULT 0,
    budgets_presented DECIMAL(12,2) DEFAULT 0,
    contracts_closed DECIMAL(12,2) DEFAULT 0,
    main_challenges TEXT,
    opportunities TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.commercial_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total commercial_reports" ON public.commercial_reports;
CREATE POLICY "Acesso total commercial_reports" ON public.commercial_reports FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.commercial_settings (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.commercial_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total commercial_settings" ON public.commercial_settings;
CREATE POLICY "Acesso total commercial_settings" ON public.commercial_settings FOR ALL TO public USING (true) WITH CHECK (true);

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

INSERT INTO public.commercial_settings (key, value)
VALUES ('daily_goals', '{"leads": 10, "contracts": 5000}')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
