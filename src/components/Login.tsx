
import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { ChevronDown } from 'lucide-react';

const DAILY_MESSAGES = [
  { text: "Posso todas as coisas naquele que me fortalece.", author: "Filipenses 4:13" },
  { text: "O Senhor é o meu pastor, nada me faltará.", author: "Salmos 23:1" },
  { text: "Seja forte e corajoso! Não desanime, pois o Senhor estará com você.", author: "Josué 1:9" },
  { text: "Tudo o que fizerem, façam de todo o coração, como para o Senhor.", author: "Colossenses 3:23" },
  { text: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", author: "Robert Collier" },
  { text: "Acredite que você pode e você já está no meio do caminho.", author: "Theodore Roosevelt" },
  { text: "Onde há foco, a energia flui.", author: "Tony Robbins" },
  { text: "Entregue o seu caminho ao Senhor; confie nele, e ele agirá.", author: "Salmos 37:5" },
  { text: "Grandes coisas fez o Senhor por nós, por isso estamos alegres.", author: "Salmos 126:3" },
  { text: "O que não nos mata, nos torna mais fortes.", author: "Friedrich Nietzsche" },
  { text: "Não se turbe o vosso coração; credes em Deus, crede também em mim.", author: "João 14:1" },
  { text: "A persistência é o caminho do êxito.", author: "Charles Chaplin" },
  { text: "Para Deus nada é impossível.", author: "Lucas 1:37" },
  { text: "A alegria do Senhor é a vossa força.", author: "Neemias 8:10" },
  { text: "Seja a mudança que você deseja ver no mundo.", author: "Mahatma Gandhi" },
  { text: "O choro pode durar uma noite, mas a alegria vem pela manhã.", author: "Salmos 30:5" },
  { text: "Nada é tão gratificante quanto transformar sorrisos.", author: "Motivacional" },
  { text: "O único lugar onde o sucesso vem antes do trabalho é no dicionário.", author: "Vidal Sassoon" },
  { text: "Tudo o que um sonho precisa para ser realizado é alguém que acredite que ele possa ser realizado.", author: "Roberto Shinyashiki" },
  { text: "Mil cairão ao teu lado, e dez mil à tua direita, mas tu não serás atingido.", author: "Salmos 91:7" }
];

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user'); 
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Seleciona a mensagem do dia baseada na data atual (muda a cada 24h)
  const dailyMessage = useMemo(() => {
    const dayOfYear = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    const index = dayOfYear % DAILY_MESSAGES.length;
    return DAILY_MESSAGES[index];
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: role 
            }
          }
        });
        if (error) throw error;
        setSuccessMsg('Cadastro realizado! Verifique seu email ou faça login.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 font-sans relative overflow-hidden">
      <div className="bg-surface backdrop-blur-2xl border border-border p-8 rounded-2xl shadow-2xl w-full max-w-md relative z-10 animate-in fade-in zoom-in duration-500">
            <div className="flex flex-col items-center mb-8">
                <div className="flex flex-col items-center leading-[0.8] font-sans mb-2">
                  <span className="text-blue-500 text-4xl font-extrabold tracking-tighter">Centro</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em]">do</span>
                    <span className="text-purple-500 text-4xl font-extrabold tracking-tighter">Sorriso</span>
                  </div>
                </div>
            </div>
            
            {/* MENSAGEM DO DIA */}
            <div className="mt-6 p-4 bg-panel border border-border rounded-xl w-full text-center relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <p className="text-slate-300 italic text-sm leading-relaxed">
                    "{dailyMessage.text}"
                </p>
                <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest mt-2">
                    — {dailyMessage.author}
                </p>
            </div>

            <form onSubmit={handleAuth} className="flex flex-col gap-4">
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email</label>
                <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-panel border border-border rounded-lg px-4 py-3 text-text focus:border-indigo-500 outline-none transition-all"
                    placeholder="seu@email.com"
                />
            </div>
            
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Senha</label>
                <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-panel border border-border rounded-lg px-4 py-3 text-text focus:border-indigo-500 outline-none transition-all"
                    placeholder="••••••••"
                />
            </div>

            {isSignUp && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Cargo / Função</label>
                  <div className="relative">
                    <select 
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full bg-panel border border-border rounded-lg px-4 py-3 text-text focus:border-indigo-500 outline-none appearance-none cursor-pointer"
                    >
                        <option value="reception">Recepção</option>
                        <option value="admin">Administrador</option>
                        <option value="user">Usuário Padrão</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none w-4 h-4" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Define as permissões iniciais de acesso.</p>
              </div>
            )}

            {errorMsg && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg text-center">{errorMsg}</div>}
            {successMsg && <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg text-center">{successMsg}</div>}

            <button 
                type="submit" 
                disabled={loading}
                className="mt-2 w-full glass-button glass-button-primary text-text font-bold py-3 rounded-xl shadow-lg transition-all flex justify-center items-center"
            >
                {loading ? (
                   <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                    isSignUp ? 'Criar Conta' : 'Entrar no Sistema'
                )}
            </button>
        </form>

        <div className="mt-6 text-center">
            <p className="text-sm text-slate-400">
                {isSignUp ? 'Já tem uma conta?' : 'Ainda não tem acesso?'}
                <button 
                    onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); setSuccessMsg(''); }}
                    className="ml-2 text-indigo-400 hover:text-text font-bold transition-all px-2 py-1 glass-button rounded-lg"
                >
                    {isSignUp ? 'Fazer Login' : 'Criar Cadastro'}
                </button>
            </p>
        </div>
      </div>
      
      <div className="absolute bottom-4 text-center w-full text-[10px] text-slate-600">
          &copy; {new Date().getFullYear()} Centro do Sorriso - Versão 2.1 | feito por James Moraes com muito amor ❤️ e muito Café ☕
      </div>
    </div>
  );
};
