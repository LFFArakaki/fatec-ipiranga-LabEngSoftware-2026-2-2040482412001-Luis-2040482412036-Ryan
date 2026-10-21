const API_BASE = '/api'

export interface UsuarioVisivel {
  nome_usuario: string;
  nome: string;
  data_nascimento: string;
  email: string;
}

export interface Usuario extends UsuarioVisivel {
  cod: number;
}

export interface CadastroPayload extends UsuarioVisivel {
  senha: string;
}

export type AtualizarUsuarioPayload = Partial<UsuarioVisivel>

export interface TokenResposta {
  access_token: string;
  token_type: string;
}

export interface Conversa {
  cod: number;
  cod_usuario: number;
  app: string;
  chat_id: number;
  nome_chat: string;
}

export interface MensagemApi {
  remetente: string;
  id: number;
  texto: string;
  data: string;
}

export interface EnviarMensagemPayload {
  app: string;
  mensagem: string;
}

export interface EditarMensagemPayload {
  app: string;
  message_id: number;
  nova_mensagem: string;
}

export interface DeletarMensagemPayload {
  app: string;
  message_id: number;
}

export interface StatusOperacao {
  status: string;
  message: string;
}

export interface Sessao {
  usuario: Usuario;
  conversas: Conversa[];
}

export interface ConectarTG {
  numero: string;
}

export interface SessaoTG {
  numero: string;
  codigo: string;
}

export interface CodigoEnviado {
  status: string;
  message: string;
}

export interface EsqueciSenhaPayload {
  email: string;
}

export interface RedefinirSenhaPayload {
  token: string;
  nova_senha: string;
}

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

export async function lerResposta(resposta: Response): Promise<unknown> {
  const texto = await resposta.text()
  try {
    return texto ? JSON.parse(texto) : {}
  } catch {
    return texto
  }
}

export function extrairMensagemErro(dados: unknown, fallback: string): string {
  if (typeof dados === 'string' && dados) return dados
  if (dados && typeof dados === 'object' && 'detail' in dados) {
    const { detail } = dados as { detail: unknown }
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return detail[0].msg
  }
  return fallback
}

const CHAVE_TOKEN = 'token'

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
  return expiracao ? Math.max(0, expiracao - Date.now()) : 0
}

export function sessaoAtiva(): boolean {
  return msAteExpirar() > 0
}

interface OpcoesRequisicao {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  json?: unknown;
  form?: Record<string, string>;
  auth?: boolean;
  fallback: string;
}

async function requisitar<T>(caminho: string, opcoes: OpcoesRequisicao): Promise<T> {
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

  const dados = await lerResposta(resposta)

  if (!resposta.ok) {
    if (resposta.status === 401 && auth) {
      notificarSessaoExpirada()
      throw new ApiError(MENSAGEM_SESSAO_EXPIRADA, 401)
    }
    const mensagem =
      resposta.status >= 500 && typeof dados === 'string' ? fallback : extrairMensagemErro(dados, fallback)
    throw new ApiError(mensagem, resposta.status)
  }

  if (typeof dados === 'string' && dados.startsWith('Erro')) {
    throw new ApiError(fallback, resposta.status)
  }

  return dados as T
}

export function cadastrar(dados: CadastroPayload) {
  return requisitar<UsuarioVisivel>('/cadastrar/', {
    method: 'POST',
    json: dados,
    fallback: 'Não foi possível criar a conta. Verifique se o e-mail ou o nome de usuário já estão em uso.',
  })
}

export async function login(email: string, senha: string): Promise<TokenResposta> {
  try {
    const dados = await requisitar<TokenResposta>('/login/', {
      method: 'POST',
      form: { username: email, password: senha },
      fallback: 'Não foi possível entrar. Tente novamente.',
    })
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
  } finally {
    limparSessao()
  }
}

export function obterPerfil() {
  return requisitar<Usuario>('/perfil/', {
    auth: true,
    fallback: 'Não foi possível carregar seu perfil.',
  })
}

export function atualizarUsuario(codUsuario: number, dados: AtualizarUsuarioPayload) {
  return requisitar<Usuario>(`/atualizar/usuarios/${codUsuario}`, {
    method: 'PATCH',
    json: dados,
    fallback: 'Não foi possível salvar. O e-mail ou o nome de usuário podem já estar em uso.',
  })
}

export function excluirConta() {
  return requisitar<{ ok: boolean }>('/excluir/', {
    method: 'DELETE',
    auth: true,
    fallback: 'Não foi possível excluir a conta.',
  })
}

export function listarUsuarios(offset = 0, limit = 100) {
  return requisitar<UsuarioVisivel[]>(`/listar/usuarios/?offset=${offset}&limit=${limit}`, {
    fallback: 'Não foi possível listar os usuários.',
  })
}

export function buscarUsuario(nomeUsuario: string) {
  return requisitar<UsuarioVisivel>(`/listar/usuarios/${encodeURIComponent(nomeUsuario)}`, {
    fallback: 'Não foi possível buscar o usuário.',
  })
}

export function listarConversas() {
  return requisitar<Conversa[]>('/perfil/conversas/', {
    auth: true,
    fallback: 'Não foi possível carregar suas conversas.',
  })
}

export function buscarMensagens(chatId: number) {
  return requisitar<MensagemApi[]>(`/perfil/conversas/${chatId}`, {
    auth: true,
    fallback: 'Não foi possível carregar as mensagens desta conversa.',
  })
}

export function enviarMensagem(chatId: number, dados: EnviarMensagemPayload) {
  return requisitar<StatusOperacao>(`/perfil/conversas/${chatId}/enviar-mensagem`, {
    method: 'POST',
    json: dados,
    auth: true,
    fallback: 'Não foi possível enviar a mensagem.',
  })
}

export function editarMensagem(chatId: number, dados: EditarMensagemPayload) {
  return requisitar<StatusOperacao>(`/perfil/conversas/${chatId}/editar-mensagem`, {
    method: 'POST',
    json: dados,
    auth: true,
    fallback: 'Não foi possível editar a mensagem.',
  })
}

export function deletarMensagem(chatId: number, dados: DeletarMensagemPayload) {
  return requisitar<StatusOperacao>(`/perfil/conversas/${chatId}/deletar-mensagem`, {
    method: 'POST',
    json: dados,
    auth: true,
    fallback: 'Não foi possível excluir a mensagem.',
  })
}

export function enviarCodigoTelegram(dados: ConectarTG) {
  return requisitar<CodigoEnviado>('/auth/tg/codigo', {
    method: 'POST',
    json: dados,
    auth: true,
    fallback: 'Erro ao enviar o código de confirmação.',
  })
}

export function confirmarCodigoTelegram(dados: SessaoTG) {
  return requisitar<string>('/auth/tg/sign-in', {
    method: 'POST',
    json: dados,
    auth: true,
    fallback: 'Não foi possível confirmar a conexão.',
  })
}

export function solicitarRedefinicaoSenha(dados: EsqueciSenhaPayload) {
  return requisitar<string>('/auth/esqueci-senha', {
    method: 'POST',
    json: dados,
    fallback: 'Não encontramos uma conta com este e-mail. Verifique o endereço digitado.',
  })
}

export function redefinirSenha(dados: RedefinirSenhaPayload) {
  return requisitar<string>('/auth/redefinir-senha', {
    method: 'POST',
    json: dados,
    fallback: 'Este link expirou ou é inválido. Solicite um novo link de redefinição.',
  })
}
