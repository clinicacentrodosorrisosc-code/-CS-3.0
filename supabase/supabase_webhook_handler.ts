/* 
   INSTRUÇÕES DE IMPLANTAÇÃO:
   1. Crie uma nova Edge Function no Supabase CLI: `supabase functions new webhook`
   2. Cole este código no arquivo `index.ts` da função.
   3. Configure o Webhook no seu outro sistema apontando para a URL da function.
*/

// Fix: Declare Deno as a global variable to fix compilation errors in non-Deno environments.
declare const Deno: any;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    console.log("Webhook recebido:", payload)

    const { type, resource } = payload
    const externalId = resource.uuid
    
    // Mapeamento de Status
    // O seu JSON mostra parcelas com status 'open'. Mapeamos para 'Pending' ou 'Paid'.
    const parcel = resource.payment_methods?.[0]?.parcels?.[0]
    const status = parcel?.status === 'paid' ? 'Paid' : 'Pending'
    
    // Mapeamento de Valores (Assumindo que 100000 = R$ 1.000,00)
    const amount = Number(resource.final_amount) / 100

    if (type === 'bill.created' || type === 'bill.updated') {
      const { error } = await supabase.from('transactions').upsert({
        id: `ext_${externalId}`,
        external_id: externalId,
        description: resource.description,
        amount: amount,
        category: resource.category?.name || 'Integração',
        date: resource.emission_date?.split('T')[0],
        type: 'expense', // Como solicitado: "criado automaticamente em despesas"
        status: status,
        source: 'SISTEMA_EXTERNO',
        payment_method: 'Webhook'
      }, { onConflict: 'external_id' })

      if (error) throw error
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Erro no Webhook:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})