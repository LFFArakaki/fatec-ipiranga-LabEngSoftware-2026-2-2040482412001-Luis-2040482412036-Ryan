import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Check, CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react'
import { REGRAS_SENHA, senhaValida } from '../validarSenha'
import { extrairMensagemErro, lerResposta } from '../api'

interface RedefinirSenhaProps {
  onNavigate: (screen: string) => void;
}

const SEGUNDOS_ATE_REDIRECIONAR = 5

export function RedefinirSenha({ onNavigate }: RedefinirSenhaProps) {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token'))
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [redefinida, setRedefinida] = useState(false)
  const [segundos, setSegundos] = useState(SEGUNDOS_ATE_REDIRECIONAR)

  const senhasConferem = senha === confirmarSenha
  const podeConfirmar = senhaValida(senha) && senhasConferem && !loading

  // A tela é aberta pelo link do e-mail (/redefinir-senha?token=...); ao sair, a URL volta para a raiz.
  const navegar = useCallback(
    (tela: string) => {
      window.history.replaceState(null, '', '/')
      onNavigate(tela)
    },
    [onNavigate],
  )

  useEffect(() => {
    if (!redefinida) return
    if (segundos === 0) {
      navegar('login')
      return
    }
    const timer = setTimeout(() => setSegundos((atual) => atual - 1), 1000)
    return () => clearTimeout(timer)
  }, [redefinida, segundos, navegar])

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      const resposta = await fetch('/api/auth/redefinir-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nova_senha: senha }),
      })

      if (!resposta.ok) {
        throw new Error(
          extrairMensagemErro(
            await lerResposta(resposta),
            'Não foi possível redefinir a senha. O link pode ter expirado.',
          ),
        )
      }

      setRedefinida(true)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro de conexão com o servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <div className="hidden lg:flex w-1/2 h-full bg-slate-900 relative flex-col justify-center items-center p-12 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-25 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500 rounded-full mix-blend-overlay filter blur-[100px]"></div>
        </div>

        <div className="relative z-10 max-w-md text-white">
          <h1 className="text-5xl font-bold mb-8 leading-tight">
            Crie uma nova senha
          </h1>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-brand-400 shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold mb-1">Proteja sua conta</h3>
                <p className="text-slate-400">
                  Use uma senha forte que você não utilize em outros serviços.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-brand-400 shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold mb-1">Suas redes continuam conectadas</h3>
                <p className="text-slate-400">
                  Trocar a senha não desconecta nenhuma das suas redes sociais.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-brand-400 shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold mb-1">Volte a atender rapidamente</h3>
                <p className="text-slate-400">
                  Assim que confirmar, você será levado direto para o login.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 h-full overflow-y-auto flex flex-col relative">
        {!redefinida && (
          <div className="px-4 py-4 flex items-center sticky top-0 bg-white/80 backdrop-blur-md z-10 lg:hidden">
            <button
              onClick={() => navegar('login')}
              aria-label="Voltar para o login"
              className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors outline-none cursor-pointer"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          </div>
        )}

        <div className="w-full max-w-md m-auto px-6 pb-12 lg:py-12 flex flex-col">
          {redefinida ? (
            <div className="text-center" role="status" aria-live="polite">
              <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-brand-500" />
              </div>
              <h2 className="text-2xl lg:text-3xl font-bold text-slate-900">
                Senha redefinida!
              </h2>
              <p className="text-slate-600 mt-3 mb-6">
                Sua senha foi redefinida com sucesso. Você será redirecionado
                para a página de login em{' '}
                <span className="font-semibold text-slate-900">
                  {segundos} {segundos === 1 ? 'segundo' : 'segundos'}
                </span>
                .
              </p>

              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-8">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(segundos / SEGUNDOS_ATE_REDIRECIONAR) * 100}%` }}
                />
              </div>

              <button
                onClick={() => navegar('login')}
                className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                Ir para o login agora
              </button>
            </div>
          ) : !token ? (
            <div className="text-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <KeyRound className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl lg:text-3xl font-bold text-slate-900">
                Link inválido
              </h2>
              <p className="text-slate-500 mt-3 mb-8">
                Este link de redefinição de senha é inválido ou está incompleto.
                Solicite um novo link para continuar.
              </p>
              <button
                onClick={() => navegar('esqueci-senha')}
                className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                Solicitar novo link
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => navegar('login')}
                aria-label="Voltar para o login"
                className="hidden lg:inline-flex self-start p-2 -ml-2 mb-6 hover:bg-slate-100 rounded-full text-slate-600 transition-colors outline-none cursor-pointer"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>

              <div className="mb-8 lg:mb-10">
                <h2 className="text-2xl lg:text-3xl font-bold text-slate-900">
                  Redefinir senha
                </h2>
                <p className="text-slate-500 mt-1 lg:mt-2">
                  Digite e confirme sua nova senha
                </p>
              </div>

              {erro && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl mb-6">
                  {erro}
                </div>
              )}

              <form onSubmit={handleConfirmar} className="space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor="nova-senha" className="block text-sm font-medium text-slate-700">
                    Nova senha
                  </label>
                  <div className="relative">
                    <input
                      id="nova-senha"
                      type={mostrarSenha ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-4 pr-12 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha(!mostrarSenha)}
                      aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 outline-none cursor-pointer"
                    >
                      {mostrarSenha ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="confirmar-nova-senha" className="block text-sm font-medium text-slate-700">
                    Confirmar nova senha
                  </label>
                  <input
                    id="confirmar-nova-senha"
                    type={mostrarSenha ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                  />
                  {confirmarSenha.length > 0 && !senhasConferem && (
                    <p className="text-sm text-red-600 pt-1">As senhas não coincidem.</p>
                  )}
                </div>

                <ul className="space-y-2 pt-1">
                  {REGRAS_SENHA.map((regra) => {
                    const atendida = regra.valida(senha)
                    return (
                      <li key={regra.descricao} className="flex items-center gap-2 text-sm">
                        <Check className={`w-4 h-4 ${atendida ? 'text-brand-600' : 'text-slate-300'}`} />
                        <span className={atendida ? 'text-slate-700' : 'text-slate-400'}>
                          {regra.descricao}
                        </span>
                      </li>
                    )
                  })}
                </ul>

                <button
                  type="submit"
                  disabled={!podeConfirmar}
                  className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl transition-colors shadow-sm mt-4 cursor-pointer disabled:cursor-not-allowed"
                >
                  {loading ? 'Confirmando...' : 'Confirmar'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
