import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log("=================================================");
  console.log("🔍 TESTE: LEADS CRIADOS E PROCEDIMENTOS REALIZADOS (15/08 A HOJE)");
  console.log("=================================================\n");

  // 1. Obter tokens Kommo
  const { data: tokensList, error: tokenErr } = await supabase.from('kommo_tokens').select('*');
  if (tokenErr || !tokensList || tokensList.length === 0) {
    console.error("Erro ao buscar tokens do Kommo:", tokenErr);
    return;
  }
  const tokens = tokensList[0];
  const subdomain = tokens.subdomain || 'centrodosorriso';
  const accessToken = tokens.access_token;

  // Datas: 15 de Agosto de 2026 a 19 de Agosto de 2026 (ou data atual)
  const now = new Date();
  const startTimestamp = Math.floor(new Date(2026, 7, 15, 0, 0, 0).getTime() / 1000); // 15/08/2026
  const endTimestamp = Math.floor(now.getTime() / 1000);

  console.log(`Período de Análise: 15/08/2026 até ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`);
  console.log(`Timestamps: ${startTimestamp} até ${endTimestamp}\n`);

  // 2. Buscar Leads Criados de 15 a hoje no Kommo
  console.log("📥 1. Buscando LEADS CRIADOS no Kommo...");
  try {
    const leadsRes = await fetch(`https://${subdomain}.kommo.com/api/v4/leads?filter[created_at][from]=${startTimestamp}&filter[created_at][to]=${endTimestamp}&with=contacts,loss_reason`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (leadsRes.status === 204) {
      console.log("⚠️ Nenhum lead criado encontrado no período.");
    } else if (!leadsRes.ok) {
      console.log("Erro na API de leads do Kommo:", leadsRes.status, await leadsRes.text());
    } else {
      const leadsData = await leadsRes.json() as any;
      const leads = leadsData._embedded?.leads || [];
      console.log(`✅ Total de Leads Criados no período: ${leads.length}\n`);
      leads.slice(0, 15).forEach((l: any, idx: number) => {
        const created = new Date(l.created_at * 1000).toLocaleString('pt-BR');
        console.log(`  ${idx + 1}. [ID: ${l.id}] ${l.name} | Criado em: ${created} | Valor: R$ ${l.price || 0} | Status: ${l.status_id}`);
      });
      if (leads.length > 15) {
        console.log(`  ... e mais ${leads.length - 15} leads.`);
      }
    }
  } catch (err) {
    console.error("Erro ao buscar leads criados:", err);
  }

  // 3. Buscar Eventos de Procedimentos / Mudanças de Etapa no Kommo
  console.log("\n📥 2. Buscando PROCEDIMENTOS / EVENTOS REALIZADOS de 15 a hoje...");
  try {
    const eventsRes = await fetch(`https://${subdomain}.kommo.com/api/v4/events?filter[created_at][from]=${startTimestamp}&filter[created_at][to]=${endTimestamp}&filter[entity_type]=lead&limit=100`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (eventsRes.status === 204) {
      console.log("⚠️ Nenhum evento encontrado no período.");
    } else if (!eventsRes.ok) {
      console.log("Erro na API de eventos do Kommo:", eventsRes.status, await eventsRes.text());
    } else {
      const eventsData = await eventsRes.json() as any;
      const events = eventsData._embedded?.events || [];
      console.log(`✅ Total de Eventos de Leads no período: ${events.length}\n`);
      
      const statusChanges = events.filter((e: any) => e.type === 'lead_status_changed' || e.type === 'lead_added' || e.type === 'lead_won');
      console.log(`  - Mudanças de Status / Ganhos / Procedimentos: ${statusChanges.length}`);
      statusChanges.slice(0, 15).forEach((e: any, idx: number) => {
        const date = new Date(e.created_at * 1000).toLocaleString('pt-BR');
        console.log(`  ${idx + 1}. [${date}] Lead ID: ${e.entity_id} | Tipo: ${e.type} | Info: ${JSON.stringify(e.value_after || {})}`);
      });
    }
  } catch (err) {
    console.error("Erro ao buscar eventos:", err);
  }

  // 4. Buscar Transações e Relatórios no Supabase
  console.log("\n📥 3. Buscando PROCEDIMENTOS / RELATÓRIOS no Supabase (dias 15 a hoje)...");
  try {
    const { data: reports, error: rErr } = await supabase
      .from('commercial_daily_reports')
      .select('*')
      .gte('report_date', '2026-08-15')
      .order('report_date', { ascending: true });

    if (rErr) {
      console.log("Tabela commercial_daily_reports:", rErr.message);
    } else {
      console.log(`✅ Relatórios Comerciais Diários (15 a hoje): ${reports?.length || 0}`);
      reports?.forEach((r: any) => {
        console.log(`  - Data: ${r.report_date} | Contratos Fechados: ${r.contracts_closed} | Agendamentos: ${r.appointments_made} | Valor Vendido: R$ ${r.value_sold || 0}`);
      });
    }

    const { data: transactions, error: tErr } = await supabase
      .from('financial_transactions')
      .select('*')
      .gte('date', '2026-08-15')
      .order('date', { ascending: true });

    if (tErr) {
      console.log("Tabela financial_transactions:", tErr.message);
    } else {
      console.log(`✅ Transações Financeiras / Procedimentos (15 a hoje): ${transactions?.length || 0}`);
      transactions?.slice(0, 10).forEach((t: any) => {
        console.log(`  - [${t.date}] ${t.description || t.patient_name} | R$ ${t.amount} | Tipo: ${t.type} | Categoria: ${t.category}`);
      });
    }
  } catch (err) {
    console.error("Erro ao buscar dados no Supabase:", err);
  }

  console.log("\n=================================================");
  console.log("🏁 TESTE CONCLUÍDO COM SUCESSO");
  console.log("=================================================");
}

runTest();
