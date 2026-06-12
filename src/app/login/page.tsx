'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, LogIn, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
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

  const handleSignUp = async () => {
    setIsLoading(true);
    setError(null);

    if (!nome.trim()) {
      setError('Nome é obrigatório');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Senha deve ter pelo menos 6 caracteres');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nome: nome.trim(),
          }
        }
      });

      if (error) {
        console.error('Erro detalhado do signup:', error);
        if (error.message?.includes('500') || error.status === 500) {
          setError('Erro no servidor do Supabase. Verifique se o cadastro está habilitado nas configurações do Supabase (Authentication > Providers > Email).');
        } else if (error.message?.includes('User already registered')) {
          setError('Este e-mail já está cadastrado. Tente fazer login.');
        } else {
          setError(`Erro ao criar conta: ${error.message}`);
        }
        setIsLoading(false);
        return;
      }

      // Criar usuário na tabela usuarios
      if (data.user) {
        const { error: insertError } = await supabase
          .from('usuarios')
          .insert({
            usu_id: data.user.id,
            usu_nome: nome.trim(),
            usu_email: email,
          });

        if (insertError) {
          console.error('Erro ao criar usuário na tabela:', insertError);
          // Verificar se é erro de tabela não existente
          if (insertError.message?.includes('relation') || insertError.message?.includes('does not exist')) {
            setError('Tabela de usuários não encontrada. Execute o script SQL: docs/create-usuarios-table.sql');
          } else {
            setError(`Erro ao salvar dados: ${insertError.message}`);
          }
        } else {
          alert('Conta criada com sucesso! Verifique seu e-mail para confirmar o cadastro.');
          setIsSignUp(false);
          setNome('');
        }
      }
    } catch (err: any) {
      console.error('Erro inesperado:', err);
      setError(`Erro inesperado: ${err.message || 'Tente novamente'}`);
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

        {isSignUp ? (
          <form onSubmit={(e) => { e.preventDefault(); handleSignUp(); }} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400 ml-1">Nome</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="Seu nome"
              />
            </div>
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
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : <UserPlus size={20} />}
              Criar Conta
            </button>

            <button
              type="button"
              onClick={() => setIsSignUp(false)}
              className="w-full text-zinc-400 hover:text-zinc-200 text-sm py-2 transition-all"
            >
              Já tem conta? Entrar
            </button>
          </form>
        ) : (
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
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-zinc-900 px-2 text-zinc-500">Ou continue com</span>
          </div>
        </div>

        {!isSignUp && (
          <div className="pb-4">
            <button
              onClick={() => setIsSignUp(true)}
              className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-2.5 rounded-xl transition-all border border-zinc-700"
            >
              <span className="text-sm">Criar Conta</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
