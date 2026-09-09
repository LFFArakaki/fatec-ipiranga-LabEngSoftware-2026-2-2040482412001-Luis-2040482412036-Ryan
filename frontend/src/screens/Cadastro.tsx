import { useState } from 'react'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'

interface CadastroProps {
  onNavigate: (screen: string) => void;
}

export function Cadastro({ onNavigate }: CadastroProps) {
  const [nome, setNome] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [termoAceito, setTermoAceito] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const handleDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let valor = e.target.value.replace(/\D/g, '')
    if (valor.length > 8) valor = valor.slice(0, 8)

    if (valor.length > 4) {
      valor = `${valor.slice(0, 2)}/${valor.slice(2, 4)}/${valor.slice(4)}`
    } else if (valor.length > 2) {
      valor = `${valor.slice(0, 2)}/${valor.slice(2)}`
    }

    setDataNascimento(valor)
  }

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')

    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }

    if (dataNascimento.length < 10) {
      setErro('Data de nascimento inválida.')
      return
    }

    const [dia, mes, ano] = dataNascimento.split('/')
    const dataNasc = new Date(Number(ano), Number(mes) - 1, Number(dia))
    const hoje = new Date()
    let idade = hoje.getFullYear() - dataNasc.getFullYear()
    const diffMeses = hoje.getMonth() - dataNasc.getMonth()
    
    if (diffMeses < 0 || (diffMeses === 0 && hoje.getDate() < dataNasc.getDate())) {
      idade--
    }

    if (idade < 18) {
      setErro('Você precisa ter pelo menos 18 anos para se cadastrar.')
      return
    }

    if (!termoAceito) {
      setErro('Você precisa aceitar os termos de uso.')
      return
    }

    setLoading(true)

    try {
      const resposta = await fetch('/api/cadastrar/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nome,
          nome_usuario: username,
          email,
          data_nascimento: dataNascimento,
          senha,
        }),
      })

      const textoResposta = await resposta.text()
      let dados: any = {}
      
      try {
        dados = textoResposta ? JSON.parse(textoResposta) : {}
      } catch {
        dados = { detail: textoResposta } 
      }

      if (!resposta.ok) {
        let msgErro = typeof dados.detail === 'string' ? dados.detail : (dados.mensagem || 'Erro ao realizar o cadastro.')
        if (Array.isArray(dados.detail)) msgErro = dados.detail[0]?.msg || 'Dados inválidos enviados ao servidor.'
        throw new Error(msgErro)
      }

      onNavigate('login')
    } catch (err: any) {
      setErro(err.message || 'Erro de comunicação com o servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-white overflow-hidden">
      <div className="hidden lg:flex w-1/2 bg-slate-900 relative flex-col justify-center items-center p-12 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-25 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500 rounded-full mix-blend-overlay filter blur-[100px]"></div>
        </div>

        <div className="relative z-10 max-w-md text-white">
          <h1 className="text-5xl font-bold mb-8 leading-tight">
            Junte-se a milhares de profissionais
          </h1>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-brand-400 shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold mb-1">
                  Centralize todas as redes sociais
                </h3>
                <p className="text-slate-400">
                  Gerencie WhatsApp, Instagram, Facebook e muito mais em um
                  único painel.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-brand-400 shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold mb-1">
                  Responda mais rápido
                </h3>
                <p className="text-slate-400">
                  Aumente sua produtividade e melhore o tempo de resposta aos
                  seus clientes.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-brand-400 shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold mb-1">
                  Não perca nenhum cliente
                </h3>
                <p className="text-slate-400">
                  Tenha o histórico completo de todas as interações,
                  independente do canal.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex flex-col justify-center p-0 lg:p-12 overflow-y-auto">
        <div className="px-4 py-4 flex items-center sticky top-0 bg-white/80 backdrop-blur-md z-10 lg:hidden">
          <button 
            onClick={() => onNavigate('login')}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors outline-none cursor-pointer">
            <ArrowLeft className="w-6 h-6" />
          </button>
        </div>

        <div className="w-full max-w-xl mx-auto px-6 pb-8 lg:px-0 lg:pb-0">
          <button 
            onClick={() => onNavigate('login')}
            className="hidden lg:inline-flex p-2 -ml-2 mb-6 hover:bg-slate-100 rounded-full text-slate-600 transition-colors outline-none cursor-pointer">
            <ArrowLeft className="w-6 h-6" />
          </button>

          <div className="mb-8 lg:mb-10">
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">
              Crie sua conta
            </h1>
            <p className="text-slate-500 mt-1 lg:mt-2">
              Preencha os dados para começar
            </p>
          </div>

          {erro && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl mb-6">
              {erro}
            </div>
          )}

          <form onSubmit={handleCadastro} className="space-y-4 lg:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
              <div className="space-y-1.5 lg:space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Nome completo
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5 lg:space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Nome de usuário
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="seu_usuario"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
              <div className="space-y-1.5 lg:space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5 lg:space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Data de nascimento
                </label>
                <input
                  type="text"
                  value={dataNascimento}
                  onChange={handleDataChange}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
              <div className="space-y-1.5 lg:space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Senha
                </label>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5 lg:space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Confirmar senha
                </label>
                <input
                  type="password"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="flex items-start gap-3 pt-2 lg:pt-4">
              <input
                type="checkbox"
                id="terms"
                checked={termoAceito}
                onChange={(e) => setTermoAceito(e.target.checked)}
                className="mt-1 w-4 h-4 lg:w-5 lg:h-5 text-brand-500 border-slate-300 rounded focus:ring-brand-500 cursor-pointer"
              />
              <label
                htmlFor="terms"
                className="text-sm text-slate-600 leading-tight lg:leading-relaxed cursor-pointer"
              >
                Eu concordo com os{' '}
                <a
                  href="#"
                  className="text-brand-600 font-medium hover:underline"
                >
                  Termos de Uso
                </a>{' '}
                e{' '}
                <a
                  href="#"
                  className="text-brand-600 font-medium hover:underline"
                >
                  Política de Privacidade
                </a>
              </label>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-3.5 lg:py-4 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors shadow-sm mt-6 lg:mt-8 lg:text-lg cursor-pointer disabled:opacity-50">
              {loading ? 'Criando conta...' : 'Criar Conta'}
            </button>
          </form>

          <div className="mt-8 lg:mt-10 text-center">
            <p className="text-slate-600 text-sm lg:text-base">
              Já tem conta?{' '}
              <button
                onClick={() => onNavigate('login')}
                className="text-brand-600 font-semibold hover:underline outline-none bg-transparent border-none p-0 cursor-pointer"
              >
                Entrar
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}