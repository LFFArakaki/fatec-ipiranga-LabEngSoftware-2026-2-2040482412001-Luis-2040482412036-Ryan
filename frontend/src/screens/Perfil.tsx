import { useState, useEffect } from 'react'
import {
  Edit2,
  Settings,
  Bell,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
  MessageSquare,
  Users,
  ListOrdered,
  User,
} from 'lucide-react'

interface PerfilProps {
  onNavigate: (screen: string) => void;
}

interface PerfilData {
  nome: string;
  username: string;
  conversas: string;
  contatos: string;
  redes: number;
}

export function Perfil({ onNavigate }: PerfilProps) {
  const [perfil, setPerfil] = useState<PerfilData | null>(null)

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
          const usuarioLogado = usuarios.find((u: any) => u.email === emailLogado)

          if (usuarioLogado) {
            let dbUsername = usuarioLogado.nome_usuario || usuarioLogado.username || usuarioLogado.email?.split('@')[0] || 'usuario'
            dbUsername = dbUsername.replace(/^@/, '')

            setPerfil({
              nome: usuarioLogado.nome || 'Usuário',
              username: `@${dbUsername}`,
              conversas: '0',
              contatos: '0',
              redes: 0
            })
          }
        }
      } catch (erro) {
        console.error('Erro ao carregar dados do perfil:', erro)
      }
    }

    carregarPerfil()
  }, [])

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      <div className="flex flex-col h-full w-full overflow-y-auto lg:hidden">
        <div className="px-4 py-4 flex items-center justify-between bg-white sticky top-0 z-10 border-b border-slate-100">
          <div className="w-10"></div>
          <h1 className="text-lg font-bold text-slate-900">Meu Perfil</h1>
          <button 
            onClick={() => onNavigate('editar-perfil')}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors outline-none cursor-pointer"
          >
            <Edit2 className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-white px-6 py-8 flex flex-col items-center border-b border-slate-200">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-brand-100 rounded-full scale-110"></div>
            <div className="relative w-24 h-24 rounded-full bg-slate-200 border-4 border-white shadow-sm flex items-center justify-center text-slate-400">
              <User className="w-12 h-12" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">{perfil?.nome || 'Carregando...'}</h2>
          <p className="text-slate-500 font-medium">{perfil?.username || '@...'}</p>

          <div className="flex w-full justify-between mt-8 pt-6 border-t border-slate-100">
            <div className="text-center flex-1">
              <p className="text-xl font-bold text-slate-900">{perfil?.conversas || '0'}</p>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">
                Conversas
              </p>
            </div>
            <div className="w-px bg-slate-200"></div>
            <div className="text-center flex-1">
              <p className="text-xl font-bold text-slate-900">{perfil?.contatos || '0'}</p>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">
                Contatos
              </p>
            </div>
            <div className="w-px bg-slate-200"></div>
            <div className="text-center flex-1">
              <p className="text-xl font-bold text-slate-900">{perfil?.redes || '0'}</p>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">
                Redes
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            Redes Sociais Conectadas
          </h3>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            <div className="flex flex-col items-center gap-2 min-w-[64px]">
              <div className="w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center shadow-sm">
                <svg
                  className="w-7 h-7 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-slate-700">
                WhatsApp
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border-y border-slate-200 mb-8">
          <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-100">
            <div className="flex items-center gap-3 text-slate-700">
              <Settings className="w-5 h-5 text-slate-400" />
              <span className="font-medium">Configurações de conta</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300" />
          </button>
          <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-100">
            <div className="flex items-center gap-3 text-slate-700">
              <Bell className="w-5 h-5 text-slate-400" />
              <span className="font-medium">Notificações</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300" />
          </button>
          <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-100">
            <div className="flex items-center gap-3 text-slate-700">
              <Shield className="w-5 h-5 text-slate-400" />
              <span className="font-medium">Privacidade</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300" />
          </button>
          <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-100">
            <div className="flex items-center gap-3 text-slate-700">
              <HelpCircle className="w-5 h-5 text-slate-400" />
              <span className="font-medium">Ajuda</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300" />
          </button>
          <button 
            onClick={() => {
              localStorage.removeItem('token')
              localStorage.removeItem('userEmail')
              onNavigate('login')
            }}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-red-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 text-red-600">
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sair</span>
            </div>
          </button>
        </div>
      </div>

      <div className="hidden lg:flex h-full w-full overflow-hidden">
        <div className="w-20 bg-slate-900 flex flex-col items-center py-6 border-r border-slate-800 shrink-0 z-20 h-full">
          <div className="flex flex-col gap-4 flex-1 w-full px-3 pt-2">
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
              <ListOrdered className="w-6 h-6" />
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

        <div className="w-96 bg-white border-r border-slate-200 flex flex-col shrink-0 z-10 h-full overflow-y-auto">
          <div className="p-8 flex flex-col items-center">
            <h1 className="text-2xl font-bold text-slate-900 w-full mb-8">
              Meu Perfil
            </h1>

            <div className="relative mb-6">
              <div className="absolute inset-0 bg-brand-100 rounded-full scale-110"></div>
              <div className="relative w-32 h-32 rounded-full bg-slate-200 border-4 border-white shadow-sm flex items-center justify-center text-slate-400">
                <User className="w-16 h-16" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-slate-900">{perfil?.nome || 'Carregando...'}</h2>
            <p className="text-slate-500 font-medium text-lg">{perfil?.username || '@...'}</p>

            <div className="flex w-full justify-between mt-10 pt-8 border-t border-slate-100">
              <div className="text-center flex-1">
                <p className="text-2xl font-bold text-slate-900">{perfil?.conversas || '0'}</p>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">
                  Conversas
                </p>
              </div>
              <div className="w-px bg-slate-200"></div>
              <div className="text-center flex-1">
                <p className="text-2xl font-bold text-slate-900">{perfil?.contatos || '0'}</p>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">
                  Contatos
                </p>
              </div>
              <div className="w-px bg-slate-200"></div>
              <div className="text-center flex-1">
                <p className="text-2xl font-bold text-slate-900">{perfil?.redes || '0'}</p>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">
                  Redes
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 h-full overflow-y-auto p-12 relative">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-end mb-8">
              <button 
                onClick={() => onNavigate('editar-perfil')}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-colors shadow-sm outline-none cursor-pointer"
              >
                <Edit2 className="w-4 h-4" />
                Editar Perfil
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                <h3 className="text-lg font-bold text-slate-900 mb-6">
                  Redes Sociais Conectadas
                </h3>

                <div className="grid grid-cols-3 gap-6">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-[#25D366] rounded-2xl flex items-center justify-center shadow-sm relative">
                      <svg
                        className="w-8 h-8 text-white"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                      </svg>
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-brand-500 rounded-full border-2 border-white flex items-center justify-center">
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-slate-700">
                      WhatsApp
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900">
                    Conta e Preferências
                  </h3>
                </div>
                <div className="flex flex-col">
                  <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-100 cursor-pointer">
                    <div className="flex items-center gap-4 text-slate-700">
                      <Settings className="w-5 h-5 text-slate-400" />
                      <span className="font-medium">
                        Configurações de conta
                      </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </button>
                  <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-100 cursor-pointer">
                    <div className="flex items-center gap-4 text-slate-700">
                      <Bell className="w-5 h-5 text-slate-400" />
                      <span className="font-medium">Notificações</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </button>
                  <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-100 cursor-pointer">
                    <div className="flex items-center gap-4 text-slate-700">
                      <Shield className="w-5 h-5 text-slate-400" />
                      <span className="font-medium">Privacidade</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </button>
                  <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-100 cursor-pointer">
                    <div className="flex items-center gap-4 text-slate-700">
                      <HelpCircle className="w-5 h-5 text-slate-400" />
                      <span className="font-medium">Ajuda</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </button>
                  <button 
                    onClick={() => {
                      localStorage.removeItem('token')
                      localStorage.removeItem('userEmail')
                      onNavigate('login')
                    }}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4 text-red-600">
                      <LogOut className="w-5 h-5" />
                      <span className="font-medium">Sair</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}