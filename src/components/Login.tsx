import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { ChevronDown, Mail, Lock, Sparkles, Quote, ShieldCheck, User } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center bg-[#0d0f18] p-4 sm:p-6 font-sans relative overflow-hidden text-slate-100 select-none">
      {/* Background Animated Rings & Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Split Container */}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden border border-slate-800/80 bg-slate-900/60 backdrop-blur-2xl shadow-2xl shadow-purple-950/20 relative z-10 animate-slide-up">
        
        {/* Left Side: Brand Visual & Daily Inspiration (Desktop) */}
        <div className="lg:col-span-5 relative hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-purple-900/40 via-slate-900/80 to-slate-950 border-r border-slate-800/60 overflow-hidden">
          {/* Subtle background overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent pointer-events-none" />
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold mb-6">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Gestão Odontológica Pro
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
              Centro do <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">Sorriso</span>
            </h1>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Plataforma completa de gestão clínica, indicadores comerciais, laboratórios e métricas avançadas.
            </p>
          </div>

          {/* Daily Inspiration Box */}
          <div className="relative z-10 p-5 rounded-2xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-md">
            <Quote className="w-6 h-6 text-purple-400/60 mb-2" />
            <p className="text-xs italic text-slate-300 leading-relaxed">
              "{dailyMessage.text}"
            </p>
            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mt-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              {dailyMessage.author}
            </p>
          </div>

          <div className="relative z-10 text-[10px] text-slate-500 flex items-center justify-between border-t border-slate-800/80 pt-4">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Ambiente Seguro</span>
            <span>v2.1 Pro</span>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-center bg-slate-900/40">
          
          {/* Mobile Logo Header */}
          <div className="flex lg:hidden flex-col items-center mb-6 text-center">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Centro do <span className="text-purple-400">Sorriso</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">Acesse sua conta para continuar</p>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-white tracking-tight">
              {isSignUp ? 'Criar Nova Conta' : 'Bem-vindo de volta'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {isSignUp ? 'Preencha seus dados para solicitar credenciais.' : 'Digite seu e-mail e senha para acessar o painel.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">E-mail</label>
              <div className="relative">
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                  placeholder="seu@email.com"
                />
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Senha</label>
              <div className="relative">
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                  placeholder="••••••••"
                />
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              </div>
            </div>

            {isSignUp && (
              <div className="animate-fade-in">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Cargo / Função</label>
                <div className="relative">
                  <select 
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-10 pr-10 py-3 text-sm text-white appearance-none cursor-pointer focus:border-purple-500 outline-none transition-all"
                  >
                    <option value="reception">Recepção</option>
                    <option value="admin">Administrador</option>
                    <option value="user">Usuário Padrão</option>
                  </select>
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none w-4 h-4" />
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl text-center">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl text-center">
                {successMsg}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full btn btn-primary py-3.5 rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-purple-900/30 transition-all flex justify-center items-center mt-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                isSignUp ? 'Criar Minha Conta' : 'Acessar o Painel'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400">
              {isSignUp ? 'Já possui cadastro?' : 'Ainda não tem acesso?'}
              <button 
                onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); setSuccessMsg(''); }}
                className="ml-2 text-purple-400 hover:text-purple-300 font-semibold underline underline-offset-4 transition-all"
              >
                {isSignUp ? 'Fazer Login' : 'Criar Cadastro'}
              </button>
            </p>
          </div>

        </div>

      </div>

      {/* Footer */}
      <div className="absolute bottom-3 text-center w-full text-[10px] text-slate-500">
        &copy; {new Date().getFullYear()} Centro do Sorriso | Todos os direitos reservados
      </div>
    </div>
  );
};
