import React, { useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  MailCheck,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react'

interface RedefinirSenhaProps {
  onNavigate: (screen: string) => void;
}

type Etapa = 'email' | 'codigo' | 'nova-senha' | 'sucesso'

const etapas: { id: Etapa; label: string }[] = [
  { id: 'email', label: 'E-mail' },
  { id: 'codigo', label: 'Código' },
  { id: 'nova-senha', label: 'Nova senha' },
]

export function RedefinirSenha({ onNavigate }: RedefinirSenhaProps) {
  const [etapa, setEtapa] = useState<Etapa>('email')
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState(['', '', '', '', '', ''])
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const codigoRefs = useRef<(HTMLInputElement | null)[]>([])

  const indiceEtapa = etapas.findIndex((e) => e.id === etapa)
  const codigoCompleto = codigo.every((d) => d !== '')
  const contemNumero = /\d/.test(senha)
  const tamanhoValido = senha.length >= 8
  const senhasConferem = tamanhoValido && contemNumero && senha === confirmarSenha

  const handleCodigoChange = (indice: number, valor: string) => {
    const digito = valor.replace(/\D/g, '').slice(-1)
    const proximo = [...codigo]
    proximo[indice] = digito
    setCodigo(proximo)
    if (digito && indice < 5) {
      codigoRefs.current[indice + 1]?.focus()
    }
  }

  const handleCodigoKeyDown = (
    indice: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Backspace' && !codigo[indice] && indice > 0) {
      codigoRefs.current[indice - 1]?.focus()
    }
  }

  const solicitarCodigo = async () => {
    if (!email.includes('@')) return
    setLoading(true)
    setErro('')
    try {
      const resposta = await fetch('https://seu-backend.com/api/auth/esqueci-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!resposta.ok) {
        const dados = await resposta.json()
        throw new Error(dados.mensagem || 'Erro ao enviar o código.')
      }
      setEtapa('codigo')
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setLoading(false)
    }
  }

  const validarCodigo = async () => {
    const codigoString = codigo.join('')
    if (codigoString.length < 6) return
    setLoading(true)
    setErro('')
    try {
      const resposta = await fetch('https://seu-backend.com/api/auth/validar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, codigo: codigoString }),
      })
      if (!resposta.ok) {
        const dados = await resposta.json()
        throw new Error(dados.mensagem || 'Código inválido.')
      }
      setEtapa('nova-senha')
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setLoading(false)
    }
  }

  const atualizarSenhaFinal = async () => {
    if (!senhasConferem) return
    setLoading(true)
    setErro('')
    try {
      const resposta = await fetch('https://seu-backend.com/api/auth/redefinir-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, novaSenha: senha }),
      })
      if (!resposta.ok) {
        const dados = await resposta.json()
        throw new Error(dados.mensagem || 'Erro ao redefinir a senha.')
      }
      setEtapa('sucesso')
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setLoading(false)
    }
  }

  const voltar = () => {
    setErro('')
    if (etapa === 'email' || etapa === 'sucesso') onNavigate('login')
    if (etapa === 'codigo') setEtapa('email')
    if (etapa === 'nova-senha') setEtapa('codigo')
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <div className="hidden lg:flex w-1/2 h-full bg-brand-500 relative flex-col justify-center items-center p-12 overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600 rounded-full mix-blend-overlay filter blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-400 rounded-full mix-blend-overlay filter blur-[100px]" />
        </div>

        <div className="relative z-10 max-w-md text-white">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-8 shadow-xl">
            <KeyRound className="w-10 h-10 text-brand-500" />
          </div>
          <h1 className="text-4xl font-bold mb-5 leading-tight">
            Recupere o acesso à sua conta
          </h1>
          <p className="text-brand-100 text-lg leading-relaxed mb-10">
            Enviamos um código de verificação para o seu e-mail. Em poucos
            passos você define uma nova senha e volta a conversar.
          </p>

          <div className="space-y-5 border-t border-white/20 pt-8">
            <div className="flex items-start gap-4">
              <ShieldCheck className="w-6 h-6 text-white shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">Verificação em 2 etapas</h3>
                <p className="text-brand-100 text-sm">
                  Só você recebe o código de confirmação.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <MessageSquare className="w-6 h-6 text-white shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">
                  Suas conversas continuam seguras
                </h3>
                <p className="text-brand-100 text-sm">
                  Nenhuma conexão com suas redes sociais é perdida.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 h-full overflow-y-auto flex flex-col relative">
        <div className="absolute top-0 left-0 w-full px-6 py-6 flex items-center bg-white/80 backdrop-blur-md z-10 lg:bg-transparent lg:backdrop-blur-none">
          <button
            onClick={voltar}
            className="p-2 -ml-2 rounded-full text-slate-600 transition-colors hover:bg-slate-100 outline-none cursor-pointer"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        </div>

        <div className="w-full max-w-md m-auto px-6 py-24 lg:px-12 flex flex-col">
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
              <KeyRound className="w-8 h-8 text-brand-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">CommuniHub</h1>
          </div>

          {etapa !== 'sucesso' && (
            <>
              <div className="flex items-center gap-2 mb-8" aria-hidden="true">
                {etapas.map((item, indice) => (
                  <div key={item.id} className="flex-1">
                    <div
                      className={`h-1.5 rounded-full transition-colors duration-200 ease-out ${indice <= indiceEtapa ? 'bg-brand-500' : 'bg-slate-200'}`}
                    />
                    <span
                      className={`block text-xs font-medium mt-2 ${indice <= indiceEtapa ? 'text-brand-600' : 'text-slate-400'}`}
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-sm font-medium text-slate-500 mb-1">
                Etapa {indiceEtapa + 1} de {etapas.length}
              </p>
            </>
          )}

          {erro && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl mb-4">
              {erro}
            </div>
          )}

          {etapa === 'email' && (
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold text-slate-900">
                Esqueceu sua senha?
              </h2>
              <p className="text-slate-500 mt-2 mb-8">
                Informe o e-mail cadastrado e enviaremos um código de
                verificação para redefinir sua senha.
              </p>

              <div className="space-y-1.5">
                <label
                  htmlFor="email-recuperacao"
                  className="block text-sm font-medium text-slate-700"
                >
                  E-mail
                </label>
                <input
                  id="email-recuperacao"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <button
                onClick={solicitarCodigo}
                disabled={!email.includes('@') || loading}
                className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl transition-colors shadow-sm mt-8 cursor-pointer"
              >
                {loading ? 'Enviando...' : 'Enviar código'}
              </button>

              <p className="text-center text-slate-600 text-sm mt-8">
                Lembrou a senha?{' '}
                <button
                  onClick={() => onNavigate('login')}
                  className="text-brand-600 font-semibold hover:underline outline-none bg-transparent border-none p-0 cursor-pointer"
                >
                  Voltar para o login
                </button>
              </p>
            </div>
          )}

          {etapa === 'codigo' && (
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold text-slate-900">
                Verifique seu e-mail
              </h2>
              <p className="text-slate-500 mt-2 mb-8">
                Enviamos um código de 6 dígitos para{' '}
                <span className="font-semibold text-slate-900">
                  {email || 'seu@email.com'}
                </span>
                .
              </p>

              <div className="flex gap-2 sm:gap-3">
                {codigo.map((digito, indice) => (
                  <input
                    key={indice}
                    ref={(el) => {
                      codigoRefs.current[indice] = el
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digito}
                    onChange={(e) => handleCodigoChange(indice, e.target.value)}
                    onKeyDown={(e) => handleCodigoKeyDown(indice, e)}
                    aria-label={`Dígito ${indice + 1} do código de verificação`}
                    className="w-full aspect-square text-center text-xl font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors text-slate-900"
                  />
                ))}
              </div>

              <button
                onClick={validarCodigo}
                disabled={!codigoCompleto || loading}
                className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl transition-colors shadow-sm mt-8 cursor-pointer"
              >
                {loading ? 'Verificando...' : 'Verificar código'}
              </button>

              <p className="text-center text-slate-600 text-sm mt-8">
                Não recebeu o código?{' '}
                <button 
                  onClick={solicitarCodigo}
                  className="text-brand-600 font-semibold hover:underline outline-none bg-transparent border-none p-0 cursor-pointer"
                >
                  Reenviar
                </button>
              </p>
            </div>
          )}

          {etapa === 'nova-senha' && (
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold text-slate-900">
                Crie uma nova senha
              </h2>
              <p className="text-slate-500 mt-2 mb-8">
                Sua nova senha precisa ter pelo menos 8 caracteres e conter pelo menos um número.
              </p>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="nova-senha"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Nova senha
                  </label>
                  <div className="relative">
                    <input
                      id="nova-senha"
                      type={mostrarSenha ? 'text' : 'password'}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-4 pr-12 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors text-slate-900 placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha(!mostrarSenha)}
                      aria-label={
                        mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'
                      }
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 outline-none cursor-pointer"
                    >
                      {mostrarSenha ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="confirmar-nova-senha"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Confirmar nova senha
                  </label>
                  <input
                    id="confirmar-nova-senha"
                    type={mostrarSenha ? 'text' : 'password'}
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors text-slate-900 placeholder:text-slate-400"
                  />
                  {confirmarSenha.length > 0 && senha !== confirmarSenha && (
                    <p className="text-sm text-red-600 pt-1">
                      As senhas não coincidem.
                    </p>
                  )}
                </div>

                <ul className="space-y-2 pt-1">
                  <li className="flex items-center gap-2 text-sm">
                    <Check
                      className={`w-4 h-4 ${tamanhoValido ? 'text-brand-600' : 'text-slate-300'}`}
                    />
                    <span
                      className={
                        tamanhoValido ? 'text-slate-700' : 'text-slate-400'
                      }
                    >
                      Pelo menos 8 caracteres
                    </span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check
                      className={`w-4 h-4 ${contemNumero ? 'text-brand-600' : 'text-slate-300'}`}
                    />
                    <span
                      className={
                        contemNumero ? 'text-slate-700' : 'text-slate-400'
                      }
                    >
                      Contém ao menos um número
                    </span>
                  </li>
                </ul>
              </div>

              <button
                onClick={atualizarSenhaFinal}
                disabled={!senhasConferem || loading}
                className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl transition-colors shadow-sm mt-8 cursor-pointer"
              >
                {loading ? 'Salvando...' : 'Redefinir senha'}
              </button>
            </div>
          )}

          {etapa === 'sucesso' && (
            <div className="text-center">
              <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <MailCheck className="w-10 h-10 text-brand-500" />
              </div>
              <h2 className="text-2xl lg:text-3xl font-bold text-slate-900">
                Senha redefinida!
              </h2>
              <p className="text-slate-500 mt-3 mb-8">
                Sua senha foi atualizada com sucesso. Agora é só entrar na sua
                conta e continuar de onde parou.
              </p>
              <button 
                onClick={() => onNavigate('login')}
                className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                Ir para o login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}