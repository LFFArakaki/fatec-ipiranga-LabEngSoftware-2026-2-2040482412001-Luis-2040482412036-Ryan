import { useState, useEffect, useCallback, useRef } from 'react'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useScreenInit } from './useScreenInit.tsx'
import {
  ApiError,
  MENSAGEM_SESSAO_EXPIRADA,
  definirAoExpirarSessao,
  lerToken,
  limparSessao,
  listarConversas,
  logout,
  mensagemDeErro,
  msAteExpirar,
  obterPerfil,
  sessaoAtiva,
  type Sessao,
} from './api'

import { Login } from './screens/Login'
import { Cadastro } from './screens/Cadastro'
import { EsqueciSenha } from './screens/EsqueciSenha'
import { RedefinirSenha } from './screens/RedefinirSenha'
import { Perfil } from './screens/Perfil'
import { EditarPerfil } from './screens/EditarPerfil'
import { Conversa } from './screens/Conversa'

const TELAS_PUBLICAS = ['login', 'cadastro', 'esqueci-senha', 'redefinir-senha']

function CarregandoSessao({
  erro,
  onTentarNovamente,
  onSair,
}: {
  erro: string;
  onTentarNovamente: () => void;
  onSair: () => void;
}) {
  return (
    <div className="flex flex-1 min-h-screen items-center justify-center bg-slate-50 px-6">
      {erro ? (
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-center">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CircleAlert className="w-6 h-6 text-red-500" />
          </div>
          <p className="text-slate-700 font-medium">{erro}</p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={onSair}
              className="flex-1 py-2.5 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Sair
            </button>
            <button
              onClick={onTentarNovamente}
              className="flex-1 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors shadow-sm cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      ) : (
        <div role="status" className="flex flex-col items-center gap-3 text-slate-500">
          <LoaderCircle className="w-8 h-8 text-brand-500 animate-spin" />
          <span className="text-sm font-medium">Carregando sua conta...</span>
        </div>
      )}
    </div>
  )
}

export function App() {
  const screenInit = useScreenInit()

  const [activeTab, setActiveTab] = useState(() => {
    if (window.location.pathname === '/redefinir-senha') {
      return 'redefinir-senha'
    }

    const telaSalva = localStorage.getItem('telaAtual')

    if (sessaoAtiva()) {
      return telaSalva && !TELAS_PUBLICAS.includes(telaSalva) ? telaSalva : 'perfil'
    }

    return screenInit?.activeTab ?? 'login'
  })
  const [sessao, setSessao] = useState<Sessao | null>(null)
  const [erroSessao, setErroSessao] = useState('')
  const [aviso, setAviso] = useState(() => (lerToken() && !sessaoAtiva() ? MENSAGEM_SESSAO_EXPIRADA : ''))
  const carregandoSessao = useRef(false)

  const handleNavigate = useCallback((novaTela: string) => {
    if (novaTela !== 'login') setAviso('')
    setActiveTab(novaTela)
    localStorage.setItem('telaAtual', novaTela)
  }, [])

  const encerrarSessao = useCallback(
    (mensagem = '') => {
      limparSessao()
      setSessao(null)
      setErroSessao('')
      handleNavigate('login')
      setAviso(mensagem)
    },
    [handleNavigate],
  )

  const carregarSessao = useCallback(async () => {
    const [usuario, conversas] = await Promise.all([obterPerfil(), listarConversas()])
    setSessao({ usuario, conversas })
  }, [])

  const iniciarSessao = useCallback(async () => {
    if (carregandoSessao.current) return
    carregandoSessao.current = true
    try {
      await carregarSessao()
    } catch (erro) {
      if (erro instanceof ApiError && erro.status === 401) return
      if (erro instanceof ApiError && erro.status === 404) {
        encerrarSessao('Sua conta não foi encontrada. Entre novamente.')
        return
      }
      setErroSessao(mensagemDeErro(erro, 'Não foi possível carregar sua conta.'))
    } finally {
      carregandoSessao.current = false
    }
  }, [carregarSessao, encerrarSessao])

  const handleLogin = useCallback(async () => {
    try {
      await carregarSessao()
    } catch (erro) {
      limparSessao()
      throw erro
    }
    handleNavigate('perfil')
  }, [carregarSessao, handleNavigate])

  const handleLogout = useCallback(async () => {
    await logout()
    encerrarSessao()
  }, [encerrarSessao])

  const handleReconectar = useCallback(async () => {
    await logout()
    encerrarSessao('Entre novamente para reconectar seu Telegram automaticamente.')
  }, [encerrarSessao])

  const handleCadastrado = useCallback(() => {
    handleNavigate('login')
    setAviso('Conta criada com sucesso! Faça login para continuar.')
  }, [handleNavigate])

  const handleContaExcluida = useCallback(() => {
    encerrarSessao('Sua conta foi excluída.')
  }, [encerrarSessao])

  useEffect(() => {
    definirAoExpirarSessao(() => encerrarSessao(MENSAGEM_SESSAO_EXPIRADA))
    return () => definirAoExpirarSessao(null)
  }, [encerrarSessao])

  useEffect(() => {
    if (!sessao) return
    const timer = setTimeout(() => encerrarSessao(MENSAGEM_SESSAO_EXPIRADA), msAteExpirar())
    return () => clearTimeout(timer)
  }, [sessao, encerrarSessao])

  const telaProtegida = !TELAS_PUBLICAS.includes(activeTab)

  useEffect(() => {
    if (telaProtegida && !sessao && !erroSessao) {
      iniciarSessao()
    }
  }, [telaProtegida, sessao, erroSessao, iniciarSessao])

  const tentarNovamente = useCallback(() => setErroSessao(''), [])

  const renderScreen = () => {
    switch (activeTab) {
      case 'login': return <Login onNavigate={handleNavigate} onLogin={handleLogin} aviso={aviso} />
      case 'cadastro': return <Cadastro onNavigate={handleNavigate} onCadastrado={handleCadastrado} />
      case 'esqueci-senha': return <EsqueciSenha onNavigate={handleNavigate} />
      case 'redefinir-senha': return <RedefinirSenha onNavigate={handleNavigate} />
    }

    if (!sessao) {
      return <CarregandoSessao erro={erroSessao} onTentarNovamente={tentarNovamente} onSair={handleLogout} />
    }

    switch (activeTab) {
      case 'editar-perfil':
        return (
          <EditarPerfil
            onNavigate={handleNavigate}
            sessao={sessao}
            onSessaoAtualizada={carregarSessao}
            onContaExcluida={handleContaExcluida}
          />
        )
      case 'conversa':
        return (
          <Conversa
            onNavigate={handleNavigate}
            sessao={sessao}
            onAtualizarSessao={carregarSessao}
            onReconectar={handleReconectar}
          />
        )
      default:
        return <Perfil onNavigate={handleNavigate} sessao={sessao} onLogout={handleLogout} />
    }
  }

  return (
    <div className="flex flex-col min-h-screen font-sans bg-slate-50">
      <div className="flex-1 flex flex-col w-full bg-white">
        {renderScreen()}
      </div>
    </div>
  )
}
