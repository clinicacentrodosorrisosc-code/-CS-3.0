import fs from 'fs';
const file = 'src/components/CommercialDailyReport.tsx';
let content = fs.readFileSync(file, 'utf8');

const shareFn = `
    const handleShareWhatsApp = () => {
        let text = "*Relatório Comercial - " + reportDate.split('-').reverse().join('/') + "*\\n\\n";
        text += "*1. Como chegou:* " + (answers.q1_arrival || 'N/A') + "\\n";
        text += "*2. Contatos Novos:* " + answers.q2_contacts_count + "\\n";
        text += "*2b. Resgates (não novos):* " + answers.q2_rescue_contacts_count + "\\n";
        text += "*2c. Resgates que viraram agendamentos:* " + answers.q2_positive_rescue_count + "\\n";
        text += "*3. Respostas Positivas:* " + answers.q3_positive_count + "\\n";
        if (answers.q4_positive_details) text += "*4. Detalhes (Positivas):* " + answers.q4_positive_details + "\\n";
        text += "*5. Novos Agendamentos:* " + answers.q5_appointments_count + "\\n";
        text += "*5b. Agendados p/ hoje:* " + answers.q5_scheduled_for_today_count + "\\n";
        text += "*Presenças (Compareceram):* " + answers.q5_attended_count + "\\n";
        text += "*Faltas:* " + answers.q5_no_show_count + "\\n";
        text += "*Remarcações:* " + answers.q5_rescheduled_count + "\\n";
        text += "*Cancelamentos:* " + answers.q5_cancelled_count + "\\n";
        if (answers.q6_timeframe_options.length > 0) text += "*6. Para quando:* " + answers.q6_timeframe_options.join(', ') + "\\n";
        text += "*7. Valor Vendido:* R$ " + answers.q7_value_sold + "\\n";
        text += "*7. Valor Recebido:* R$ " + answers.q7_value_received + "\\n";
        text += "*8. Pós-vendas hoje:* " + answers.q8_post_sales_count + "\\n";
        text += "*9. Reativações hoje:* " + answers.q9_reactivations_count + "\\n";
        text += "*Orto Iniciados hoje:* " + answers.ortho_starts + "\\n";
        if (answers.m_contacts_count !== undefined) text += "*M. Contatos (Mkt):* " + answers.m_contacts_count + "\\n";
        if (answers.m_responses_count !== undefined) text += "*M. Respostas (Mkt):* " + answers.m_responses_count + "\\n";
        if (answers.m_future_appointments_count !== undefined) text += "*M. Agendamentos Futuros:* " + answers.m_future_appointments_count + "\\n";
        if (answers.m_new_presential_appointments_count !== undefined) text += "*M. Agendamentos Presenciais:* " + answers.m_new_presential_appointments_count + "\\n";
        text += "*10. Avaliação do dia:* " + (answers.q10_day_rating || 'N/A') + "\\n";
        if (answers.q10_explanation) text += "*Motivo:* " + answers.q10_explanation + "\\n";
        
        if (answers.objections.length > 0) {
            text += "\\n*Objeções:*\\n";
            answers.objections.forEach((o, i) => {
                text += "- " + o.type + " (" + o.reason + ")\\n";
            });
        }
        
        const url = "https://wa.me/?text=" + encodeURIComponent(text);
        window.open(url, '_blank');
    };
`;

const buttonTarget = `<button 
                                          onClick={handleSave}
                                          disabled={saving || loading}
                                          className="flex-1 py-4.5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-indigo-600/15 disabled:opacity-50 hover:shadow-indigo-600/25 text-sm"
                                     >
                                          {saving ? 'Gravando dados...' : (
                                               <>
                                                   <Save className="w-5 h-5 animate-pulse" />
                                                   Gravar Relatório de Hoje
                                               </>
                                          )}
                                     </button>`;

const buttonReplacement = `<button 
                                          onClick={handleSave}
                                          disabled={saving || loading}
                                          className="flex-1 py-4.5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-indigo-600/15 disabled:opacity-50 hover:shadow-indigo-600/25 text-sm"
                                     >
                                          {saving ? 'Gravando dados...' : (
                                               <>
                                                   <Save className="w-5 h-5 animate-pulse" />
                                                   Gravar Relatório
                                               </>
                                          )}
                                     </button>
                                     <button 
                                          onClick={handleShareWhatsApp}
                                          disabled={saving || loading}
                                          className="flex-1 py-4.5 bg-green-600 hover:bg-green-500 active:scale-[0.98] text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-green-600/15 disabled:opacity-50 hover:shadow-green-600/25 text-sm"
                                     >
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                                        </svg>
                                        Compartilhar
                                     </button>`;

if (content.includes(buttonTarget)) {
  content = content.replace(buttonTarget, buttonReplacement);
  content = content.replace('const handleSave = async () => {', shareFn + '\\n    const handleSave = async () => {');
  fs.writeFileSync(file, content);
  console.log('Patched CommercialDailyReport.tsx');
} else {
  console.log('Target not found in CommercialDailyReport.tsx');
}
