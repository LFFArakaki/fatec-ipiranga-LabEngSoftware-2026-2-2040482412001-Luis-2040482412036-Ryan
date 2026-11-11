import { useId, useState } from 'react'
import { Check } from 'lucide-react'
import { REDES_SOCIAIS, lerRedesConectadas, salvarRedeConectada } from '../redesSociais'
import { confirmarCodigoTelegram, contaTelegramJaVinculada, enviarCodigoTelegram, mensagemDeErro } from '../api'
import { CamposTelefone } from './CamposTelefone'
import {
  TELEFONE_VAZIO,
  classeCampo,
  formatarTelefone,
  paraNumeroInternacional,
  somenteDigitos,
  validarTelefone,
  type Telefone,
} from '../telefone'

interface ConectarTelegramProps {
  codUsuario: number;
  /** Já existem conversas do Telegram: o servidor reconecta a sessão salva a cada login. */
  conectado: boolean;
  onConectado: () => Promise<unknown>;
}

type Etapa = 'inicio' | 'numero' | 'codigo'

function traduzirErroTelegram(mensagem: string): string {
  const texto = mensagem.toLowerCase()
  if (texto.includes('phone number is invalid')) {
    return 'Número de telefone inválido. Confira o DDI, o DDD e o número.'
  }
  if (texto.includes('banned')) {
    return 'Este número foi bloqueado pelo Telegram.'
  }
  if (texto.includes('not yet being used')) {
    return 'Este número ainda não tem conta no Telegram. Crie a conta no aplicativo do Telegram primeiro.'
  }
  if (texto.includes('code entered was invalid')) {
    return 'Código de confirmação inválido. Confira o código recebido no Telegram.'
  }
  if (texto.includes('expired') || texto.includes('nenhuma sessão de login')) {
    return 'O código expirou ou não foi solicitado para este número. Envie um novo código.'
  }
  if (texto.includes('two-steps') || texto.includes('password is required')) {
    return 'Esta conta do Telegram usa verificação em duas etapas (senha), que o servidor ainda não suporta.'
  }
  if (texto.includes('a wait of') || texto.includes('flood')) {
    return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.'
  }
  return mensagem
}

export function ConectarTelegram({ codUsuario, conectado, onConectado }: ConectarTelegramProps) {
  const [etapa, setEtapa] = useState<Etapa>('inicio')
  const [telefone, setTelefone] = useState<Telefone>(TELEFONE_VAZIO)
  const [confirmacao, setConfirmacao] = useState<Telefone>(TELEFONE_VAZIO)
  const [codigo, setCodigo] = useState('')
  const [conectadoAgora, setConectadoAgora] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const idCodigo = useId()

  const { nome, cor, Icone } = REDES_SOCIAIS.telegram
  const contaConectada = conectado || conectadoAgora
  const rotuloConta = lerRedesConectadas(codUsuario).telegram

  const marcarConectado = async (numero: Telefone) => {
    salvarRedeConectada(codUsuario, 'telegram', formatarTelefone(numero))
    setConectadoAgora(true)
    setEtapa('inicio')
    try {
      await onConectado()
    } catch {
      // As conversas aparecem na próxima atualização da lista.
    }
  }

  const cancelar = () => {
    setEtapa('inicio')
    setTelefone(TELEFONE_VAZIO)
    setConfirmacao(TELEFONE_VAZIO)
    setCodigo('')
    setErro('')
  }

  const enviarCodigo = async (e: React.FormEvent) => {
    e.preventDefault()
    const erroTelefone = validarTelefone(telefone)
    if (erroTelefone) {
      setErro(erroTelefone)
      return
    }

    setErro('')
    setLoading(true)

    try {
      await enviarCodigoTelegram({ numero: paraNumeroInternacional(telefone) })
      setConfirmacao(TELEFONE_VAZIO)
      setCodigo('')
      setEtapa('codigo')
    } catch (err) {
      if (contaTelegramJaVinculada(err)) {
        await marcarConectado(telefone)
      } else {
        setErro(traduzirErroTelegram(mensagemDeErro(err)))
      }
    } finally {
      setLoading(false)
    }
  }

  const confirmarConexao = async (e: React.FormEvent) => {
    e.preventDefault()
    const erroTelefone = validarTelefone(confirmacao)
    if (erroTelefone) {
      setErro(erroTelefone)
      return
    }
    if (paraNumeroInternacional(confirmacao) !== paraNumeroInternacional(telefone)) {
      setErro('O número informado não confere com o número para o qual o código foi enviado.')
      return
    }
    if (codigo.length < 5) {
      setErro('Digite o código de confirmação recebido no Telegram.')
      return
    }

    setErro('')
    setLoading(true)

    try {
      await confirmarCodigoTelegram({ numero: paraNumeroInternacional(confirmacao), codigo })
      await marcarConectado(confirmacao)
    } catch (err) {
      setErro(traduzirErroTelegram(mensagemDeErro(err)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 lg:px-8 lg:py-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`relative w-10 h-10 ${cor} rounded-full flex items-center justify-center shrink-0`}>
            <Icone className="w-6 h-6 text-white" />
            {contaConectada && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-brand-500 rounded-full border-2 border-white flex items-center justify-center">
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <span className="font-medium text-slate-900 block">{nome}</span>
            <span className="text-xs text-slate-500 block truncate">
              {contaConectada ? (rotuloConta ?? 'Sessão ativa, conectada automaticamente ao entrar') : 'Não conectado'}
            </span>
          </div>
        </div>

        {contaConectada ? (
          <span className="px-2.5 py-1 text-xs font-semibold text-brand-700 bg-brand-50 rounded-full shrink-0">
            Conectado
          </span>
        ) : etapa === 'inicio' ? (
          <button
            type="button"
            onClick={() => setEtapa('numero')}
            className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
          >
            Conectar
          </button>
        ) : (
          <button
            type="button"
            onClick={cancelar}
            className="px-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
          >
            Cancelar
          </button>
        )}
      </div>

      {conectadoAgora && (
        <div role="status" className="mt-4 p-3 text-sm text-brand-700 bg-brand-50 rounded-xl">
          Telegram conectado com sucesso!
        </div>
      )}

      {!contaConectada && etapa !== 'inicio' && (
        <div className="mt-5 space-y-4 lg:max-w-lg">
          {erro && (
            <div role="alert" className="p-3 text-sm text-red-600 bg-red-50 rounded-xl">
              {erro}
            </div>
          )}

          {etapa === 'numero' ? (
            <form onSubmit={enviarCodigo} className="space-y-4">
              <p className="text-sm text-slate-500">
                Informe o celular vinculado ao seu Telegram com DDI, DDD e os 9 dígitos do número.
                Vamos enviar um código de confirmação pelo próprio Telegram.
              </p>
              <CamposTelefone telefone={telefone} onChange={setTelefone} />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Enviando código...' : 'Enviar código'}
              </button>
            </form>
          ) : (
            <form onSubmit={confirmarConexao} className="space-y-4">
              <p className="text-sm text-slate-500">
                Enviamos um código para o Telegram de{' '}
                <span className="font-semibold text-slate-900">{formatarTelefone(telefone)}</span>.
                Digite o número novamente e o código recebido para confirmar a conexão.
              </p>
              <CamposTelefone telefone={confirmacao} onChange={setConfirmacao} />
              <div className="space-y-1.5">
                <label htmlFor={idCodigo} className="block text-sm font-medium text-slate-700">
                  Código de confirmação
                </label>
                <input
                  id={idCodigo}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={codigo}
                  onChange={(e) => setCodigo(somenteDigitos(e.target.value, 6))}
                  placeholder="12345"
                  className={`${classeCampo} px-4 text-center text-lg font-semibold tracking-[0.4em]`}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Confirmando...' : 'Confirmar conexão'}
              </button>
              <p className="text-center text-sm text-slate-600">
                Número errado ou não recebeu o código?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErro('')
                    setEtapa('numero')
                  }}
                  className="text-brand-600 font-semibold hover:underline outline-none bg-transparent border-none p-0 cursor-pointer"
                >
                  Enviar novamente
                </button>
              </p>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
