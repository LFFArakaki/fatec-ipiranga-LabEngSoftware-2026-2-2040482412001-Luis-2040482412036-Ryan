import { useState } from 'react'
import {
  ArrowLeft,
  Camera,
  Lock,
  Eye,
  User,
  MessageSquare,
  Users,
  BarChart2,
  Settings,
} from 'lucide-react'
import { ConectarTelegram } from '../components/ConectarTelegram'
import { redesConectadas, removerRedesConectadas } from '../redesSociais'
import { mascararData, validarDadosUsuario } from '../validarUsuario'
import { atualizarUsuario, excluirConta, logout, mensagemDeErro, type Sessao } from '../api'

interface EditarPerfilProps {
  onNavigate: (screen: string) => void;
  sessao: Sessao;
  onSessaoAtualizada: () => Promise<void>;
  onContaExcluida: () => void;
}

const REDES_EM_BREVE = [
  { nome: 'WhatsApp', sigla: 'WA', cor: 'bg-[#25D366]' },
  { nome: 'Instagram', sigla: 'IG', cor: 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]' },
  { nome: 'Facebook', sigla: 'FB', cor: 'bg-[#1877F2]' },
]

function ListaRedesSociais({
  codUsuario,
  telegramConectado,
  onConectado,
}: {
  codUsuario: number;
  telegramConectado: boolean;
  onConectado: () => Promise<void>;
}) {
  return (
    <div className="divide-y divide-slate-100">
      <ConectarTelegram codUsuario={codUsuario} conectado={telegramConectado} onConectado={onConectado} />
      {REDES_EM_BREVE.map((rede) => (
        <div key={rede.nome} className="p-4 lg:px-8 lg:py-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 opacity-60">
            <div className={`w-10 h-10 ${rede.cor} rounded-full flex items-center justify-center`}>
              <span className="text-white font-bold text-xs">{rede.sigla}</span>
            </div>
            <span className="font-medium text-slate-900">{rede.nome}</span>
          </div>
          <span className="px-2.5 py-1 text-xs font-semibold text-slate-500 bg-slate-100 rounded-full">
            Em breve
          </span>
        </div>
      ))}
    </div>
  )
}

export function EditarPerfil({ onNavigate, sessao, onSessaoAtualizada, onContaExcluida }: EditarPerfilProps) {
  const { usuario } = sessao
  const [nome, setNome] = useState(usuario.nome)
  const [username, setUsername] = useState(usuario.nome_usuario)
  const [email, setEmail] = useState(usuario.email)
  const [dataNascimento, setDataNascimento] = useState(usuario.data_nascimento)
  const [loading, setLoading] = useState(false)
  const [loadingExclusao, setLoadingExclusao] = useState(false)
  const [erro, setErro] = useState('')

  const telegramConectado = redesConectadas(sessao.conversas).includes('telegram')

  const handleDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDataNascimento(mascararData(e.target.value))
  }

  const handleSalvar = async () => {
    const dados = {
      nome: nome.trim(),
      nome_usuario: username.trim(),
      email: email.trim(),
      data_nascimento: dataNascimento,
    }

    const erroDados = validarDadosUsuario(dados)
    if (erroDados) {
      setErro(erroDados)
      return
    }

    setLoading(true)
    setErro('')

    try {
      await atualizarUsuario(usuario.cod, dados)
      await onSessaoAtualizada()
      onNavigate('perfil')
    } catch (err) {
      setErro(mensagemDeErro(err))
      setLoading(false)
    }
  }

  const handleExcluirConta = async () => {
    const confirmar = window.confirm('Tem certeza de que deseja excluir sua conta permanentemente?')
    if (!confirmar) return

    setLoadingExclusao(true)
    setErro('')

    try {
      await excluirConta()
      await logout()
      removerRedesConectadas(usuario.cod)
      onContaExcluida()
    } catch (err) {
      setErro(mensagemDeErro(err))
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
                      <Eye className="w-3 h-3" /> Público
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 text-xs font-semibold text-slate-500 bg-slate-100 rounded-full">
                  Em breve
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3 px-1">
              Redes Sociais
            </h3>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <ListaRedesSociais
                codUsuario={usuario.cod}
                telegramConectado={telegramConectado}
                onConectado={onSessaoAtualizada}
              />
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

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-8 pt-8 pb-3">
                  <h3 className="text-lg font-bold text-slate-900">Redes Sociais</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Conecte suas contas para centralizar as conversas em um só lugar.
                  </p>
                </div>
                <ListaRedesSociais
                  codUsuario={usuario.cod}
                  telegramConectado={telegramConectado}
                  onConectado={onSessaoAtualizada}
                />
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