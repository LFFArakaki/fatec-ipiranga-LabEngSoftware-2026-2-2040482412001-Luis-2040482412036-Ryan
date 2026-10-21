import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  Mic,
  Send,
  MessageSquare,
  Users,
  Settings,
  Search,
  ListOrdered,
  User,
  RefreshCw,
  LoaderCircle,
  CircleAlert,
  WifiOff,
  X,
} from 'lucide-react'
import {
  ApiError,
  buscarMensagens,
  deletarMensagem,
  editarMensagem,
  enviarMensagem,
  mensagemDeErro,
  type Conversa as ConversaApi,
  type MensagemApi,
  type Sessao,
} from '../api'
import { REDES_SOCIAIS, redeDoApp } from '../redesSociais'
import { BolhaMensagem, type MensagemTela } from '../components/BolhaMensagem'

interface ConversaProps {
  onNavigate: (screen: string) => void;
  sessao: Sessao;
  onAtualizarSessao: () => Promise<void>;
  onReconectar: () => Promise<void>;
}

const TEXTO_MIDIA = '[Mensagem sem texto / Mídia]'
const INTERVALO_ATUALIZACAO_MS = 20_000

function lerDataUtc(data: string): Date | null {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(data)
  if (!partes) return null
  const [dia, mes, ano, hora, minuto] = partes.slice(1).map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia, hora, minuto))
}

function rotuloDoDia(data: Date): string {
  const hoje = new Date()
  const ontem = new Date()
  ontem.setDate(hoje.getDate() - 1)
  if (data.toDateString() === hoje.toDateString()) return 'Hoje'
  if (data.toDateString() === ontem.toDateString()) return 'Ontem'
  return data.toLocaleDateString('pt-BR')
}

const chaveMensagem = (chatId: number, mensagemId: number) => `${chatId}:${mensagemId}`

function Carregando({ texto }: { texto: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-10 text-slate-500">
      <LoaderCircle className="w-7 h-7 text-brand-500 animate-spin" />
      <span className="text-sm font-medium">{texto}</span>
    </div>
  )
}

export function Conversa({ onNavigate, sessao, onAtualizarSessao, onReconectar }: ConversaProps) {
  const { usuario, conversas } = sessao
  const [busca, setBusca] = useState('')
  const [chatAtivoId, setChatAtivoId] = useState<number | null>(null)
  const [mensagens, setMensagens] = useState<MensagemTela[]>([])
  const [message, setMessage] = useState('')

  const [carregandoConversas, setCarregandoConversas] = useState(true)
  const [erroConversas, setErroConversas] = useState('')
  const [carregandoMensagens, setCarregandoMensagens] = useState(false)
  const [erroMensagens, setErroMensagens] = useState('')
  const [telegramDesconectado, setTelegramDesconectado] = useState(false)
  const [erroAcao, setErroAcao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [salvandoId, setSalvandoId] = useState<number | null>(null)
  const [excluindoId, setExcluindoId] = useState<number | null>(null)
  const [reconectando, setReconectando] = useState(false)

  const requisicaoAtual = useRef(0)
  const chatAtivoRef = useRef<number | null>(null)
  const proximoIdTemporario = useRef(-1)
  const editadas = useRef(new Set<string>())
  const areaMobileRef = useRef<HTMLDivElement>(null)
  const areaDesktopRef = useRef<HTMLDivElement>(null)

  const conversaAtiva = conversas.find((conversa) => conversa.chat_id === chatAtivoId) ?? null
  const termoBusca = busca.trim().toLowerCase()
  const conversasFiltradas = conversas.filter((conversa) =>
    conversa.nome_chat.toLowerCase().includes(termoBusca),
  )

  const sincronizarConversas = useCallback(async () => {
    try {
      await onAtualizarSessao()
      setErroConversas('')
    } catch (erro) {
      setErroConversas(mensagemDeErro(erro, 'Não foi possível carregar suas conversas.'))
    } finally {
      setCarregandoConversas(false)
    }
  }, [onAtualizarSessao])

  useEffect(() => {
    sincronizarConversas()
  }, [sincronizarConversas])

  const atualizarConversas = () => {
    setCarregandoConversas(true)
    sincronizarConversas()
  }

  const carregarMensagens = useCallback(
    async (chatId: number, silencioso = false) => {
      if (chatAtivoRef.current !== chatId) return
      const requisicao = ++requisicaoAtual.current
      if (!silencioso) {
        setCarregandoMensagens(true)
        setErroMensagens('')
        setTelegramDesconectado(false)
      }

      try {
        const dados: MensagemApi[] = await buscarMensagens(chatId)
        if (requisicao !== requisicaoAtual.current || chatAtivoRef.current !== chatId) return
        setMensagens(
          dados
            .slice()
            .reverse()
            .map((mensagem) => ({
              id: mensagem.id,
              texto: mensagem.texto,
              data: lerDataUtc(mensagem.data),
              propria: mensagem.remetente === usuario.nome,
              editada: editadas.current.has(chaveMensagem(chatId, mensagem.id)),
            })),
        )
        setErroMensagens('')
        setTelegramDesconectado(false)
      } catch (erro) {
        if (requisicao !== requisicaoAtual.current || silencioso) return
        const texto = mensagemDeErro(erro)
        setTelegramDesconectado(
          erro instanceof ApiError && erro.status === 400 && texto.toLowerCase().includes('não conectado ao telegram'),
        )
        setErroMensagens(texto)
      } finally {
        if (requisicao === requisicaoAtual.current) setCarregandoMensagens(false)
      }
    },
    [usuario.nome],
  )

  const abrirConversa = (conversa: ConversaApi) => {
    if (conversa.chat_id === chatAtivoId) return
    chatAtivoRef.current = conversa.chat_id
    setChatAtivoId(conversa.chat_id)
    setMensagens([])
    setMessage('')
    setEditandoId(null)
    setErroAcao('')
    carregarMensagens(conversa.chat_id)
  }

  const fecharConversa = () => {
    requisicaoAtual.current++
    chatAtivoRef.current = null
    setChatAtivoId(null)
    setMensagens([])
    setEditandoId(null)
    setErroAcao('')
    setErroMensagens('')
    setCarregandoMensagens(false)
  }

  const pausado =
    enviando || editandoId !== null || salvandoId !== null || excluindoId !== null || carregandoMensagens || !!erroMensagens
  useEffect(() => {
    if (chatAtivoId === null || pausado) return
    const timer = setInterval(() => carregarMensagens(chatAtivoId, true), INTERVALO_ATUALIZACAO_MS)
    return () => clearInterval(timer)
  }, [chatAtivoId, pausado, carregarMensagens])

  const ultimoId = mensagens.length ? mensagens[mensagens.length - 1].id : null
  useEffect(() => {
    for (const area of [areaMobileRef.current, areaDesktopRef.current]) {
      if (area) area.scrollTop = area.scrollHeight
    }
  }, [ultimoId, chatAtivoId])

  const handleEnviarMensagem = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const texto = message.trim()
    if (!texto || !conversaAtiva || enviando) return

    const chatId = conversaAtiva.chat_id
    const temporaria: MensagemTela = {
      id: proximoIdTemporario.current--,
      texto,
      data: new Date(),
      propria: true,
      pendente: true,
    }

    setMessage('')
    setErroAcao('')
    setEnviando(true)
    setMensagens((atuais) => [...atuais, temporaria])

    try {
      await enviarMensagem(chatId, { app: conversaAtiva.app, mensagem: texto })
      await carregarMensagens(chatId, true)
      setMensagens((atuais) =>
        atuais.map((mensagem) => (mensagem.id === temporaria.id ? { ...mensagem, pendente: false } : mensagem)),
      )
    } catch (erro) {
      setMensagens((atuais) => atuais.filter((mensagem) => mensagem.id !== temporaria.id))
      if (chatAtivoRef.current === chatId) {
        setMessage((atual) => atual || texto)
        setErroAcao(mensagemDeErro(erro))
      }
    } finally {
      setEnviando(false)
    }
  }

  const handleTeclaCampo = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleEnviarMensagem()
    }
  }

  const salvarEdicao = async (mensagem: MensagemTela, novoTexto: string) => {
    if (!conversaAtiva) return
    const texto = novoTexto.trim()
    if (!texto) return
    if (texto === mensagem.texto) {
      setEditandoId(null)
      return
    }

    const chatId = conversaAtiva.chat_id
    setSalvandoId(mensagem.id)
    setErroAcao('')

    try {
      await editarMensagem(chatId, { app: conversaAtiva.app, message_id: mensagem.id, nova_mensagem: texto })
      editadas.current.add(chaveMensagem(chatId, mensagem.id))
      if (chatAtivoRef.current === chatId) {
        setMensagens((atuais) =>
          atuais.map((atual) => (atual.id === mensagem.id ? { ...atual, texto, editada: true } : atual)),
        )
      }
      setEditandoId(null)
    } catch (erro) {
      setErroAcao(mensagemDeErro(erro))
    } finally {
      setSalvandoId(null)
    }
  }

  const excluirMensagem = async (mensagem: MensagemTela) => {
    if (!conversaAtiva) return
    if (!window.confirm('Excluir esta mensagem para todos na conversa?')) return

    const chatId = conversaAtiva.chat_id
    setExcluindoId(mensagem.id)
    setErroAcao('')

    try {
      await deletarMensagem(chatId, { app: conversaAtiva.app, message_id: mensagem.id })
      if (chatAtivoRef.current === chatId) {
        setMensagens((atuais) => atuais.filter((atual) => atual.id !== mensagem.id))
      }
      setEditandoId((atual) => (atual === mensagem.id ? null : atual))
    } catch (erro) {
      setErroAcao(mensagemDeErro(erro))
    } finally {
      setExcluindoId(null)
    }
  }

  const handleReconectar = async () => {
    setReconectando(true)
    await onReconectar()
  }

  const nomeDoApp = (app: string) => {
    const rede = redeDoApp(app)
    return rede ? REDES_SOCIAIS[rede].nome : app
  }

  const renderListaConversas = () => {
    if (conversas.length === 0) {
      if (carregandoConversas) return <Carregando texto="Carregando conversas..." />
      if (erroConversas) {
        return (
          <div className="p-6 text-center">
            <p className="text-sm text-red-600">{erroConversas}</p>
            <button
              onClick={atualizarConversas}
              className="mt-3 text-sm text-brand-600 font-semibold hover:underline outline-none cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        )
      }
      return (
        <div className="p-6 text-center">
          <p className="text-sm text-slate-500">
            Nenhuma conversa ainda. Conecte seu Telegram para ver suas conversas aqui.
          </p>
          <button
            onClick={() => onNavigate('editar-perfil')}
            className="mt-4 px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            Conectar Telegram
          </button>
        </div>
      )
    }

    return (
      <>
        {erroConversas && (
          <p className="px-4 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">{erroConversas}</p>
        )}
        {conversasFiltradas.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">Nenhuma conversa encontrada.</div>
        ) : (
          conversasFiltradas.map((conversa) => {
            const rede = redeDoApp(conversa.app)
            const infoRede = rede ? REDES_SOCIAIS[rede] : null
            const ativa = conversa.chat_id === chatAtivoId
            return (
              <button
                key={conversa.cod}
                type="button"
                onClick={() => abrirConversa(conversa)}
                className={`w-full text-left p-4 border-b border-slate-100 flex items-center gap-4 cursor-pointer transition-colors outline-none focus-visible:bg-slate-50 ${ativa ? 'bg-brand-50 border-l-4 border-l-brand-500' : 'hover:bg-slate-50'}`}
              >
                <div className="relative w-12 h-12 shrink-0 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                  {conversa.nome_chat.charAt(0).toUpperCase() || '?'}
                  {infoRede && (
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 ${infoRede.cor} rounded-full border-2 border-white flex items-center justify-center`}
                    >
                      <infoRede.Icone className="w-3 h-3 text-white" />
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-slate-900 truncate">{conversa.nome_chat || 'Sem nome'}</h4>
                  <p className="text-sm text-slate-500 truncate">{nomeDoApp(conversa.app)}</p>
                </div>
              </button>
            )
          })
        )}
      </>
    )
  }

  const renderMensagens = (compacta: boolean) => {
    if (!conversaAtiva) {
      return (
        <div className="flex items-center justify-center h-full text-slate-600 text-sm text-center">
          Selecione uma conversa na lista ao lado para ver as mensagens.
        </div>
      )
    }

    if (erroMensagens) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="max-w-sm bg-white/90 backdrop-blur-sm rounded-2xl shadow-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              {telegramDesconectado ? (
                <WifiOff className="w-6 h-6 text-red-500" />
              ) : (
                <CircleAlert className="w-6 h-6 text-red-500" />
              )}
            </div>
            {telegramDesconectado ? (
              <>
                <p className="text-slate-700 text-sm">
                  A sessão do Telegram não está ativa no servidor. Saia e entre de novo para reconectar
                  automaticamente.
                </p>
                <button
                  onClick={handleReconectar}
                  disabled={reconectando}
                  className="mt-4 px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {reconectando ? 'Saindo...' : 'Reconectar'}
                </button>
              </>
            ) : (
              <>
                <p className="text-slate-700 text-sm">{erroMensagens}</p>
                <button
                  onClick={() => carregarMensagens(conversaAtiva.chat_id)}
                  className="mt-4 px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors shadow-sm cursor-pointer"
                >
                  Tentar novamente
                </button>
              </>
            )}
          </div>
        </div>
      )
    }

    if (carregandoMensagens && mensagens.length === 0) {
      return <Carregando texto="Carregando mensagens..." />
    }

    if (mensagens.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-slate-500 text-sm">
          Nenhuma mensagem nesta conversa ainda.
        </div>
      )
    }

    return mensagens.map((mensagem, indice) => {
      const dia = mensagem.data ? rotuloDoDia(mensagem.data) : ''
      const anterior = indice > 0 ? mensagens[indice - 1].data : null
      const mostrarDia = dia && (!anterior || rotuloDoDia(anterior) !== dia)
      const alteravel = mensagem.propria && !mensagem.pendente && mensagem.id > 0

      return (
        <Fragment key={mensagem.id}>
          {mostrarDia && (
            <div className="flex justify-center my-4">
              <div className="bg-white/80 backdrop-blur-sm px-3 py-1 rounded-lg text-xs font-medium text-slate-500 shadow-sm">
                {dia}
              </div>
            </div>
          )}
          <BolhaMensagem
            mensagem={mensagem}
            compacta={compacta}
            podeEditar={alteravel && mensagem.texto !== TEXTO_MIDIA}
            podeExcluir={alteravel}
            editando={editandoId === mensagem.id}
            salvando={salvandoId === mensagem.id}
            excluindo={excluindoId === mensagem.id}
            onIniciarEdicao={() => {
              setErroAcao('')
              setEditandoId(mensagem.id)
            }}
            onCancelarEdicao={() => setEditandoId(null)}
            onSalvarEdicao={(texto) => salvarEdicao(mensagem, texto)}
            onExcluir={() => excluirMensagem(mensagem)}
          />
        </Fragment>
      )
    })
  }

  const renderErroAcao = () =>
    erroAcao && (
      <div
        role="alert"
        className="mx-2 lg:mx-6 mb-2 px-4 py-2.5 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl z-10"
      >
        <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" />
        <span className="flex-1">{erroAcao}</span>
        <button
          type="button"
          onClick={() => setErroAcao('')}
          aria-label="Fechar aviso"
          className="text-red-500 hover:text-red-700 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )

  const botaoAtualizar = (classe: string) => (
    <button
      type="button"
      onClick={() => conversaAtiva && carregarMensagens(conversaAtiva.chat_id)}
      disabled={!conversaAtiva || carregandoMensagens}
      aria-label="Atualizar mensagens"
      title="Atualizar mensagens"
      className={`${classe} hover:bg-slate-100 rounded-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      <RefreshCw className={`w-5 h-5 ${carregandoMensagens ? 'animate-spin' : ''}`} />
    </button>
  )

  return (
    <div className="h-screen w-full bg-[#E5DDD5] overflow-hidden">
      <div className="flex flex-col h-full lg:hidden relative overflow-hidden">
        {conversaAtiva ? (
          <>
            <div
              className="absolute inset-0 opacity-5 pointer-events-none"
              style={{
                backgroundImage:
                  'url("https://www.transparenttextures.com/patterns/cubes.png")',
              }}
            ></div>

            <div className="px-3 py-3 flex items-center justify-between bg-white sticky top-0 z-10 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={fecharConversa}
                  aria-label="Voltar para a lista de conversas"
                  className="p-1.5 -ml-1.5 hover:bg-slate-100 rounded-full text-slate-600 transition-colors cursor-pointer outline-none"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>

                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                      <User className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-slate-900 leading-tight truncate">
                      {conversaAtiva.nome_chat}
                    </h2>
                    <p className="text-xs text-brand-600 font-medium">{nomeDoApp(conversaAtiva.app)}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 text-slate-500 shrink-0">
                {botaoAtualizar('p-2')}
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

            <div ref={areaMobileRef} className="flex-1 overflow-y-auto p-4 space-y-4 relative z-0">
              {renderMensagens(true)}
            </div>

            {renderErroAcao()}

            <form onSubmit={handleEnviarMensagem} className="bg-slate-50 px-2 py-3 flex items-end gap-2 z-10">
              <div className="flex-1 bg-white rounded-3xl flex items-end border border-slate-200 shadow-sm">
                <button type="button" className="p-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                  <Smile className="w-6 h-6" />
                </button>
                <textarea
                  rows={1}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleTeclaCampo}
                  placeholder="Mensagem..."
                  aria-label="Mensagem"
                  className="flex-1 max-h-32 py-3.5 bg-transparent outline-none resize-none text-[15px] text-slate-900 placeholder:text-slate-400"
                  style={{
                    minHeight: '52px',
                  }}
                ></textarea>
                <button type="button" className="p-3 text-slate-400 hover:text-slate-600 transition-colors transform -rotate-45 cursor-pointer">
                  <Paperclip className="w-6 h-6" />
                </button>
              </div>

              <button
                type="submit"
                disabled={enviando}
                aria-label="Enviar mensagem"
                className="w-12 h-12 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-sm hover:bg-brand-600 transition-colors flex-shrink-0 cursor-pointer disabled:opacity-60"
              >
                {enviando ? (
                  <LoaderCircle className="w-5 h-5 animate-spin" />
                ) : message.trim() ? (
                  <Send className="w-5 h-5 ml-1" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-col h-full bg-white">
            <div className="px-3 py-3 flex items-center justify-between bg-white sticky top-0 z-10 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onNavigate('perfil')}
                  aria-label="Voltar para o perfil"
                  className="p-1.5 -ml-1.5 hover:bg-slate-100 rounded-full text-slate-600 transition-colors cursor-pointer outline-none"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-lg font-bold text-slate-900">Conversas</h1>
              </div>
              <button
                type="button"
                onClick={atualizarConversas}
                disabled={carregandoConversas}
                aria-label="Atualizar conversas"
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors cursor-pointer disabled:opacity-40"
              >
                <RefreshCw className={`w-5 h-5 ${carregandoConversas ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar conversa..."
                  aria-label="Buscar conversa"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-transparent focus:bg-white border focus:border-brand-500 focus:ring-2 focus:ring-brand-100 rounded-xl outline-none transition-all text-slate-900 placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">{renderListaConversas()}</div>
          </div>
        )}
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
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">
                Conversas
              </h2>
              <button
                type="button"
                onClick={atualizarConversas}
                disabled={carregandoConversas}
                aria-label="Atualizar conversas"
                title="Atualizar conversas"
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors cursor-pointer disabled:opacity-40"
              >
                <RefreshCw className={`w-5 h-5 ${carregandoConversas ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar conversa..."
                aria-label="Buscar conversa"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-transparent focus:bg-white border focus:border-brand-500 focus:ring-2 focus:ring-brand-100 rounded-xl outline-none transition-all text-slate-900 placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">{renderListaConversas()}</div>
        </div>

        <div className="flex-1 flex flex-col bg-[#E5DDD5] relative h-full min-w-0">
          <div
            className="absolute inset-0 opacity-5 pointer-events-none"
            style={{
              backgroundImage:
                'url("https://www.transparenttextures.com/patterns/cubes.png")',
            }}
          ></div>

          <div className="h-20 px-6 flex items-center justify-between bg-white border-b border-slate-200 z-10 shrink-0">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 shrink-0 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                <User className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900 leading-tight truncate">
                  {conversaAtiva?.nome_chat || 'Selecione um chat'}
                </h2>
                {conversaAtiva && (
                  <p className="text-sm text-brand-600 font-medium">{nomeDoApp(conversaAtiva.app)}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-500 shrink-0">
              {botaoAtualizar('p-2.5')}
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

          <div ref={areaDesktopRef} className="flex-1 overflow-y-auto p-8 space-y-6 relative z-0">
            {renderMensagens(false)}
          </div>

          {renderErroAcao()}

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
                onKeyDown={handleTeclaCampo}
                disabled={!conversaAtiva}
                placeholder={conversaAtiva ? 'Mensagem... (Enter envia, Shift+Enter quebra linha)' : 'Selecione uma conversa'}
                aria-label="Mensagem"
                className="flex-1 max-h-32 py-4 bg-transparent outline-none resize-none text-[15px] text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed"
                style={{
                  minHeight: '56px',
                }}
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={!conversaAtiva || enviando}
              aria-label="Enviar mensagem"
              className="w-14 h-14 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-sm hover:bg-brand-600 transition-colors flex-shrink-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {enviando ? (
                <LoaderCircle className="w-6 h-6 animate-spin" />
              ) : message.trim() ? (
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
