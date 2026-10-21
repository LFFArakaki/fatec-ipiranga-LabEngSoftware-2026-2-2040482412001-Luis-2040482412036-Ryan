import { useState } from 'react'
import { MessageSquare, Eye, EyeOff } from 'lucide-react'
import { login, mensagemDeErro } from '../api'

interface LoginProps {
  onNavigate: (screen: string) => void;
  onLogin: () => Promise<void>;
  aviso?: string;
}

export function Login({ onNavigate, onLogin, aviso }: LoginProps) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')

    if (!email.trim() || !senha) {
      setErro('Preencha o e-mail e a senha.')
      return
    }

    setLoading(true)

    try {
      await login(email.trim(), senha)
      await onLogin()
    } catch (err) {
      setErro(mensagemDeErro(err))
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <div className="hidden lg:flex w-1/2 bg-brand-500 relative flex-col justify-center items-center p-12 h-full overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600 rounded-full mix-blend-overlay filter blur-[100px]"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-400 rounded-full mix-blend-overlay filter blur-[100px]"></div>
        </div>

        <div className="relative z-10 max-w-md text-white text-center">
          <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mb-8 mx-auto shadow-xl">
            <MessageSquare className="w-12 h-12 text-brand-500" />
          </div>
          <h1 className="text-4xl font-bold mb-6 leading-tight">
            Todas as suas conversas em um só lugar
          </h1>
          <p className="text-brand-100 text-lg">
            Conecte suas redes sociais e gerencie todos os seus atendimentos de
            forma simples e rápida.
          </p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 h-full overflow-y-auto flex flex-col relative">
        <div className="w-full max-w-md m-auto px-6 py-12 flex flex-col">
          <div className="flex flex-col items-center mb-10 lg:hidden">
            <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
              <MessageSquare className="w-8 h-8 text-brand-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">CommuniHub</h1>
            <p className="text-slate-500 mt-2">Bem-vindo de volta</p>
          </div>

          <div className="hidden lg:block mb-10">
            <h2 className="text-3xl font-bold text-slate-900">
              Bem-vindo de volta
            </h2>
            <p className="text-slate-500 mt-2">
              Faça login para acessar sua conta
            </p>
          </div>

          {aviso && !erro && (
            <div role="status" className="p-3 text-sm text-brand-700 bg-brand-50 rounded-xl mb-6">
              {aviso}
            </div>
          )}

          {erro && (
            <div role="alert" className="p-3 text-sm text-red-600 bg-red-50 rounded-xl mb-6">
              {erro}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                E-mail
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => onNavigate('esqueci-senha')}
                  className="text-sm text-brand-600 font-medium hover:underline outline-none bg-transparent border-none p-0 cursor-pointer"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-4 pr-12 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 outline-none cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors shadow-sm mt-4 cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-slate-600 text-sm">
              Não tem conta?{' '}
              <button
                onClick={() => onNavigate('cadastro')}
                className="text-brand-600 font-semibold hover:underline outline-none bg-transparent border-none p-0 cursor-pointer"
              >
                Cadastre-se
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}