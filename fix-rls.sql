-- ==========================================
-- 4.6 TABELA DE TOKENS DO KOMMO CRM (REDEFINIÇÃO DE POLÍTICA)
-- ==========================================
DROP POLICY IF EXISTS "Acesso total kommo_tokens" ON public.kommo_tokens;
CREATE POLICY "Acesso total kommo_tokens" ON public.kommo_tokens FOR ALL TO anon USING (true) WITH CHECK (true);

-- ==========================================
-- 4.8 TABELA DE RELATÓRIOS COMERCIAIS DIÁRIOS (REDEFINIÇÃO DE POLÍTICA)
-- ==========================================
DROP POLICY IF EXISTS "Acesso total anon commercial_reports" ON public.commercial_reports;
CREATE POLICY "Acesso total anon commercial_reports" ON public.commercial_reports FOR ALL TO anon USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
