'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Sparkles, Loader2, LogIn, Github } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    } else {
      router.push('/');
    }
  };

  const handleGitHubLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleSignUp = async () => {
    setIsLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      alert('Verifique seu e-mail para confirmar o cadastro!');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 bg-zinc-900/50 border border-zinc-800 p-8 rounded-3xl shadow-2xl backdrop-blur-sm">
        <div className="text-center space-y-2">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-zinc-800 flex items-center justify-center shadow-lg shadow-indigo-900/20 mb-4 overflow-hidden">
            <img src="/cuca_logo.png" alt="Cuca AI Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Cuca AI</h1>
          <p className="text-zinc-500 text-sm">Entre no seu novo segundo cérebro</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400 ml-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              placeholder="seu@email.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400 ml-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-indigo-900/40 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
            Entrar
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-zinc-900 px-2 text-zinc-500">Ou continue com</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pb-4">
          <button
            onClick={handleGitHubLogin}
            className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-2.5 rounded-xl transition-all border border-zinc-700"
          >
            <Github size={18} />
            <span className="text-sm">GitHub</span>
          </button>
          <button
            onClick={handleSignUp}
            className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-2.5 rounded-xl transition-all border border-zinc-700"
          >
            <span className="text-sm">Criar Conta</span>
          </button>
        </div>
      </div>
    </div>
  );
}
