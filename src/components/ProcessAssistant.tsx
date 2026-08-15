
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Bot, User, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
    role: 'user' | 'model';
    text: string;
}

const CLINIC_PROCESSES_CONTEXT = `
Você é o Assistente de Processos da Clínica Odontomanager Pro.
Sua função é tirar dúvidas dos colaboradores sobre os processos internos da clínica.

DADOS DOS PROCESSOS DA CLÍNICA:

1. Recepção e Agenda:
- Checklist da Recepção: Preparar café/água, conferir agenda, cadastro completo (Nome, CPF, Tel, Origem, Queixa), orientar fluxo da avaliação.
- Organização da Agenda: Meta de 15 atendimentos (clínicos) ou 30 (clínico+orto). Agendar com margem de 20-30% para faltas.
- Confirmação: 1 dia antes via WhatsApp e 2 horas antes da consulta.
- Experiência do Paciente: Ambiente limpo, música baixa, aroma lavanda, chamar pelo nome, hospitalidade (café/água).

2. Comercial e Atendimento:
- Protocolo Comercial: Dentista faz diagnóstico; Comercial apresenta planos e valores.
- Jornada do Paciente (12 Etapas): Agendamento -> Confirmação -> Acolhimento -> Avaliação -> Comercial -> Pós-Venda (7 dias) -> Reavaliação (6 meses).
- Follow-up: Contatos em 24h, 3 dias e 7 dias para orçamentos não fechados.
- Negociação: Entender a dor do paciente (autoestima, mastigação) antes de passar preço.

3. Área Clínica (Prontuários e Biossegurança):
- Padronização do Prontuário: Registrar Queixa, Avaliação, Procedimento e Próximo Passo. Coletar assinatura do paciente.
- Auditoria: Coordenação revisa 5 prontuários/semana (meta 95% completos).
- Biossegurança (Autoclave): Limpeza com enzimático, secagem total, embalagem grau cirúrgico, esterilização monitorada.

4. Área Financeira:
- Fechamento de Caixa: Contagem física, extração de relatórios de cartões e conciliação no sistema.
- Contas a Pagar: Pagamentos nas Terças e Quintas.
- Metas: Acompanhar taxa de conversão comercial e satisfação do paciente.

INSTRUÇÕES:
- Responda de forma clara, profissional e amigável.
- Use listas e negrito para facilitar a leitura.
- Se a dúvida não estiver coberta, sugira consultar o manual detalhado na aba "Instruções de Trabalho".
`;

export const ProcessAssistant: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', text: 'Olá! Sou o assistente de processos da clínica. Em que posso te ajudar hoje?' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const handleSendMessage = async () => {
        if (!input.trim() || isTyping) return;

        const userText = input;
        setMessages(prev => [...prev, { role: 'user', text: userText }]);
        setInput('');
        setIsTyping(true);

        try {
            const history = messages.map(m => ({
                role: m.role,
                parts: [{ text: m.text }]
            }));

            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userText,
                    systemInstruction: CLINIC_PROCESSES_CONTEXT,
                    history: history
                })
            });

            let data: any = {};
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                data = await response.json().catch(() => ({}));
            } else {
                const text = await response.text();
                data = { error: text || `HTTP ${response.status}` };
            }
            if (data.text) {
                setMessages(prev => [...prev, { role: 'model', text: data.text }]);
            } else {
                throw new Error(data.error || 'Erro na resposta da IA');
            }
        } catch (error) {
            console.error('AI Error:', error);
            setMessages(prev => [...prev, { role: 'model', text: 'Desculpe, tive um problema para processar sua pergunta. Tente novamente em instantes.' }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="flex flex-col h-[500px] glass-panel rounded-3xl border border-border overflow-hidden">
            <div className="p-6 border-b border-border bg-gradient-to-r from-indigo-500/10 to-transparent flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-text">IA de Processos</h3>
                        <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest leading-none mt-1">Assistente de Treinamento</p>
                    </div>
                </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`shrink-0 size-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-panel/80'}`}>
                                {msg.role === 'user' ? <User className="w-4 h-4 text-text" /> : <Bot className="w-4 h-4 text-indigo-400" />}
                            </div>
                            <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                                msg.role === 'user' 
                                ? 'bg-indigo-600 text-text rounded-tr-none' 
                                : 'bg-panel text-slate-300 border border-border rounded-tl-none'
                            }`}>
                                <div className="markdown-body text-inherit">
                                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="flex gap-3 max-w-[85%]">
                            <div className="shrink-0 size-8 rounded-full bg-panel/80 flex items-center justify-center">
                                <Bot className="w-4 h-4 text-indigo-400" />
                            </div>
                            <div className="bg-panel p-4 rounded-2xl flex items-center gap-2">
                                <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                                <span className="text-xs text-slate-500 italic">Analisando processos...</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-6 border-t border-border bg-panel">
                <div className="relative">
                    <input 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Ex: Como funciona o fechamento mensal?"
                        className="w-full bg-panel border border-border rounded-xl pl-4 pr-12 py-3 text-sm text-text placeholder:text-slate-600 focus:border-indigo-500 outline-none transition-all"
                    />
                    <button 
                        onClick={handleSendMessage}
                        disabled={isTyping || !input.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 size-8 bg-indigo-600 hover:bg-indigo-500 text-text rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-[10px] text-slate-600 mt-3 text-center">
                    Respostas baseadas nos manuais de treinamento da Odontomanager Pro.
                </p>
            </div>
        </div>
    );
};
