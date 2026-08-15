import React, { useState } from 'react';
import { 
  BookOpen, MessageSquare, Copy, Check, 
  HelpCircle, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

interface ObjectionItem {
  id: string;
  objection: string;
  category: 'Preço' | 'Decisão' | 'Crédito' | 'Concorrência' | 'Medo';
  explanation: string;
  recommendedResponse: string;
  goldenTip: string;
}

interface ScriptItem {
  id: string;
  title: string;
  category: 'Confirmação' | 'Follow-up' | 'Reativação' | 'Pós-Venda';
  description: string;
  messageTemplate: string;
}

const OBJECTIONS: ObjectionItem[] = [
  {
    id: 'obj_1',
    objection: '"Achei muito caro / O valor está acima do que eu esperava"',
    category: 'Preço',
    explanation: 'O paciente compara o preço sem entender o risco de tratamentos inferiores ou o valor da tecnologia, durabilidade e experiência.',
    recommendedResponse: '“Compreendo perfeitamente, [Nome]. Quando olhamos apenas para o número isolado, pode parecer um investimento expressivo. No entanto, estamos falando da reconstrução da sua mastigação e do seu sorriso com materiais premium que duram décadas, sem dor e com garantia de acompanhamento. Além disso, conseguimos flexibilizar a forma de pagamento em até 24x para que a parcela fique confortável no seu orçamento mensal. Vamos ver a melhor condição para você?”',
    goldenTip: 'Nunca dê desconto direto logo de cara. Primeiro aumente o valor percebido, apresente as opções de parcelamento e mostre o prejuízo de adiar o tratamento.'
  },
  {
    id: 'obj_2',
    objection: '"Vou conversar com meu esposo / esposa antes de decidir"',
    category: 'Decisão',
    explanation: 'O parceiro muitas vezes é o decisor financeiro e não esteve presente na consulta para ver o diagnóstico visual e a urgência.',
    recommendedResponse: '“Excelente, [Nome]! Decisões importantes sobre a saúde da família devem ser compartilhadas. Para que ele(a) entenda exatamente o planejamento e veja as fotos do seu caso, o que acha de marcarmos um café rápido de 15 minutos aqui na clínica com vocês dois? Eu apresento as opções e tiramos todas as dúvidas juntos. Posso reservar quinta ou sexta?”',
    goldenTip: 'Evite deixar o paciente tentar explicar sozinho o plano complexo em casa. Traga o cônjuge para a clínica ou envie um resumo visual direto no WhatsApp.'
  },
  {
    id: 'obj_3',
    objection: '"Não tenho limite suficiente no meu cartão de crédito"',
    category: 'Crédito',
    explanation: 'O paciente quer fazer o tratamento, mas o limite bancário individual bloqueia a compra do valor total de uma só vez.',
    recommendedResponse: '“Sem problemas, [Nome], nós temos alternativas justamente para isso! Trabalhamos com divisão em mais de um cartão de crédito, entrada facilitada no PIX + saldo parcelado, ou até a modalidade de pagamento recorrente mensal (que não compromete o limite total do cartão). Vamos simular a melhor alternativa agora?”',
    goldenTip: 'Tenha sempre na ponta da língua o parcelamento recorrente sem bloquear limite total ou a divisão em 2 cartões diferentes.'
  },
  {
    id: 'obj_4',
    objection: '"Vou fazer um orçamento em outras clínicas para comparar"',
    category: 'Concorrência',
    explanation: 'O paciente quer ter certeza de que não está pagando a mais e busca segurança.',
    recommendedResponse: '“Perfeito, você está certíssimo(a) em pesquisar! Ao comparar, preste muita atenção nas marcas dos implantes e resinas que serão utilizadas, se a clínica possui laboratório e tecnologia 3D integrada e qual o suporte pós-procedimento oferecido. Aqui na clínica seu plano é 100% garantido por especialistas. Para garantir os valores e bônus que calculamos hoje, vou segurar sua condição especial até [Data]. Tudo bem?”',
    goldenTip: 'Crie um prazo de validade para a proposta e eduque o paciente sobre os riscos de produtos de baixa qualidade em clínicas populares.'
  },
  {
    id: 'obj_5',
    objection: '"Tenho muito pânico de dentista e medo de sentir dor"',
    category: 'Medo',
    explanation: 'Traumas anteriores geram paralisia na tomada de decisão.',
    recommendedResponse: '“Entendo completamente o seu receio, [Nome], muitos dos nossos pacientes chegaram aqui com essa mesma preocupação. Hoje a odontologia moderna é totalmente indolor: utilizamos anestesia computadorizada sem picada, ambiente calmo e humanizado, e podemos associar sedação consciente com óxido nitroso para você relaxar totalmente durante todo o atendimento. Você não sentirá absolutamente nada!”',
    goldenTip: 'Acolha o medo com empatia imediata, explique a anestesia indolor e jamais minimize a fobia do paciente.'
  }
];

const SCRIPTS: ScriptItem[] = [
  {
    id: 'sc_1',
    title: 'Confirmação de Avaliação (Redução de Faltas)',
    category: 'Confirmação',
    description: 'Enviar 24h a 48h antes da consulta para garantir o comparecimento.',
    messageTemplate: `Olá, [Nome do Paciente]! Tudo bem? 😊

Aqui é da equipe da clínica Centro do Sorriso.

Passando para confirmar o seu horário reservado com o(a) [Dr. Nome do Avaliador] para a sua avaliação odontológica:

📅 Data: [Data]
⏰ Horário: [Horário]
📍 Endereço: [Endereço da Clínica]

Pedimos a gentileza de responder com "Confirmado" para garantirmos a sua vaga na agenda do especialista. Te esperamos!`
  },
  {
    id: 'sc_2',
    title: 'Follow-up D+1 (Pós-Apresentação de Orçamento)',
    category: 'Follow-up',
    description: 'Enviar no dia seguinte após a consulta de avaliação.',
    messageTemplate: `Olá [Nome do Paciente], bom dia! ☀️

Aqui é a [Seu Nome], da clínica. 

Como você está se sentindo após a consulta de ontem com o(a) [Dr. Nome]? 

Ficou alguma dúvida sobre o plano de tratamento ou as condições de parcelamento que conversamos? Estou à disposição para te ajudar a dar esse passo importante para a sua saúde e sorriso!`
  },
  {
    id: 'sc_3',
    title: 'Follow-up D+3 com Condição de Fechamento',
    category: 'Follow-up',
    description: 'Contato estratégico antes de expirar a condição do mês.',
    messageTemplate: `Olá, [Nome do Paciente]! Tudo bem?

Conversei com a nossa diretoria clínica sobre o seu planejamento de [Especialidade/Tratamento] e conseguimos segurar a condição especial de parcelamento em [X] vezes sem juros até esta [Dia da Semana].

Gostaria de agendar o início do seu procedimento para esta semana ainda? Temos horários disponíveis na [Quinta/Sexta]!`
  },
  {
    id: 'sc_4',
    title: 'Reativação de Pacientes Inativos (Checkup Anual)',
    category: 'Reativação',
    description: 'Para pacientes que não comparecem há mais de 6 meses.',
    messageTemplate: `Olá, [Nome do Paciente]! Saudades de você por aqui! 🦷✨

Notamos que já faz algum tempo desde a sua última profilaxia e revisão dental. 

A prevenção periódica é essencial para manter seu sorriso saudável e evitar surpresas. Estamos com a agenda de checkup aberta nesta semana com condições especiais para pacientes da casa. 

Qual o melhor dia para você dar um pulinho aqui?`
  },
  {
    id: 'sc_5',
    title: 'Pesquisa de Satisfação & Pós-Procedimento',
    category: 'Pós-Venda',
    description: 'Enviar no dia seguinte após a realização do procedimento.',
    messageTemplate: `Olá, [Nome do Paciente]! Aqui é a equipe da clínica. 💚

Gostaríamos de saber como você está se sentindo após o procedimento realizado ontem com o(a) [Dr. Nome]?

Seu conforto é nossa prioridade! Caso tenha qualquer dúvida ou desconforto, estamos 100% à disposição. Tenha um ótimo dia!`
  }
];

export const SalesPlaybook: React.FC = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'objections' | 'scripts'>('objections');
  const [filterCat, setFilterCat] = useState<string>('all');

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Roteiro copiado para a área de transferência!');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const objectionCategories = ['all', 'Preço', 'Decisão', 'Crédito', 'Concorrência', 'Medo'];
  const scriptCategories = ['all', 'Confirmação', 'Follow-up', 'Reativação', 'Pós-Venda'];

  const filteredObjections = OBJECTIONS.filter(o => 
    filterCat === 'all' || o.category === filterCat
  );

  const filteredScripts = SCRIPTS.filter(s => 
    filterCat === 'all' || s.category === filterCat
  );

  return (
    <div className="space-y-6">
      {/* Playbook Header */}
      <div className="bg-panel border border-border p-6 rounded-3xl backdrop-blur-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-text">Playbook Comercial & Roteiros de Vendas</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Guia oficial de quebra de objeções, scripts de WhatsApp e técnicas de fechamento para a equipe
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-950/60 p-1 rounded-xl border border-border">
          <button
            onClick={() => { setActiveTab('objections'); setFilterCat('all'); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'objections' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Matriz de Objeções
          </button>
          <button
            onClick={() => { setActiveTab('scripts'); setFilterCat('all'); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'scripts' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Scripts WhatsApp & Pós-Venda
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-bold text-slate-400 shrink-0 mr-1">Filtrar por categoria:</span>
        {(activeTab === 'objections' ? objectionCategories : scriptCategories).map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 ${
              filterCat === cat
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'bg-panel border border-border text-slate-400 hover:text-white'
            }`}
          >
            {cat === 'all' ? 'Todas' : cat}
          </button>
        ))}
      </div>

      {/* Objections View */}
      {activeTab === 'objections' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredObjections.map((obj) => (
              <div 
                key={obj.id} 
                className="bg-panel border border-border hover:border-indigo-500/40 p-5 rounded-2xl space-y-4 transition-all shadow-sm flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-extrabold uppercase font-mono">
                      Objeção de {obj.category}
                    </span>
                    <HelpCircle className="w-4 h-4 text-slate-500" />
                  </div>

                  <h3 className="text-sm font-black text-text leading-snug">
                    {obj.objection}
                  </h3>

                  <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
                    <strong>Por que o paciente diz isso:</strong> {obj.explanation}
                  </p>

                  <div className="bg-indigo-950/20 border border-indigo-500/20 p-3.5 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-indigo-300">
                      <span className="flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                        Script Recomendado de Contorno:
                      </span>
                      <button
                        onClick={() => handleCopy(obj.recommendedResponse, obj.id)}
                        className="text-xs font-bold text-indigo-400 hover:text-indigo-200 flex items-center gap-1"
                      >
                        {copiedId === obj.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedId === obj.id ? 'Copiado!' : 'Copiar'}</span>
                      </button>
                    </div>
                    <p className="text-xs text-slate-200 italic leading-relaxed">
                      {obj.recommendedResponse}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5 flex items-start gap-2 text-[11px] text-amber-300/90 bg-amber-500/5 p-2.5 rounded-xl border border-amber-500/10">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span><strong>Dica de Ouro:</strong> {obj.goldenTip}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scripts View */}
      {activeTab === 'scripts' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredScripts.map((script) => (
              <div 
                key={script.id}
                className="bg-panel border border-border p-5 rounded-2xl space-y-4 flex flex-col justify-between shadow-sm hover:border-indigo-500/30 transition-all"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-bold uppercase font-mono">
                      {script.category}
                    </span>
                    <button
                      onClick={() => handleCopy(script.messageTemplate, script.id)}
                      className="px-3 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      {copiedId === script.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === script.id ? 'Copiado!' : 'Copiar Mensagem'}</span>
                    </button>
                  </div>

                  <h3 className="text-sm font-extrabold text-text">{script.title}</h3>
                  <p className="text-xs text-slate-400">{script.description}</p>

                  <div className="bg-slate-950/80 p-3.5 rounded-xl border border-white/5 text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                    {script.messageTemplate}
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>Pronto para envio no WhatsApp</span>
                  <span>Personalize os campos [ ]</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
