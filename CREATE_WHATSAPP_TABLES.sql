
-- ==========================================
-- WHATSAPP CHATS AND MESSAGES TABLES
-- ==========================================

-- 1. WHATSAPP CHATS
CREATE TABLE IF NOT EXISTS public.whatsapp_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT UNIQUE NOT NULL,
    contact_name TEXT,
    last_message TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. WHATSAPP MESSAGES
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES public.whatsapp_chats(id) ON DELETE CASCADE,
    message_id TEXT, -- ID from Meta
    from_number TEXT NOT NULL,
    to_number TEXT NOT NULL,
    text TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    status TEXT DEFAULT 'sent', -- sent, delivered, read, failed, received
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    is_from_me BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. ENABLE RLS
ALTER TABLE public.whatsapp_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES (Access for all authenticated users for now)
DROP POLICY IF EXISTS "Acesso total whatsapp_chats" ON public.whatsapp_chats;
CREATE POLICY "Acesso total whatsapp_chats" ON public.whatsapp_chats FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total whatsapp_messages" ON public.whatsapp_messages;
CREATE POLICY "Acesso total whatsapp_messages" ON public.whatsapp_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. REALTIME ENABLE
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
