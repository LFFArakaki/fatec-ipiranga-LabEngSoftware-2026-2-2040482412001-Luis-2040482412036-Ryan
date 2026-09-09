import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Camera,
  Lock,
  Eye,
  EyeOff,
  User,
  MessageSquare,
  Users,
  BarChart2,
  Settings,
} from 'lucide-react'

interface EditarPerfilProps {
  onNavigate: (screen: string) => void;
}

export function EditarPerfil({ onNavigate }: EditarPerfilProps) {
  const [userId, setUserId] = useState<number | string | null>(null)
  const [nome, setNome] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [namePublic, setNamePublic] = useState(true)
  const [whatsappConnected, setWhatsappConnected] = useState(false)
  const [instagramConnected, setInstagramConnected] = useState(false)
  const [facebookConnected, setFacebookConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingExclusao, setLoadingExclusao] = useState(false)
  const [erro, setErro] = useState('')

  const extrairMensagemErro = (dados: any, fallback: string) => {
    if (typeof dados === 'string') return dados;
    if (dados?.detail) {
      if (Array.isArray(dados.detail)) return dados.detail[0]?.msg || fallback;
      if (typeof dados.detail === 'string') return dados.detail;
    }
    return fallback;
  }

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

  useEffect(() => {
    async function carregarPerfil() {
      try {
        const resposta = await fetch('/api/listar/usuarios/', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
        const usuarios = await resposta.json()
        
        if (resposta.ok && Array.isArray(usuarios)) {
          const emailLogado = localStorage.getItem('userEmail')
          const dados = usuarios.find((u: any) => u.email === emailLogado)

          if (dados) {
            const idEncontrado = dados.cod ?? dados.id ?? dados.cod_usuario ?? dados.id_usuario ?? dados.codigo ?? null
            setUserId(idEncontrado)
            
            setNome(dados.nome || '')
            setUsername(dados.nome_usuario || dados.username || '')
            setEmail(dados.email || '')
            setDataNascimento(dados.data_nascimento || '')
            setNamePublic(dados.namePublic ?? true)
            setWhatsappConnected(dados.whatsappConnected ?? false)
            setInstagramConnected(dados.instagramConnected ?? false)
            setFacebookConnected(dados.facebookConnected ?? false)
          } else {
             setErro('Usuário não encontrado. Faça login novamente.')
          }
        }
      } catch (err) {
        console.error('Erro ao buscar dados do perfil:', err)
      }
    }
    carregarPerfil()
  }, [])

  const handleSalvar = async () => {
    if (!userId) {
      setErro('ID do usuário não encontrado. Faça login novamente.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setErro('Por favor, insira um e-mail válido.')
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
      setErro('Você precisa ter pelo menos 18 anos.')
      return
    }

    setLoading(true)
    setErro('')

    try {
      const resposta = await fetch(`/api/atualizar/usuarios/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          nome, 
          nome_usuario: username,
          email, 
          data_nascimento: dataNascimento,
          namePublic,
          whatsappConnected, 
          instagramConnected, 
          facebookConnected
        })
      })

      const textoResposta = await resposta.text()
      const dados = textoResposta ? JSON.parse(textoResposta) : {}

      if (!resposta.ok) {
        throw new Error(extrairMensagemErro(dados, 'Erro ao salvar alterações.'))
      }

      localStorage.setItem('userEmail', email)
      onNavigate('perfil')
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExcluirConta = async () => {
    const confirmar = window.confirm('Tem certeza de que deseja excluir sua conta permanentemente?')
    if (!confirmar) return

    if (!userId) return

    setLoadingExclusao(true)
    setErro('')

    try {
      const resposta = await fetch(`/api/excluir/usuarios/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      const textoResposta = await resposta.text()
      let dados: any = {}
      try { dados = textoResposta ? JSON.parse(textoResposta) : {} } catch { dados = textoResposta }

      if (!resposta.ok) {
        throw new Error(extrairMensagemErro(dados, 'Erro ao excluir conta.'))
      }

      localStorage.removeItem('token')
      localStorage.removeItem('userEmail')
      onNavigate('login')
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setLoadingExclusao(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="flex flex-col h-full lg:hidden">
        <div className="px-4 py-4 flex items-center justify-between bg-white sticky top-0 z-10 border-b border-slate-100">
          <button 
            onClick={() => onNavigate('perfil')}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors cursor-pointer outline-none"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold text-slate-900">Editar Perfil</h1>
          <button 
            onClick={handleSalvar}
            disabled={loading}
            className="text-brand-600 font-semibold hover:text-brand-700 px-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>

        <div className="p-6 space-y-8">
          {erro && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl">
              {erro}
            </div>
          )}

          <div className="flex flex-col items-center">
            <div className="relative mb-3">
              <div className="w-24 h-24 rounded-full bg-slate-200 border-4 border-white shadow-sm flex items-center justify-center text-slate-400">
                <User className="w-12 h-12" />
              </div>
              <button className="absolute bottom-0 right-0 w-8 h-8 bg-brand-500 rounded-full border-2 border-white flex items-center justify-center text-white shadow-sm hover:bg-brand-600 transition-colors cursor-pointer">
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <button className="text-brand-600 text-sm font-medium hover:underline cursor-pointer">
              Alterar foto
            </button>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Nome completo
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Digite seu nome completo"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
              />
            </div>
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Data de nascimento
              </label>
              <input
                type="text"
                value={dataNascimento}
                onChange={handleDataChange}
                placeholder="DD/MM/AAAA"
                maxLength={10}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3 px-1 flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-500" />
              Privacidade
            </h3>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-50 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <span className="font-medium text-slate-900 block">
                      Nome
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      {namePublic ? (
                        <>
                          <Eye className="w-3 h-3" /> Público
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3" /> Privado
                        </>
                      )}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setNamePublic(!namePublic)}
                  className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${namePublic ? 'bg-brand-500' : 'bg-slate-300'}`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${namePublic ? 'right-0.5' : 'left-0.5'}`}
                  ></div>
                </button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3 px-1">
              Redes Sociais
            </h3>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#25D366] rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-xs">WA</span>
                  </div>
                  <span className="font-medium text-slate-900">WhatsApp</span>
                </div>
                <div 
                  onClick={() => setWhatsappConnected(!whatsappConnected)}
                  className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${whatsappConnected ? 'bg-brand-500' : 'bg-slate-300'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${whatsappConnected ? 'right-0.5' : 'left-0.5'}`}></div>
                </div>
              </div>

              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-xs">IG</span>
                  </div>
                  <span className="font-medium text-slate-900">Instagram</span>
                </div>
                <div 
                  onClick={() => setInstagramConnected(!instagramConnected)}
                  className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${instagramConnected ? 'bg-brand-500' : 'bg-slate-300'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${instagramConnected ? 'right-0.5' : 'left-0.5'}`}></div>
                </div>
              </div>

              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#1877F2] rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-xs">FB</span>
                  </div>
                  <span className="font-medium text-slate-900">Facebook</span>
                </div>
                <div 
                  onClick={() => setFacebookConnected(!facebookConnected)}
                  className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${facebookConnected ? 'bg-brand-500' : 'bg-slate-300'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${facebookConnected ? 'right-0.5' : 'left-0.5'}`}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-red-100 shadow-sm">
            <h3 className="text-lg font-bold text-red-600 mb-2">
              Zona de Perigo
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Ao excluir sua conta, todos os seus dados e histórico de
              conversas serão permanentemente removidos.
            </p>
            <button 
              onClick={handleExcluirConta}
              disabled={loadingExclusao}
              className="px-6 py-3 border border-red-200 text-red-600 font-semibold rounded-xl hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50">
              {loadingExclusao ? 'Excluindo...' : 'Excluir Conta'}
            </button>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex h-full overflow-hidden w-full">
        <div className="w-20 bg-slate-900 flex flex-col items-center py-6 border-r border-slate-800 shrink-0 z-20">
          <div className="flex flex-col gap-4 flex-1 w-full px-3">
            <button 
              onClick={() => onNavigate('conversa')}
              className="w-full aspect-square rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            >
              <MessageSquare className="w-6 h-6" />
            </button>
            <button className="w-full aspect-square rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer">
              <Users className="w-6 h-6" />
            </button>
            <button className="w-full aspect-square rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer">
              <BarChart2 className="w-6 h-6" />
            </button>
          </div>

          <div className="flex flex-col gap-4 w-full px-3 mt-auto">
            <button className="w-full aspect-square rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer">
              <Settings className="w-6 h-6" />
            </button>
            <button 
              onClick={() => onNavigate('perfil')}
              className="w-full aspect-square rounded-xl flex items-center justify-center bg-slate-800 border-2 border-brand-500 transition-colors p-0 overflow-hidden cursor-pointer"
            >
              <div className="w-full h-full bg-slate-700 flex items-center justify-center text-slate-300">
                <User className="w-5 h-5" />
              </div>
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden h-full">
          <div className="h-20 px-8 flex items-center justify-between bg-white border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => onNavigate('perfil')}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors cursor-pointer outline-none"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-2xl font-bold text-slate-900">
                Editar Perfil
              </h1>
            </div>
            <button 
              onClick={handleSalvar}
              disabled={loading}
              className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 lg:p-12">
            <div className="max-w-4xl mx-auto space-y-8">
              {erro && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl">
                  {erro}
                </div>
              )}

              <div className="flex flex-col items-center mb-12">
                <div className="relative mb-4">
                  <div className="w-32 h-32 rounded-full bg-slate-200 border-4 border-white shadow-md flex items-center justify-center text-slate-400">
                    <User className="w-16 h-16" />
                  </div>
                  <button className="absolute bottom-0 right-0 w-10 h-10 bg-brand-500 rounded-full border-2 border-white flex items-center justify-center text-white shadow-sm hover:bg-brand-600 transition-colors cursor-pointer">
                    <Camera className="w-5 h-5" />
                  </button>
                </div>
                <button className="text-brand-600 font-medium hover:underline cursor-pointer">
                  Alterar foto
                </button>
              </div>

              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6">
                  Informações Pessoais
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Nome completo
                    </label>
                    <input
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Digite seu nome completo"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                  <div className="space-y-2">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-2">
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
                  <div className="space-y-2">
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
              </div>

              <div className="bg-white p-8 rounded-2xl border border-red-100 shadow-sm">
                <h3 className="text-lg font-bold text-red-600 mb-2">
                  Zona de Perigo
                </h3>
                <p className="text-sm text-slate-500 mb-6">
                  Ao excluir sua conta, todos os seus dados e histórico de
                  conversas serão permanentemente removidos.
                </p>
                <button 
                  onClick={handleExcluirConta}
                  disabled={loadingExclusao}
                  className="px-6 py-3 border border-red-200 text-red-600 font-semibold rounded-xl hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50">
                  {loadingExclusao ? 'Excluindo...' : 'Excluir Conta'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}