import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ChevronDown, 
  Mail, 
  Lock, 
  Sparkles, 
  Quote, 
  ShieldCheck, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight
} from 'lucide-react';
import clinicShowcaseImg from '../assets/images/centro_do_sorriso_login.png';
import { SelectMenu } from './ui/select-menu';

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
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen flex items-center justify-center bg-[#07090e] p-3 sm:p-6 font-sans relative overflow-hidden text-slate-100 select-none">
      {/* Background Animated Rings & Ambient Glows */}
      <div className="absolute top-10 left-10 w-[500px] h-[500px] bg-sky-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Split Container: Login on Left, Clinic Showcase Image on Right */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden border border-slate-800/80 bg-slate-900/70 backdrop-blur-2xl shadow-2xl shadow-black/60 relative z-10">
        
        {/* ============================================================ */}
        {/* LEFT SIDE: Login & Access Area (Posicionado mais à esquerda)  */}
        {/* ============================================================ */}
        <div className="lg:col-span-6 xl:col-span-5 p-7 sm:p-10 md:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-slate-950/90 relative z-20">
          
          {/* Header Brand */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold mb-5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              Gestão Odontológica Pro
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
              Centro do <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-teal-300 to-emerald-400">Sorriso</span>
            </h1>
            
            <p className="text-xs sm:text-sm text-slate-400 mt-2 font-normal">
              {isSignUp 
                ? 'Preencha os dados abaixo para solicitar sua conta no sistema.' 
                : 'Acesse seu painel com credenciais autorizadas.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-4 my-6">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                E-mail Profissional
              </label>
              <div className="relative">
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-all shadow-inner"
                  placeholder="seu.email@centrodosorriso.com"
                />
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Senha
                </label>
                {!isSignUp && (
                  <span className="text-[11px] text-slate-500 hover:text-sky-400 transition-colors cursor-pointer">
                    Esqueceu?
                  </span>
                )}
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-all shadow-inner"
                  placeholder="••••••••"
                />
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isSignUp && (
              <div className="animate-fade-in">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Cargo / Setor
                </label>
                <div className="relative">
                  <SelectMenu
                    value={role}
                    onChange={setRole}
                    options={[
                      { value: 'reception', label: 'Recepção' },
                      { value: 'admin', label: 'Administrador' },
                      { value: 'user', label: 'Usuário Padrão' },
                    ]}
                    placeholder="Selecionar cargo"
                    searchPlaceholder="Buscar cargo..."
                  />
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
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-600 hover:from-sky-400 hover:to-emerald-500 text-white shadow-lg shadow-sky-950/40 transition-all flex justify-center items-center gap-2 group mt-3 disabled:opacity-50 active:scale-[0.99]"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isSignUp ? 'Criar Minha Conta' : 'Entrar no Sistema'}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Toggle SignUp / SignIn */}
          <div className="text-center pt-2">
            <p className="text-xs text-slate-400">
              {isSignUp ? 'Já possui cadastro?' : 'Ainda não tem acesso?'}
              <button 
                onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); setSuccessMsg(''); }}
                className="ml-2 text-sky-400 hover:text-sky-300 font-semibold underline underline-offset-4 transition-all"
              >
                {isSignUp ? 'Fazer Login' : 'Solicitar Cadastro'}
              </button>
            </p>
          </div>

          {/* Daily Inspiration Box (Sutil e elegante na esquerda) */}
          <div className="mt-6 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-sky-400 mb-1.5">
              <Quote className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mensagem do Dia</span>
            </div>
            <p className="text-[11px] italic text-slate-300 leading-relaxed">
              "{dailyMessage.text}"
            </p>
            <p className="text-[9px] font-bold text-sky-400 uppercase tracking-widest mt-1.5 text-right">
              — {dailyMessage.author}
            </p>
          </div>

          {/* Bottom Security Footer */}
          <div className="mt-5 pt-4 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Ambiente Criptografado & Seguro
            </span>
            <span>v3.0 Pro</span>
          </div>
        </div>

        {/* ============================================================ */}
        {/* RIGHT SIDE: Dedicated Space for "Centro do Sorriso" Image     */}
        {/* ============================================================ */}
        <div className="lg:col-span-6 xl:col-span-7 relative min-h-[380px] lg:min-h-[640px] overflow-hidden group">
          
          {/* Main Showcase Image */}
          <img 
            src={clinicShowcaseImg} 
            alt="Centro do Sorriso - Clínica de Excelência"
            className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-1000 ease-out"
          />

        </div>

      </div>

      {/* Page Minimal Footer */}
      <div className="absolute bottom-2 text-center w-full text-[10px] leading-relaxed text-slate-500 pointer-events-none">
        <div>&copy; {new Date().getFullYear()} Centro do Sorriso | Todos os direitos reservados</div>
        <div>Feita por James Moraes, com muito carinho e litros de café</div>
      </div>
    </div>
  );
};
