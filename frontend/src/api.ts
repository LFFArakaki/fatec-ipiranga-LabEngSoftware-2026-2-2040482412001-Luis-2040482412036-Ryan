const API_BASE = '/api'

/* ------------------------------------------------------------------ */
/* Tipos espelhando backend/models_db.py e backend/models_payload.py   */
/* ------------------------------------------------------------------ */

/** Campos públicos do usuário (UsuarioVisivel). Todos são obrigatórios no banco. */
export interface UsuarioVisivel {
  nome_usuario: string;
  nome: string;
  data_nascimento: string;
  email: string;
}

/** Usuário logado (GET /perfil/). O servidor também devolve o hash da senha, que o front descarta. */
export interface Usuario extends UsuarioVisivel {
  cod: number;
}

/** POST /cadastrar/. O `cod` é gerado pelo banco e a senha é criptografada com bcrypt no servidor. */
export interface CadastroPayload extends UsuarioVisivel {
  senha: string;
}

/**
 * PATCH /atualizar/usuarios/{cod}: o servidor altera só os campos enviados.
 * Nunca envie a senha por aqui, porque essa rota a gravaria sem criptografia.
 */
export type AtualizarUsuarioPayload = Partial<UsuarioVisivel>

/** Resposta de POST /login/. */
export interface TokenResposta {
  access_token: string;
  token_type: string;
}

/** Valores que o back-end grava em Conversa.app. */
export type AppConversa = 'Telegram' | 'Signal'

/** Conversa já normalizada: `chat_id` sempre em texto (id do Telegram, telefone ou "group.…" do Signal). */
export interface Conversa {
  cod: number;
  cod_usuario: number;
  app: string;
  chat_id: string;
  nome_chat: string;
}

/** Conversa como sai do banco. Bancos criados antes da integração com o Signal guardam chat_id como número. */
interface ConversaBanco extends Omit<Conversa, 'chat_id' | 'nome_chat'> {
  chat_id: string | number;
  nome_chat: string | null;
}

/** Item de GET /perfil/conversa/{chat_id}. Só o Telegram informa `id`; o Signal não. */
export interface MensagemApi {
  remetente: string;
  texto: string | null;
  data: string;
  id?: number;
}

/** Linha de ConversaSignal (GET /mensagens-signal/), com o histórico indexado por "mensagem<timestamp>". */
export interface ConversaSignal {
  cod: number;
  cod_usuario: number;
  cod_conversa: number;
  internal_id: string;
  log: Record<string, Omit<MensagemApi, 'id'>>;
}

/** ConectarNumero: corpo de POST /auth/tg/codigo e de POST /auth/signal/sign-in. */
export interface ConectarNumero {
  numero: string;
}

/** SessaoTG: corpo de POST /auth/tg/sign-in. O back-end não tem etapa de senha (2FA). */
export interface SessaoTG {
  numero: string;
  codigo: string;
}

export interface EsqueciSenhaPayload {
  email: string;
}

export interface RedefinirSenhaPayload {
  token: string;
  nova_senha: string;
}

export interface EnviarMensagemPayload {
  app: string;
  mensagem: string;
}

export interface DeletarMensagemPayload {
  app: string;
  message_id: number;
}

export interface EditarMensagemPayload {
  app: string;
  message_id: number;
  nova_mensagem: string;
}

/** Resposta de enviar/editar/deletar mensagem e de GET /busca-conversas/. */
export interface StatusOperacao {
  status: string;
  message: string;
}

/** Resposta de POST /auth/tg/codigo. */
export interface CodigoEnviado {
  status: 'code_sent';
  message: string;
}

export interface Sessao {
  usuario: Usuario;
  conversas: Conversa[];
}

/* ------------------------------------------------------------------ */
/* Erros                                                               */
/* ------------------------------------------------------------------ */

export class ApiError extends Error {
  status: number

  constructor(mensagem: string, status: number) {
    super(mensagem)
    this.name = 'ApiError'
    this.status = status
  }
}

export const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'

export function mensagemDeErro(erro: unknown, fallback = 'Erro de conexão com o servidor.'): string {
  return erro instanceof Error && erro.message ? erro.message : fallback
}

async function lerResposta(resposta: Response): Promise<unknown> {
  const texto = await resposta.text()
  try {
    return texto ? JSON.parse(texto) : {}
  } catch {
    return texto
  }
}

const DETALHES_TRADUZIDOS: Record<string, string> = {
  'User not found': 'Usuário não encontrado.',
  'Not Found': 'Recurso não encontrado no servidor.',
  'Method Not Allowed': 'Operação não permitida pelo servidor.',
  'Not authenticated': MENSAGEM_SESSAO_EXPIRADA,
}

const PROBLEMAS_DE_VALIDACAO: Record<string, string> = {
  missing: 'é obrigatório',
  string_type: 'precisa ser um texto',
  int_type: 'precisa ser um número inteiro',
  int_parsing: 'precisa ser um número inteiro',
}

/** Resume o primeiro item de um erro 422 do FastAPI ({ loc, msg, type }). */
function descreverErroDeValidacao(erro: unknown): string | null {
  if (!erro || typeof erro !== 'object') return null
  const { loc, type } = erro as { loc?: unknown; type?: unknown }
  const campo = Array.isArray(loc) ? loc.filter((parte) => parte !== 'body').join('.') : ''
  const problema = (typeof type === 'string' && PROBLEMAS_DE_VALIDACAO[type]) || 'é inválido'
  return campo ? `Dados inválidos: o campo "${campo}" ${problema}.` : `Dados inválidos: um campo ${problema}.`
}

/** Lê a mensagem de erro nos formatos que o back-end usa. */
function extrairMensagemErro(dados: unknown, fallback: string): string {
  if (typeof dados === 'string') return dados.trim() || fallback
  // `return {"error": ...}, 500` no FastAPI vira [{"error": "..."}, 500] com HTTP 200.
  if (Array.isArray(dados)) return extrairMensagemErro(dados[0], fallback)
  if (!dados || typeof dados !== 'object') return fallback

  if ('detail' in dados) {
    const { detail } = dados as { detail: unknown }
    if (typeof detail === 'string') return DETALHES_TRADUZIDOS[detail] ?? detail
    if (Array.isArray(detail)) return descreverErroDeValidacao(detail[0]) ?? fallback
  }
  if ('error' in dados && typeof dados.error === 'string') return dados.error
  return fallback
}

/**
 * Indica que o servidor não tem mais a conexão do Telegram/Signal do usuário (por exemplo, porque
 * reiniciou). O back-end só refaz essa conexão no login. Sem o cliente do Telegram, as rotas de
 * enviar/editar/deletar respondem "Erro ao <ação> mensagem: <cod do usuário>".
 */
export function sessaoDoAppAusente(erro: unknown, codUsuario: number): boolean {
  if (!(erro instanceof ApiError) || erro.status !== 400) return false
  return (
    /não conectado ao (telegram|signal)/i.test(erro.message) ||
    new RegExp(`^Erro ao (enviar|editar|deletar) mensagem: ${codUsuario}$`).test(erro.message)
  )
}

/* ------------------------------------------------------------------ */
/* Sessão (JWT)                                                        */
/* ------------------------------------------------------------------ */

const CHAVE_TOKEN = 'token'

/**
 * O back-end responde 500 (e não 401) quando recebe um token vencido, então o front
 * encerra a sessão com uma pequena folga antes do horário de expiração.
 */
const FOLGA_EXPIRACAO_MS = 30_000

let aoExpirarSessao: (() => void) | null = null

export function definirAoExpirarSessao(callback: (() => void) | null) {
  aoExpirarSessao = callback
}

function notificarSessaoExpirada() {
  aoExpirarSessao?.()
}

export function lerToken(): string | null {
  return localStorage.getItem(CHAVE_TOKEN)
}

function salvarToken(token: string) {
  localStorage.setItem(CHAVE_TOKEN, token)
}

export function limparSessao() {
  localStorage.removeItem(CHAVE_TOKEN)
  localStorage.removeItem('telaAtual')
  localStorage.removeItem('userEmail')
}

function expiracaoDoToken(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    const dados = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof dados.exp === 'number' ? dados.exp * 1000 : null
  } catch {
    return null
  }
}

export function msAteExpirar(): number {
  const token = lerToken()
  const expiracao = token ? expiracaoDoToken(token) : null
  return expiracao ? Math.max(0, expiracao - FOLGA_EXPIRACAO_MS - Date.now()) : 0
}

export function sessaoAtiva(): boolean {
  return msAteExpirar() > 0
}

/* ------------------------------------------------------------------ */
/* Requisições                                                         */
/* ------------------------------------------------------------------ */

interface OpcoesRequisicao {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  json?: unknown;
  form?: Record<string, string>;
  auth?: boolean;
  fallback: string;
}

/** Faz a chamada e transforma respostas 4xx/5xx em ApiError com a mensagem do back-end. */
async function enviarRequisicao(caminho: string, opcoes: OpcoesRequisicao): Promise<Response> {
  const { method = 'GET', json, form, auth = false, fallback } = opcoes
  const headers: Record<string, string> = {}
  let body: BodyInit | undefined

  if (auth) {
    const token = lerToken()
    if (!token || !sessaoAtiva()) {
      notificarSessaoExpirada()
      throw new ApiError(MENSAGEM_SESSAO_EXPIRADA, 401)
    }
    headers.Authorization = `Bearer ${token}`
  }

  if (form) {
    body = new URLSearchParams(form)
  } else if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  }

  let resposta: Response
  try {
    resposta = await fetch(`${API_BASE}${caminho}`, { method, headers, body })
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Verifique sua conexão.', 0)
  }

  if (!resposta.ok) {
    if (resposta.status === 401 && auth) {
      notificarSessaoExpirada()
      throw new ApiError(MENSAGEM_SESSAO_EXPIRADA, 401)
    }
    const dados = await lerResposta(resposta)
    // Erros 5xx sem JSON (ex.: "Internal Server Error") não ajudam o usuário.
    const mensagem =
      resposta.status >= 500 && typeof dados === 'string' ? fallback : extrairMensagemErro(dados, fallback)
    throw new ApiError(mensagem, resposta.status)
  }

  return resposta
}

/** Chamada que devolve JSON ou o texto puro das rotas que retornam só uma string. */
async function requisitar<T>(caminho: string, opcoes: OpcoesRequisicao): Promise<T> {
  const resposta = await enviarRequisicao(caminho, opcoes)
  const dados = await lerResposta(resposta)
  // /auth/esqueci-senha e /auth/redefinir-senha respondem 200 com um texto "Erro ..." quando falham.
  if (typeof dados === 'string' && dados.startsWith('Erro')) {
    throw new ApiError(opcoes.fallback, resposta.status)
  }
  return dados as T
}

const comoLista = <T>(dados: unknown): T[] => (Array.isArray(dados) ? (dados as T[]) : [])

/* ------------------------------------------------------------------ */
/* Usuário e autenticação                                              */
/* ------------------------------------------------------------------ */

const usuarioSemSenha = ({ cod, nome, nome_usuario, email, data_nascimento }: Usuario): Usuario => ({
  cod,
  nome,
  nome_usuario,
  email,
  data_nascimento,
})

/** POST /cadastrar/ */
export function cadastrar(dados: CadastroPayload) {
  return requisitar<UsuarioVisivel>('/cadastrar/', {
    method: 'POST',
    json: dados,
    fallback: 'Não foi possível criar a conta. Verifique se o e-mail ou o nome de usuário já estão em uso.',
  })
}

/**
 * POST /login/ (formulário OAuth2: o e-mail vai no campo "username").
 * Durante o login o servidor também reconecta o Telegram e o Signal já vinculados ao usuário.
 */
export async function login(email: string, senha: string): Promise<TokenResposta> {
  const fallback = 'Não foi possível entrar agora. Tente novamente em instantes.'
  try {
    const dados = await requisitar<TokenResposta>('/login/', {
      method: 'POST',
      form: { username: email, password: senha },
      fallback,
    })
    if (!dados?.access_token) throw new ApiError(fallback, 500)
    salvarToken(dados.access_token)
    return dados
  } catch (erro) {
    if (erro instanceof ApiError && erro.status === 404) {
      throw new ApiError('Nenhuma conta encontrada com este e-mail.', 404)
    }
    if (erro instanceof ApiError && erro.status === 400) {
      throw new ApiError('Senha incorreta.', 400)
    }
    throw erro
  }
}

/** POST /logout/: o servidor desconecta o Telegram do usuário. */
export async function logout(): Promise<void> {
  const token = lerToken()
  try {
    if (token && sessaoAtiva()) {
      await fetch(`${API_BASE}/logout/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    }
  } catch {
    // Mesmo sem resposta do servidor, a sessão local é encerrada.
  } finally {
    limparSessao()
  }
}

/** GET /perfil/ */
export async function obterPerfil(): Promise<Usuario> {
  const usuario = await requisitar<Usuario>('/perfil/', {
    auth: true,
    fallback: 'Não foi possível carregar seu perfil.',
  })
  return usuarioSemSenha(usuario)
}

/** PATCH /atualizar/usuarios/{cod} */
export async function atualizarUsuario(codUsuario: number, dados: AtualizarUsuarioPayload): Promise<Usuario> {
  const usuario = await requisitar<Usuario>(`/atualizar/usuarios/${codUsuario}`, {
    method: 'PATCH',
    json: dados,
    auth: true,
    fallback: 'Não foi possível salvar. O e-mail ou o nome de usuário podem já estar em uso.',
  })
  return usuarioSemSenha(usuario)
}

/** DELETE /excluir/ */
export function excluirConta() {
  return requisitar<{ ok: boolean }>('/excluir/', {
    method: 'DELETE',
    auth: true,
    fallback: 'Não foi possível excluir a conta.',
  })
}

/** GET /listar/usuarios/ */
export async function listarUsuarios(offset = 0, limit = 100): Promise<UsuarioVisivel[]> {
  const usuarios = await requisitar<unknown>(`/listar/usuarios/?offset=${offset}&limit=${limit}`, {
    fallback: 'Não foi possível listar os usuários.',
  })
  return comoLista<UsuarioVisivel>(usuarios)
}

/**
 * GET /listar/usuarios/{username}. Hoje o back-end filtra por `Usuario.username`, campo que não
 * existe no modelo (o certo seria `nome_usuario`), então esta rota sempre responde 500.
 */
export function buscarUsuario(nomeUsuario: string) {
  return requisitar<UsuarioVisivel>(`/listar/usuarios/${encodeURIComponent(nomeUsuario)}`, {
    fallback: 'Não foi possível buscar o usuário.',
  })
}

/** POST /auth/esqueci-senha: o servidor envia por e-mail o link /redefinir-senha?token=... */
export function solicitarRedefinicaoSenha(dados: EsqueciSenhaPayload) {
  return requisitar<string>('/auth/esqueci-senha', {
    method: 'POST',
    json: dados,
    fallback: 'Não encontramos uma conta com este e-mail. Verifique o endereço digitado.',
  })
}

/** POST /auth/redefinir-senha (o token do link vale 10 minutos). */
export function redefinirSenha(dados: RedefinirSenhaPayload) {
  return requisitar<string>('/auth/redefinir-senha', {
    method: 'POST',
    json: dados,
    fallback: 'Este link expirou ou é inválido. Solicite um novo link de redefinição.',
  })
}

/* ------------------------------------------------------------------ */
/* Conversas e mensagens                                               */
/* ------------------------------------------------------------------ */

/** Converte chat_id para texto e remove conversas repetidas (o banco não impede duplicatas). */
function normalizarConversas(dados: unknown): Conversa[] {
  const vistas = new Set<string>()
  const conversas: Conversa[] = []
  for (const conversa of comoLista<ConversaBanco>(dados)) {
    const normalizada: Conversa = {
      ...conversa,
      chat_id: String(conversa.chat_id),
      nome_chat: conversa.nome_chat ?? '',
    }
    const chave = `${normalizada.app.toLowerCase()}:${normalizada.chat_id}`
    if (vistas.has(chave)) continue
    vistas.add(chave)
    conversas.push(normalizada)
  }
  return conversas
}

let sincronizacaoEmAndamento: Promise<StatusOperacao> | null = null

/**
 * GET /busca-conversas/: busca no Telegram e no Signal conectados as conversas novas e grava no banco.
 * Chamadas simultâneas reaproveitam a mesma requisição, porque duas sincronizações ao mesmo tempo
 * gravariam a mesma conversa duas vezes.
 */
export function sincronizarConversas(): Promise<StatusOperacao> {
  sincronizacaoEmAndamento ??= requisitar<StatusOperacao>('/busca-conversas/', {
    auth: true,
    fallback: 'Não foi possível buscar conversas novas agora. Mostrando as conversas já salvas.',
  }).finally(() => {
    sincronizacaoEmAndamento = null
  })
  return sincronizacaoEmAndamento
}

/** GET /perfil/conversas/ */
export async function listarConversas(): Promise<Conversa[]> {
  const conversas = await requisitar<unknown>('/perfil/conversas/', {
    auth: true,
    fallback: 'Não foi possível carregar suas conversas.',
  })
  return normalizarConversas(conversas)
}

/** GET /perfil/conversas/{app}: o filtro diferencia maiúsculas ("Telegram", "Signal"). */
export async function listarConversasPorApp(app: AppConversa): Promise<Conversa[]> {
  const conversas = await requisitar<unknown>(`/perfil/conversas/${encodeURIComponent(app)}`, {
    auth: true,
    fallback: `Não foi possível carregar as conversas do ${app}.`,
  })
  return normalizarConversas(conversas)
}

/**
 * GET /perfil/conversa/{chat_id}. O Telegram devolve as 20 mensagens mais recentes, da mais nova
 * para a mais antiga; o Signal devolve o histórico salvo, em ordem de chegada.
 */
export async function buscarMensagens(chatId: string): Promise<MensagemApi[]> {
  const mensagens = await requisitar<unknown>(`/perfil/conversa/${encodeURIComponent(chatId)}`, {
    auth: true,
    fallback: 'Não foi possível carregar as mensagens desta conversa.',
  })
  return comoLista<MensagemApi>(mensagens)
}

const caminhoDaConversa = (chatId: string) => `/perfil/conversas/${encodeURIComponent(chatId)}`

/** POST /perfil/conversas/{chat_id}/enviar-mensagem (Telegram e Signal). */
export function enviarMensagem(chatId: string, dados: EnviarMensagemPayload) {
  return requisitar<StatusOperacao>(`${caminhoDaConversa(chatId)}/enviar-mensagem`, {
    method: 'POST',
    json: dados,
    auth: true,
    fallback: 'Não foi possível enviar a mensagem.',
  })
}

/** POST /perfil/conversas/{chat_id}/editar-mensagem (só Telegram). */
export function editarMensagem(chatId: string, dados: EditarMensagemPayload) {
  return requisitar<StatusOperacao>(`${caminhoDaConversa(chatId)}/editar-mensagem`, {
    method: 'POST',
    json: dados,
    auth: true,
    fallback: 'Não foi possível editar a mensagem.',
  })
}

/** POST /perfil/conversas/{chat_id}/deletar-mensagem (só Telegram; apaga para todos). */
export function deletarMensagem(chatId: string, dados: DeletarMensagemPayload) {
  return requisitar<StatusOperacao>(`${caminhoDaConversa(chatId)}/deletar-mensagem`, {
    method: 'POST',
    json: dados,
    auth: true,
    fallback: 'Não foi possível excluir a mensagem.',
  })
}

/** GET /mensagens-signal/ */
export async function listarMensagensSignal(): Promise<ConversaSignal[]> {
  const conversas = await requisitar<unknown>('/mensagens-signal/', {
    auth: true,
    fallback: 'Não foi possível carregar o histórico do Signal.',
  })
  return comoLista<ConversaSignal>(conversas)
}

/* ------------------------------------------------------------------ */
/* Conexão com Telegram e Signal                                       */
/* ------------------------------------------------------------------ */

/**
 * POST /auth/tg/codigo. Se o número já estiver vinculado a este usuário, o servidor apenas
 * reconecta a sessão salva e responde 400 "Conta já cadastrada para este usuário.".
 */
export function enviarCodigoTelegram(dados: ConectarNumero) {
  return requisitar<CodigoEnviado>('/auth/tg/codigo', {
    method: 'POST',
    json: dados,
    auth: true,
    fallback: 'Erro ao enviar o código de confirmação.',
  })
}

export function contaTelegramJaVinculada(erro: unknown): boolean {
  return erro instanceof ApiError && erro.status === 400 && erro.message.includes('já cadastrada')
}

/** POST /auth/tg/sign-in: salva a sessão do Telegram e as conversas encontradas. */
export function confirmarCodigoTelegram(dados: SessaoTG) {
  return requisitar<string>('/auth/tg/sign-in', {
    method: 'POST',
    json: dados,
    auth: true,
    fallback: 'Não foi possível confirmar a conexão.',
  })
}

const ASSINATURA_PNG = [0x89, 0x50, 0x4e, 0x47]

async function ehPng(arquivo: Blob): Promise<boolean> {
  const inicio = new Uint8Array(await arquivo.slice(0, ASSINATURA_PNG.length).arrayBuffer())
  return ASSINATURA_PNG.every((byte, indice) => inicio[indice] === byte)
}

/**
 * POST /auth/signal/sign-in: registra o número e devolve o QR code (PNG) para vincular o Signal.
 * Quando algo falha, o servidor ainda responde 200, mas com um JSON de erro no lugar da imagem.
 */
export async function gerarQrCodeSignal(dados: ConectarNumero): Promise<Blob> {
  const fallback = 'Não foi possível gerar o QR code do Signal. Tente novamente.'
  const resposta = await enviarRequisicao('/auth/signal/sign-in', {
    method: 'POST',
    json: dados,
    auth: true,
    fallback,
  })
  const arquivo = await resposta.blob()
  if (await ehPng(arquivo)) return arquivo

  const texto = await arquivo.text()
  let detalhe: unknown = texto
  try {
    detalhe = JSON.parse(texto)
  } catch {
    // Resposta em texto puro.
  }
  const mensagem = extrairMensagemErro(detalhe, '')
  throw new ApiError(mensagem ? `${fallback} (Detalhe: ${mensagem})` : fallback, 502)
}
