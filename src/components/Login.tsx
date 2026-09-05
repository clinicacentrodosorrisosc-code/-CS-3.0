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
  ArrowRight,
  HeartHandshake,
  Clock
} from 'lucide-react';
import clinicShowcaseImg from '../assets/images/centro_do_sorriso_showcase.jpg';

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
    <div className="min-h-screen flex items-center justify-center bg-[#f3f3f6] p-3 sm:p-6 font-sans relative overflow-hidden text-[#202027] select-none">
      {/* Background Animated Rings & Ambient Glows */}
      <div className="hidden" />
      <div className="hidden" />

      {/* Main Split Container: Login on Left, Clinic Showcase Image on Right */}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 rounded-2xl overflow-hidden border border-[#e2e2e8] bg-white shadow-[0_24px_70px_rgba(32,32,39,0.10)] relative z-10">

        {/* ============================================================ */}
        {/* LEFT SIDE: Login & Access Area (Posicionado mais à esquerda)  */}
        {/* ============================================================ */}
        <div className="lg:col-span-6 xl:col-span-5 p-7 sm:p-10 md:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#e8e8ed] bg-white relative z-20">

          {/* Header Brand */}
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#536fd1]/[0.08] text-[#4059b2] text-[11px] font-medium mb-5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              Gestão Odontológica Pro
            </div>

            <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.04em] text-[#202027] leading-[1.05]">
              Centro do <span className="text-[#4059b2]">Sorriso</span>
            </h1>

            <p className="text-xs sm:text-sm text-[#777782] mt-3 font-normal">
              {isSignUp
                ? 'Preencha os dados abaixo para solicitar sua conta no sistema.'
                : 'Acesse seu painel com credenciais autorizadas.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-4 my-6">
            <div>
              <label className="block text-[11px] font-medium text-[#696974] mb-1.5">
                E-mail Profissional
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#fafafd] border border-[#ddddE4] rounded-lg pl-10 pr-4 py-3 text-sm text-[#202027] placeholder-[#a0a0aa] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all "
                  placeholder="seu.email@centrodosorriso.com"
                />
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#85858f] w-4 h-4" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-medium text-[#696974]">
                  Senha
                </label>
                {!isSignUp && (
                  <span className="text-[11px] text-slate-500 hover:text-blue-400 transition-colors cursor-pointer">
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
                  className="w-full bg-[#fafafd] border border-[#ddddE4] rounded-lg pl-10 pr-10 py-3 text-sm text-[#202027] placeholder-[#a0a0aa] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all "
                  placeholder="••••••••"
                />
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#85858f] w-4 h-4" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#85858f] hover:text-[#4059b2] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isSignUp && (
              <div className="animate-fade-in">
                <label className="block text-[11px] font-medium text-[#696974] mb-1.5">
                  Cargo / Setor
                </label>
                <div className="relative">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-[#fafafd] border border-[#ddddE4] rounded-lg pl-10 pr-10 py-3 text-sm text-white appearance-none cursor-pointer focus:border-blue-500 outline-none transition-all"
                  >
                    <option value="reception">Recepção</option>
                    <option value="admin">Administrador</option>
                    <option value="user">Usuário Padrão</option>
                  </select>
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#85858f] w-4 h-4" />
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
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs rounded-xl text-center">
                {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-lg font-semibold text-sm tracking-wide bg-[#4059b2] hover:bg-[#354da4] text-white shadow-[0_8px_20px_rgba(64,89,178,0.16)] transition-all flex justify-center items-center gap-2 group mt-3 disabled:opacity-50 active:scale-[0.99]"
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
                className="ml-2 text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-4 transition-all"
              >
                {isSignUp ? 'Fazer Login' : 'Solicitar Cadastro'}
              </button>
            </p>
          </div>

          {/* Daily Inspiration Box (Sutil e elegante na esquerda) */}
          <div className="mt-6 p-4 rounded-xl bg-[#f7f7f9] border border-[#e8e8ed]">
            <div className="flex items-center gap-1.5 text-blue-400 mb-1.5">
              <Quote className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium text-slate-400">Mensagem do Dia</span>
            </div>
            <p className="text-[11px] italic text-[#5f5f6a] leading-relaxed">
              "{dailyMessage.text}"
            </p>
            <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mt-1.5 text-right">
              — {dailyMessage.author}
            </p>
          </div>

          {/* Bottom Security Footer */}
          <div className="mt-5 pt-4 border-t border-[#e8e8ed] flex items-center justify-between text-[10px] text-[#85858f]">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              Ambiente Criptografado & Seguro
            </span>
            <span>v3.0 Pro</span>
          </div>
        </div>

        {/* ============================================================ */}
        {/* RIGHT SIDE: Dedicated Space for "Centro do Sorriso" Image     */}
        {/* ============================================================ */}
        <div className="lg:col-span-6 xl:col-span-7 relative min-h-[380px] lg:min-h-[620px] flex flex-col justify-between overflow-hidden group">

          {/* Main Showcase Image */}
          <img
            src={clinicShowcaseImg}
            alt="Centro do Sorriso - Clínica de Excelência"
            className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 ease-out"
          />

          {/* Cinematic Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#101014] via-[#101014]/25 to-transparent z-10" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#101014]/70 via-transparent to-transparent z-10 hidden lg:block" />
          <div className="absolute inset-0 bg-[#4059b2]/10 mix-blend-multiply z-10" />

          {/* Top Floating Glass Badge */}
          <div className="relative z-20 p-6 sm:p-8 flex justify-between items-start">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-[#101014]/70 border border-white/10 backdrop-blur-xl text-white text-xs font-semibold shadow-xl">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              Centro do Sorriso • Unidade Matriz
            </div>

            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#101014]/65 border border-white/10 backdrop-blur-xl text-slate-300 text-[11px] font-medium shadow-lg">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              Atendimento Integrado
            </div>
          </div>

          {/* Bottom Floating Information Showcase */}
          <div className="relative z-20 p-6 sm:p-10 space-y-4">
            <div className="max-w-md p-5 rounded-xl bg-[#101014]/78 border border-white/10 backdrop-blur-2xl shadow-2xl">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-widest mb-1.5">
                <HeartHandshake className="w-4 h-4 text-blue-400" />
                Excelência & Cuidado Humano
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Transformando vidas através de sorrisos únicos.
              </h3>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Ambientes planejados com tecnologia de ponta, conforto e a dedicação dos melhores especialistas.
              </p>

              <div className="grid grid-cols-3 gap-2 pt-3.5 mt-3.5 border-t border-white/10 text-center">
                <div>
                  <div className="text-sm font-extrabold text-white">100%</div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-400">Digital</div>
                </div>
                <div className="border-x border-white/10">
                  <div className="text-sm font-extrabold text-blue-400">Seguro</div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-400">LGPD</div>
                </div>
                <div>
                  <div className="text-sm font-extrabold text-blue-400">24/7</div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-400">Cloud Sync</div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Page Minimal Footer */}
      <div className="absolute bottom-2 text-center w-full text-[10px] text-[#85858f] pointer-events-none">
        &copy; {new Date().getFullYear()} Centro do Sorriso | Todos os direitos reservados
      </div>
    </div>
  );
};
