import { useState, useEffect } from 'react'
import { useScreenInit } from './useScreenInit.tsx'

import { Login } from './screens/Login'
import { Cadastro } from './screens/Cadastro'
import { EsqueciSenha } from './screens/EsqueciSenha'
import { RedefinirSenha } from './screens/RedefinirSenha'
import { Perfil } from './screens/Perfil'
import { EditarPerfil } from './screens/EditarPerfil'
import { Conversa } from './screens/Conversa'

const TELAS_PUBLICAS = ['login', 'cadastro', 'esqueci-senha', 'redefinir-senha']

export function App() {
  const screenInit = useScreenInit()

  const [activeTab, setActiveTab] = useState(() => {
    if (window.location.pathname === '/redefinir-senha') {
      return 'redefinir-senha'
    }

    const telaSalva = localStorage.getItem('telaAtual')
    const token = localStorage.getItem('token')

    if (token && telaSalva && !TELAS_PUBLICAS.includes(telaSalva)) {
      return telaSalva
    }
    
    if (token) {
      return 'perfil'
    }
    
    return screenInit?.activeTab ?? 'login'
  })

  const handleNavigate = (novaTela: string) => {
    setActiveTab(novaTela)
    localStorage.setItem('telaAtual', novaTela)
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token && !TELAS_PUBLICAS.includes(activeTab)) {
      handleNavigate('login')
    }
  }, [activeTab])

  const renderScreen = () => {
    switch (activeTab) {
      case 'login': return <Login onNavigate={handleNavigate} />
      case 'cadastro': return <Cadastro onNavigate={handleNavigate} />
      case 'esqueci-senha': return <EsqueciSenha onNavigate={handleNavigate} />
      case 'redefinir-senha': return <RedefinirSenha onNavigate={handleNavigate} />
      case 'perfil': return <Perfil onNavigate={handleNavigate} />
      case 'editar-perfil': return <EditarPerfil onNavigate={handleNavigate} />
      case 'conversa': return <Conversa onNavigate={handleNavigate} />
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