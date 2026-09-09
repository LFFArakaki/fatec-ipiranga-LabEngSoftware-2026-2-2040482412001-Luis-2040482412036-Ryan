import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  Mic,
  Send,
  CheckCheck,
  ImageIcon,
  MessageSquare,
  Users,
  Settings,
  Search,
  ListOrdered,
  User,
} from 'lucide-react'

interface ConversaProps {
  onNavigate: (screen: string) => void;
}

interface Contato {
  id: string;
  nome: string;
  avatar: string;
  ultimaMensagem: string;
  horario: string;
  naoLidas?: number;
  rede: 'whatsapp' | 'instagram' | 'telegram' | 'facebook';
}

interface Mensagem {
  id: string;
  remetente: 'usuario' | 'cliente';
  texto: string;
  horario: string;
  tipo?: 'texto' | 'imagem';
}

export function Conversa({ onNavigate }: ConversaProps) {
  const [message, setMessage] = useState('')
  const [conversas, setConversas] = useState<Contato[]>([])
  const [contatoAtivo, setContatoAtivo] = useState<Contato | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])

  useEffect(() => {
    async function carregarConversas() {
      try {
        const resposta = await fetch('https://seu-backend.com/api/conversas', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
        const dados = await resposta.json()
        if (resposta.ok) {
          setConversas(dados)
          if (dados.length > 0) {
            setContatoAtivo(dados[0])
          }
        }
      } catch (erro) {
        console.error('Erro ao buscar conversas:', erro)
      }
    }
    carregarConversas()
  }, [])

  useEffect(() => {
    if (!contatoAtivo) return

    async function carregarMensagens() {
      try {
        const resposta = await fetch(`https://seu-backend.com/api/conversas/${contatoAtivo?.id}/mensagens`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
        const dados = await resposta.json()
        if (resposta.ok) {
          setMensagens(dados)
        }
      } catch (erro) {
        console.error('Erro ao buscar mensagens:', erro)
      }
    }
    carregarMensagens()
  }, [contatoAtivo])

  const handleEnviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || !contatoAtivo) return

    const textoAtual = message
    setMessage('')

    try {
      const resposta = await fetch('https://seu-backend.com/api/mensagens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          contatoId: contatoAtivo.id,
          texto: textoAtual
        })
      })

      const novaMensagem = await resposta.json()
      if (resposta.ok) {
        setMensagens((prev) => [...prev, novaMensagem])
      }
    } catch (erro) {
      console.error('Erro ao enviar mensagem:', erro)
    }
  }

  return (
    <div className="h-screen w-full bg-[#E5DDD5] overflow-hidden">
      <div className="flex flex-col h-full lg:hidden relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage:
              'url("https://www.transparenttextures.com/patterns/cubes.png")',
          }}
        ></div>

        <div className="px-3 py-3 flex items-center justify-between bg-white sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onNavigate('perfil')}
              className="p-1.5 -ml-1.5 hover:bg-slate-100 rounded-full text-slate-600 transition-colors cursor-pointer outline-none"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                  <User className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 leading-tight">
                  {contatoAtivo?.nome || 'Selecione uma conversa'}
                </h2>
                <p className="text-xs text-brand-600 font-medium">online</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-slate-500">
            <button className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
              <Video className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
              <Phone className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-0">
          <div className="flex justify-center my-4">
            <div className="bg-white/80 backdrop-blur-sm px-3 py-1 rounded-lg text-xs font-medium text-slate-500 shadow-sm">
              Hoje
            </div>
          </div>

          {mensagens.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
              Nenhuma mensagem encontrada.
            </div>
          ) : (
            mensagens.map((msg) => (
              <div key={msg.id} className={`flex ${msg.remetente === 'usuario' ? 'justify-end' : 'justify-start'}`}>
                <div className={`${msg.remetente === 'usuario' ? 'bg-brand-500 text-white rounded-tr-sm' : 'bg-white text-slate-800 rounded-tl-sm'} px-4 py-2.5 rounded-2xl max-w-[85%] shadow-sm relative`}>
                  <p className="text-[15px] leading-snug">{msg.texto}</p>
                  <div className={`text-[10px] text-right mt-1 font-medium ${msg.remetente === 'usuario' ? 'text-brand-100' : 'text-slate-400'}`}>
                    {msg.horario}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleEnviarMensagem} className="bg-slate-50 px-2 py-3 flex items-end gap-2 z-10">
          <div className="flex-1 bg-white rounded-3xl flex items-end border border-slate-200 shadow-sm">
            <button type="button" className="p-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
              <Smile className="w-6 h-6" />
            </button>
            <textarea
              rows={1}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Mensagem..."
              className="flex-1 max-h-32 py-3.5 bg-transparent outline-none resize-none text-[15px] text-slate-900 placeholder:text-slate-400"
              style={{
                minHeight: '52px',
              }}
            ></textarea>
            <button type="button" className="p-3 text-slate-400 hover:text-slate-600 transition-colors transform -rotate-45 cursor-pointer">
              <Paperclip className="w-6 h-6" />
            </button>
          </div>

          <button type="submit" className="w-12 h-12 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-sm hover:bg-brand-600 transition-colors flex-shrink-0 cursor-pointer">
            {message.trim() ? (
              <Send className="w-5 h-5 ml-1" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>
        </form>
      </div>

      <div className="hidden lg:flex h-full overflow-hidden w-full">
        <div className="w-20 bg-slate-900 flex flex-col items-center py-6 border-r border-slate-800 shrink-0 z-20 h-full">
          <div className="flex flex-col gap-4 flex-1 w-full px-3 pt-2">
            <button className="w-full aspect-square rounded-xl flex items-center justify-center bg-slate-800 text-white transition-colors cursor-pointer">
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
              className="w-full aspect-square rounded-xl flex items-center justify-center border-2 border-transparent hover:border-slate-700 transition-colors p-0 overflow-hidden cursor-pointer"
            >
              <div className="w-full h-full bg-slate-700 flex items-center justify-center text-slate-300">
                <User className="w-5 h-5" />
              </div>
            </button>
          </div>
        </div>

        <div className="w-96 bg-white border-r border-slate-200 flex flex-col shrink-0 z-10 h-full">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              Conversas
            </h2>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar conversa..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-transparent focus:bg-white border focus:border-brand-500 focus:ring-2 focus:ring-brand-100 rounded-xl outline-none transition-all text-slate-900 placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversas.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">
                Nenhuma conversa encontrada.
              </div>
            ) : (
              conversas.map((c) => (
                <div 
                  key={c.id} 
                  onClick={() => setContatoAtivo(c)}
                  className={`p-4 border-b border-slate-100 flex items-start gap-4 cursor-pointer transition-colors ${contatoAtivo?.id === c.id ? 'bg-brand-50 border-l-4 border-brand-500' : 'hover:bg-slate-50'}`}
                >
                  <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                    {c.nome.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className="font-semibold text-slate-900 truncate">
                        {c.nome}
                      </h4>
                      <span className="text-xs font-medium text-brand-600">
                        {c.horario}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 truncate">
                      {c.ultimaMensagem}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-[#E5DDD5] relative h-full">
          <div
            className="absolute inset-0 opacity-5 pointer-events-none"
            style={{
              backgroundImage:
                'url("https://www.transparenttextures.com/patterns/cubes.png")',
            }}
          ></div>

          <div className="h-20 px-6 flex items-center justify-between bg-white border-b border-slate-200 z-10 shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 leading-tight">
                  {contatoAtivo?.nome || 'Selecione um chat'}
                </h2>
                <p className="text-sm text-brand-600 font-medium">online</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <button className="p-2.5 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
                <Video className="w-5 h-5" />
              </button>
              <button className="p-2.5 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
                <Phone className="w-5 h-5" />
              </button>
              <div className="w-px h-6 bg-slate-200 mx-1"></div>
              <button className="p-2.5 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
                <Search className="w-5 h-5" />
              </button>
              <button className="p-2.5 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-6 relative z-0">
            <div className="flex justify-center my-6">
              <div className="bg-white/80 backdrop-blur-sm px-4 py-1.5 rounded-lg text-xs font-medium text-slate-500 shadow-sm">
                Hoje
              </div>
            </div>

            {mensagens.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-600 text-sm">
                Inicie uma conversa ou selecione um contato na lista ao lado.
              </div>
            ) : (
              mensagens.map((msg) => (
                <div key={msg.id} className={`flex ${msg.remetente === 'usuario' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`${msg.remetente === 'usuario' ? 'bg-brand-500 text-white rounded-tr-sm' : 'bg-white text-slate-800 rounded-tl-sm'} px-5 py-3 rounded-2xl max-w-[70%] shadow-sm relative`}>
                    <p className="text-[15px] leading-relaxed">{msg.texto}</p>
                    <div className={`text-[10px] text-right mt-1 font-medium ${msg.remetente === 'usuario' ? 'text-brand-100' : 'text-slate-400'}`}>
                      {msg.horario}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleEnviarMensagem} className="bg-slate-50 px-6 py-4 flex items-end gap-4 z-10 shrink-0">
            <div className="flex-1 bg-white rounded-3xl flex items-end border border-slate-200 shadow-sm">
              <button type="button" className="p-4 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                <Smile className="w-6 h-6" />
              </button>
              <button type="button" className="p-4 text-slate-400 hover:text-slate-600 transition-colors transform -rotate-45 cursor-pointer">
                <Paperclip className="w-6 h-6" />
              </button>
              <textarea
                rows={1}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Mensagem..."
                className="flex-1 max-h-32 py-4 bg-transparent outline-none resize-none text-[15px] text-slate-900 placeholder:text-slate-400"
                style={{
                  minHeight: '56px',
                }}
              ></textarea>
            </div>

            <button type="submit" className="w-14 h-14 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-sm hover:bg-brand-600 transition-colors flex-shrink-0 cursor-pointer">
              {message.trim() ? (
                <Send className="w-6 h-6 ml-1" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}