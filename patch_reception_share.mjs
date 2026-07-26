import fs from 'fs';
const file = 'src/components/ReceptionDailyReport.tsx';
let content = fs.readFileSync(file, 'utf8');

const shareFn = `
    const handleShareWhatsApp = () => {
        let text = "*Relatório Recepção - " + reportDate.split('-').reverse().join('/') + "*\\n\\n";
        text += "*Agendamentos p/ hoje (final do dia anterior):* " + answers.q1_agendamentos_final_dia + "\\n";
        text += "*Atendimentos Finalizados (Compareceram):* " + answers.q2_atendimentos_finalizados + "\\n";
        text += "*Atendimentos Remarcados:* " + answers.q3_atendimentos_remarcados + "\\n";
        text += "*Atendimentos Cancelados:* " + answers.q4_atendimentos_cancelados + "\\n";
        text += "*Faltas (Não Compareceram):* " + answers.q5_nao_compareceram + "\\n";
        
        const url = "https://wa.me/?text=" + encodeURIComponent(text);
        window.open(url, '_blank');
    };
`;

const buttonTarget = `<div className="p-4 border-t border-white/5 bg-black/20">
                                    <button 
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-black py-3.5 rounded-xl transition-all shadow-lg hover:shadow-teal-600/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest active:scale-[0.98] cursor-pointer"
                                    >
                                        {saving ? (
                                            <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4" />
                                                <span>Gravar Relatório da Recepção</span>
                                            </>
                                        )}
                                    </button>
                                </div>`;

const buttonReplacement = `<div className="p-4 border-t border-white/5 bg-black/20 flex flex-col sm:flex-row gap-3">
                                    <button 
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-black py-3.5 rounded-xl transition-all shadow-lg hover:shadow-teal-600/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest active:scale-[0.98] cursor-pointer"
                                    >
                                        {saving ? (
                                            <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4" />
                                                <span>Gravar Relatório</span>
                                            </>
                                        )}
                                    </button>
                                    <button 
                                        onClick={handleShareWhatsApp}
                                        disabled={saving}
                                        className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-black py-3.5 rounded-xl transition-all shadow-lg hover:shadow-green-600/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest active:scale-[0.98] cursor-pointer"
                                    >
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                                        </svg>
                                        <span>Compartilhar</span>
                                    </button>
                                </div>`;

if (content.includes(buttonTarget)) {
  content = content.replace(buttonTarget, buttonReplacement);
  content = content.replace('const handleSave = async () => {', shareFn + '\\n    const handleSave = async () => {');
  fs.writeFileSync(file, content);
  console.log('Patched ReceptionDailyReport.tsx');
} else {
  console.log('Target not found in ReceptionDailyReport.tsx');
}
