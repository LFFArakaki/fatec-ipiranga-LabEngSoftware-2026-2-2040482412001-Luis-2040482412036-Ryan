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
  buscarMensagens,
  deletarMensagem,
  editarMensagem,
  enviarMensagem,
  listarConversasPorApp,
  mensagemDeErro,
  sessaoDoAppAusente,
  type Conversa as ConversaApi,
  type MensagemApi,
  type Sessao,
} from '../api'
import { REDES_SOCIAIS, redeDoApp, redesConectadas, type RedeSocial } from '../redesSociais'
import { BolhaMensagem, type MensagemTela } from '../components/BolhaMensagem'

interface ConversaProps {
  onNavigate: (screen: string) => void;
  sessao: Sessao;
  /** Busca conversas novas no servidor (GET /busca-conversas/) e recarrega a lista. */
  onSincronizarConversas: () => Promise<ConversaApi[]>;
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

const chaveConversa = (conversa: ConversaApi) => `${conversa.app.toLowerCase()}:${conversa.chat_id}`
const chaveEdicao = (chatId: string, mensagemId: number) => `${chatId}:${mensagemId}`

/** Converte a resposta de GET /perfil/conversa/{chat_id} para a ordem cronológica da tela. */
function paraMensagensTela(
  dados: MensagemApi[],
  conversa: ConversaApi,
  nomeUsuario: string,
  editadas: Set<string>,
): MensagemTela[] {
  // O Telegram devolve da mais nova para a mais antiga; o Signal já vem em ordem de chegada.
  const cronologicas = redeDoApp(conversa.app) === 'telegram' ? dados.slice().reverse() : dados
  return cronologicas.map((mensagem, posicao) => {
    const id = typeof mensagem.id === 'number' ? mensagem.id : null
    return {
      chave: id === null ? `posicao:${posicao}` : `id:${id}`,
      id,
      texto: mensagem.texto || TEXTO_MIDIA,
      remetente: mensagem.remetente ?? '',
      data: lerDataUtc(mensagem.data),
      propria: mensagem.remetente === nomeUsuario,
      editada: id !== null && editadas.has(chaveEdicao(conversa.chat_id, id)),
    }
  })
}

const classeFiltro = (ativo: boolean) =>
  `shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
    ativo ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
  }`

function Carregando({ texto }: { texto: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-10 text-slate-500">
      <LoaderCircle className="w-7 h-7 text-brand-500 animate-spin" />
      <span className="text-sm font-medium">{texto}</span>
    </div>
  )
}

export function Conversa({ onNavigate, sessao, onSincronizarConversas, onReconectar }: ConversaProps) {
  const { usuario, conversas } = sessao
  const [busca, setBusca] = useState('')
  const [filtroApp, setFiltroApp] = useState<RedeSocial | null>(null)
  const [conversasDoApp, setConversasDoApp] = useState<{ rede: RedeSocial; lista: ConversaApi[] } | null>(null)
  const [falhaFiltro, setFalhaFiltro] = useState<{ rede: RedeSocial; mensagem: string } | null>(null)
  const [tentativaFiltro, setTentativaFiltro] = useState(0)
  const [conversaAtiva, setConversaAtiva] = useState<ConversaApi | null>(null)
  const [mensagens, setMensagens] = useState<MensagemTela[]>([])
  const [message, setMessage] = useState('')

  const [carregandoConversas, setCarregandoConversas] = useState(true)
  const [erroConversas, setErroConversas] = useState('')
  const [carregandoMensagens, setCarregandoMensagens] = useState(false)
  const [erroMensagens, setErroMensagens] = useState('')
  const [appDesconectado, setAppDesconectado] = useState(false)
  const [erroAcao, setErroAcao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [salvandoId, setSalvandoId] = useState<number | null>(null)
  const [excluindoId, setExcluindoId] = useState<number | null>(null)
  const [reconectando, setReconectando] = useState(false)

  const requisicaoAtual = useRef(0)
  const conversaAtivaRef = useRef<string | null>(null)
  const contadorPendentes = useRef(0)
  const editadas = useRef(new Set<string>())
  const areaMobileRef = useRef<HTMLDivElement>(null)
  const areaDesktopRef = useRef<HTMLDivElement>(null)

  const redes = redesConectadas(conversas)
  const filtroAtivo = filtroApp && redes.includes(filtroApp) ? filtroApp : null
  const listaDoFiltro = filtroAtivo && conversasDoApp?.rede === filtroAtivo ? conversasDoApp.lista : null
  const erroFiltro = filtroAtivo && falhaFiltro?.rede === filtroAtivo ? falhaFiltro.mensagem : ''
  const conversasVisiveis = filtroAtivo ? (listaDoFiltro ?? []) : conversas
  const termoBusca = busca.trim().toLowerCase()
  const conversasFiltradas = conversasVisiveis.filter((conversa) =>
    conversa.nome_chat.toLowerCase().includes(termoBusca),
  )
  const chaveAtiva = conversaAtiva ? chaveConversa(conversaAtiva) : null

  const sincronizarLista = useCallback(async () => {
    try {
      await onSincronizarConversas()
      setErroConversas('')
    } catch (erro) {
      setErroConversas(mensagemDeErro(erro, 'Não foi possível atualizar suas conversas.'))
    } finally {
      setCarregandoConversas(false)
    }
  }, [onSincronizarConversas])

  useEffect(() => {
    sincronizarLista()
  }, [sincronizarLista])

  const atualizarConversas = () => {
    setCarregandoConversas(true)
    sincronizarLista()
  }

  // Filtro por aplicativo: GET /perfil/conversas/{app}, refeito quando a lista da sessão muda.
  useEffect(() => {
    if (!filtroAtivo) return
    let cancelado = false
    listarConversasPorApp(REDES_SOCIAIS[filtroAtivo].nome)
      .then((lista) => {
        if (cancelado) return
        setConversasDoApp({ rede: filtroAtivo, lista })
        setFalhaFiltro(null)
      })
      .catch((erro) => {
        if (cancelado) return
        setFalhaFiltro({ rede: filtroAtivo, mensagem: mensagemDeErro(erro, 'Não foi possível filtrar as conversas.') })
      })
    return () => {
      cancelado = true
    }
  }, [filtroAtivo, conversas, tentativaFiltro])

  const carregarMensagens = useCallback(
    async (conversa: ConversaApi, silencioso = false) => {
      const chave = chaveConversa(conversa)
      if (conversaAtivaRef.current !== chave) return
      const requisicao = ++requisicaoAtual.current
      if (!silencioso) {
        setCarregandoMensagens(true)
        setErroMensagens('')
        setAppDesconectado(false)
      }

      try {
        const dados = await buscarMensagens(conversa.chat_id)
        if (requisicao !== requisicaoAtual.current || conversaAtivaRef.current !== chave) return
        setMensagens(paraMensagensTela(dados, conversa, usuario.nome, editadas.current))
        setErroMensagens('')
        setAppDesconectado(false)
      } catch (erro) {
        if (requisicao !== requisicaoAtual.current) return
        const desconectado = sessaoDoAppAusente(erro, usuario.cod)
        if (silencioso && !desconectado) return
        setAppDesconectado(desconectado)
        setErroMensagens(mensagemDeErro(erro))
      } finally {
        if (requisicao === requisicaoAtual.current) setCarregandoMensagens(false)
      }
    },
    [usuario.nome, usuario.cod],
  )

  const abrirConversa = (conversa: ConversaApi) => {
    const chave = chaveConversa(conversa)
    if (chave === conversaAtivaRef.current) return
    conversaAtivaRef.current = chave
    setConversaAtiva(conversa)
    setMensagens([])
    setMessage('')
    setEditandoId(null)
    setErroAcao('')
    carregarMensagens(conversa)
  }

  const fecharConversa = () => {
    requisicaoAtual.current++
    conversaAtivaRef.current = null
    setConversaAtiva(null)
    setMensagens([])
    setEditandoId(null)
    setErroAcao('')
    setErroMensagens('')
    setAppDesconectado(false)
    setCarregandoMensagens(false)
  }

  const pausado =
    enviando || editandoId !== null || salvandoId !== null || excluindoId !== null || carregandoMensagens || !!erroMensagens
  useEffect(() => {
    if (!conversaAtiva || pausado) return
    const timer = setInterval(() => carregarMensagens(conversaAtiva, true), INTERVALO_ATUALIZACAO_MS)
    return () => clearInterval(timer)
  }, [conversaAtiva, pausado, carregarMensagens])

  const ultimaChave = mensagens.at(-1)?.chave ?? null
  useEffect(() => {
    for (const area of [areaMobileRef.current, areaDesktopRef.current]) {
      if (area) area.scrollTop = area.scrollHeight
    }
  }, [ultimaChave, chaveAtiva])

  const tratarErroDeAcao = (erro: unknown) => {
    if (sessaoDoAppAusente(erro, usuario.cod)) {
      setAppDesconectado(true)
      setErroMensagens(mensagemDeErro(erro))
      return
    }
    setErroAcao(mensagemDeErro(erro))
  }

  const handleEnviarMensagem = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const texto = message.trim()
    if (!texto || !conversaAtiva || enviando || appDesconectado) return

    const conversa = conversaAtiva
    const chave = chaveConversa(conversa)
    const temporaria: MensagemTela = {
      chave: `pendente:${++contadorPendentes.current}`,
      id: null,
      texto,
      remetente: usuario.nome,
      data: new Date(),
      propria: true,
      pendente: true,
    }

    setMessage('')
    setErroAcao('')
    setEnviando(true)
    setMensagens((atuais) => [...atuais, temporaria])

    try {
      await enviarMensagem(conversa.chat_id, { app: conversa.app, mensagem: texto })
      // A rota não devolve a mensagem criada: recarregar traz o id real (necessário para editar/excluir).
      await carregarMensagens(conversa, true)
      setMensagens((atuais) =>
        atuais.map((mensagem) => (mensagem.chave === temporaria.chave ? { ...mensagem, pendente: false } : mensagem)),
      )
    } catch (erro) {
      setMensagens((atuais) => atuais.filter((mensagem) => mensagem.chave !== temporaria.chave))
      if (conversaAtivaRef.current === chave) {
        setMessage((atual) => atual || texto)
        tratarErroDeAcao(erro)
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
    const conversa = conversaAtiva
    const mensagemId = mensagem.id
    if (!conversa || mensagemId === null) return
    const texto = novoTexto.trim()
    if (!texto) return
    if (texto === mensagem.texto) {
      setEditandoId(null)
      return
    }

    const chave = chaveConversa(conversa)
    setSalvandoId(mensagemId)
    setErroAcao('')

    try {
      await editarMensagem(conversa.chat_id, { app: conversa.app, message_id: mensagemId, nova_mensagem: texto })
      editadas.current.add(chaveEdicao(conversa.chat_id, mensagemId))
      if (conversaAtivaRef.current === chave) {
        setMensagens((atuais) =>
          atuais.map((atual) => (atual.id === mensagemId ? { ...atual, texto, editada: true } : atual)),
        )
      }
      setEditandoId(null)
    } catch (erro) {
      tratarErroDeAcao(erro)
    } finally {
      setSalvandoId(null)
    }
  }

  const excluirMensagem = async (mensagem: MensagemTela) => {
    const conversa = conversaAtiva
    const mensagemId = mensagem.id
    if (!conversa || mensagemId === null) return
    if (!window.confirm('Excluir esta mensagem para todos na conversa?')) return

    const chave = chaveConversa(conversa)
    setExcluindoId(mensagemId)
    setErroAcao('')

    try {
      await deletarMensagem(conversa.chat_id, { app: conversa.app, message_id: mensagemId })
      if (conversaAtivaRef.current === chave) {
        setMensagens((atuais) => atuais.filter((atual) => atual.id !== mensagemId))
      }
      setEditandoId((atual) => (atual === mensagemId ? null : atual))
    } catch (erro) {
      tratarErroDeAcao(erro)
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

  const renderFiltros = () =>
    redes.length > 0 && (
      <div role="group" aria-label="Filtrar conversas por aplicativo" className="flex gap-2 overflow-x-auto mt-3 pb-0.5">
        <button
          type="button"
          onClick={() => setFiltroApp(null)}
          aria-pressed={!filtroAtivo}
          className={classeFiltro(!filtroAtivo)}
        >
          Todas
        </button>
        {redes.map((rede) => {
          const { nome, Icone } = REDES_SOCIAIS[rede]
          return (
            <button
              key={rede}
              type="button"
              onClick={() => setFiltroApp(rede)}
              aria-pressed={filtroAtivo === rede}
              className={classeFiltro(filtroAtivo === rede)}
            >
              <Icone className="w-3.5 h-3.5" />
              {nome}
            </button>
          )
        })}
      </div>
    )

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
            Nenhuma conversa ainda. Conecte o Telegram ou o Signal para ver suas conversas aqui.
          </p>
          <button
            onClick={() => onNavigate('editar-perfil')}
            className="mt-4 px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            Conectar redes
          </button>
        </div>
      )
    }

    if (filtroAtivo && !listaDoFiltro) {
      if (erroFiltro) {
        return (
          <div className="p-6 text-center">
            <p className="text-sm text-red-600">{erroFiltro}</p>
            <button
              onClick={() => {
                setFalhaFiltro(null)
                setTentativaFiltro((tentativa) => tentativa + 1)
              }}
              className="mt-3 text-sm text-brand-600 font-semibold hover:underline outline-none cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        )
      }
      return <Carregando texto={`Carregando conversas do ${REDES_SOCIAIS[filtroAtivo].nome}...`} />
    }

    const aviso = erroConversas || (filtroAtivo ? erroFiltro : '')

    return (
      <>
        {aviso && <p className="px-4 py-2 text-xs text-amber-800 bg-amber-50 border-b border-amber-100">{aviso}</p>}
        {conversasFiltradas.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">Nenhuma conversa encontrada.</div>
        ) : (
          conversasFiltradas.map((conversa) => {
            const rede = redeDoApp(conversa.app)
            const infoRede = rede ? REDES_SOCIAIS[rede] : null
            const ativa = chaveConversa(conversa) === chaveAtiva
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
              {appDesconectado ? (
                <WifiOff className="w-6 h-6 text-red-500" />
              ) : (
                <CircleAlert className="w-6 h-6 text-red-500" />
              )}
            </div>
            {appDesconectado ? (
              <>
                <p className="text-slate-700 text-sm">
                  A sessão do {nomeDoApp(conversaAtiva.app)} não está ativa no servidor. Saia e entre de novo para
                  reconectar automaticamente.
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
                  onClick={() => carregarMensagens(conversaAtiva)}
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

    const rede = redeDoApp(conversaAtiva.app)
    const permiteAlterar = rede !== null && REDES_SOCIAIS[rede].permiteAlterarMensagens

    return mensagens.map((mensagem, indice) => {
      const dia = mensagem.data ? rotuloDoDia(mensagem.data) : ''
      const anterior = indice > 0 ? mensagens[indice - 1].data : null
      const mostrarDia = dia && (!anterior || rotuloDoDia(anterior) !== dia)
      const mensagemId = mensagem.id
      const alteravel = permiteAlterar && mensagem.propria && !mensagem.pendente && mensagemId !== null

      return (
        <Fragment key={mensagem.chave}>
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
            mostrarRemetente={
              !mensagem.propria && !!mensagem.remetente && mensagem.remetente !== conversaAtiva.nome_chat
            }
            podeEditar={alteravel && mensagem.texto !== TEXTO_MIDIA}
            podeExcluir={alteravel}
            editando={mensagemId !== null && editandoId === mensagemId}
            salvando={mensagemId !== null && salvandoId === mensagemId}
            excluindo={mensagemId !== null && excluindoId === mensagemId}
            onIniciarEdicao={() => {
              setErroAcao('')
              setEditandoId(mensagemId)
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
      onClick={() => conversaAtiva && carregarMensagens(conversaAtiva)}
      disabled={!conversaAtiva || carregandoMensagens}
      aria-label="Atualizar mensagens"
      title="Atualizar mensagens"
      className={`${classe} hover:bg-slate-100 rounded-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      <RefreshCw className={`w-5 h-5 ${carregandoMensagens ? 'animate-spin' : ''}`} />
    </button>
  )

  const placeholderMensagem = appDesconectado ? 'Reconecte-se para enviar mensagens' : 'Mensagem...'

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
                      {conversaAtiva.nome_chat || 'Sem nome'}
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
                  disabled={appDesconectado}
                  placeholder={placeholderMensagem}
                  aria-label="Mensagem"
                  className="flex-1 max-h-32 py-3.5 bg-transparent outline-none resize-none text-[15px] text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed"
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
                disabled={enviando || appDesconectado}
                aria-label="Enviar mensagem"
                className="w-12 h-12 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-sm hover:bg-brand-600 transition-colors flex-shrink-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
              {renderFiltros()}
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
            {renderFiltros()}
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
                  {conversaAtiva ? conversaAtiva.nome_chat || 'Sem nome' : 'Selecione um chat'}
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
                disabled={!conversaAtiva || appDesconectado}
                placeholder={
                  !conversaAtiva
                    ? 'Selecione uma conversa'
                    : appDesconectado
                      ? placeholderMensagem
                      : 'Mensagem... (Enter envia, Shift+Enter quebra linha)'
                }
                aria-label="Mensagem"
                className="flex-1 max-h-32 py-4 bg-transparent outline-none resize-none text-[15px] text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed"
                style={{
                  minHeight: '56px',
                }}
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={!conversaAtiva || enviando || appDesconectado}
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
