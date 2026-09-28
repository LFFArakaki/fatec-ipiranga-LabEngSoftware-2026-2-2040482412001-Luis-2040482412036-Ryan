import { useState } from 'react'
import { ArrowLeft, KeyRound, MailCheck, MessageSquare, ShieldCheck } from 'lucide-react'
import { extrairMensagemErro, lerResposta } from '../api'

interface EsqueciSenhaProps {
  onNavigate: (screen: string) => void;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function EsqueciSenha({ onNavigate }: EsqueciSenhaProps) {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const enviarLink = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setErro('')

    if (!emailRegex.test(email.trim())) {
      setErro('Por favor, insira um e-mail válido.')
      return
    }

    setLoading(true)

    try {
      const resposta = await fetch('/api/auth/esqueci-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      if (!resposta.ok) {
        throw new Error(
          extrairMensagemErro(
            await lerResposta(resposta),
            'Não foi possível enviar o link. Tente novamente.',
          ),
        )
      }

      setEnviado(true)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro de conexão com o servidor.')
    } finally {
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

        <div className="relative z-10 max-w-md text-white">
          <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mb-8 shadow-xl">
            <KeyRound className="w-12 h-12 text-brand-500" />
          </div>
          <h1 className="text-4xl font-bold mb-6 leading-tight">
            Recupere o acesso à sua conta
          </h1>
          <p className="text-brand-100 text-lg mb-10">
            Enviaremos um link para o seu e-mail. Basta abri-lo para criar uma
            nova senha e voltar a conversar.
          </p>

          <div className="space-y-6 border-t border-white/20 pt-8">
            <div className="flex items-start gap-4">
              <ShieldCheck className="w-6 h-6 text-white shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold mb-1">Só você recebe o link</h3>
                <p className="text-brand-100">
                  O link é enviado apenas para o e-mail cadastrado na sua conta.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <MessageSquare className="w-6 h-6 text-white shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold mb-1">Suas conversas continuam seguras</h3>
                <p className="text-brand-100">
                  Nenhuma rede social conectada é perdida ao trocar a senha.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 h-full overflow-y-auto flex flex-col relative">
        <div className="px-4 py-4 flex items-center sticky top-0 bg-white/80 backdrop-blur-md z-10 lg:hidden">
          <button
            onClick={() => onNavigate('login')}
            aria-label="Voltar para o login"
            className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors outline-none cursor-pointer"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        </div>

        <div className="w-full max-w-md m-auto px-6 pb-12 lg:py-12 flex flex-col">
          <button
            onClick={() => onNavigate('login')}
            aria-label="Voltar para o login"
            className="hidden lg:inline-flex self-start p-2 -ml-2 mb-6 hover:bg-slate-100 rounded-full text-slate-600 transition-colors outline-none cursor-pointer"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <div className="flex flex-col items-center mb-10 lg:hidden">
            <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
              <KeyRound className="w-8 h-8 text-brand-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">CommuniHub</h1>
          </div>

          {enviado ? (
            <div className="text-center" role="status">
              <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <MailCheck className="w-10 h-10 text-brand-500" />
              </div>
              <h2 className="text-2xl lg:text-3xl font-bold text-slate-900">
                Verifique seu e-mail
              </h2>
              <p className="text-slate-500 mt-3">
                Se existir uma conta associada a{' '}
                <span className="font-semibold text-slate-900">{email.trim()}</span>,
                você receberá um link para redefinir sua senha.
              </p>
              <p className="text-slate-500 mt-2 mb-8">
                Abra o link e siga as instruções para criar uma nova senha.
              </p>

              <button
                onClick={() => onNavigate('login')}
                className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                Voltar para o login
              </button>

              {erro && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl mt-6">
                  {erro}
                </div>
              )}

              <p className="text-slate-600 text-sm mt-8">
                Não recebeu o e-mail?{' '}
                <button
                  onClick={() => enviarLink()}
                  disabled={loading}
                  className="text-brand-600 font-semibold hover:underline outline-none bg-transparent border-none p-0 cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Reenviando...' : 'Reenviar link'}
                </button>
              </p>
            </div>
          ) : (
            <>
              <div className="mb-10">
                <h2 className="text-2xl lg:text-3xl font-bold text-slate-900">
                  Esqueceu sua senha?
                </h2>
                <p className="text-slate-500 mt-2">
                  Informe o e-mail cadastrado e enviaremos um link para você
                  criar uma nova senha.
                </p>
              </div>

              {erro && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl mb-6">
                  {erro}
                </div>
              )}

              <form onSubmit={enviarLink} className="space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor="email-recuperacao" className="block text-sm font-medium text-slate-700">
                    E-mail
                  </label>
                  <input
                    id="email-recuperacao"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors shadow-sm mt-4 cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Enviando...' : 'Enviar link de redefinição'}
                </button>
              </form>

              <div className="mt-8 text-center">
                <p className="text-slate-600 text-sm">
                  Lembrou a senha?{' '}
                  <button
                    onClick={() => onNavigate('login')}
                    className="text-brand-600 font-semibold hover:underline outline-none bg-transparent border-none p-0 cursor-pointer"
                  >
                    Voltar para o login
                  </button>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
