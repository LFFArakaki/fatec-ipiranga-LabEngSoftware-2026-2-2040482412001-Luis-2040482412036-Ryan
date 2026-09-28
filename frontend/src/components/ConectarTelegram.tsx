import { useId, useState } from 'react'
import { Check } from 'lucide-react'
import { REDES_SOCIAIS, lerRedesConectadas, salvarRedeConectada } from '../redesSociais'
import { extrairMensagemErro, lerResposta } from '../api'

interface Telefone {
  ddi: string;
  ddd: string;
  celular: string;
}

interface ConectarTelegramProps {
  codUsuario: number | string | null;
}

type Etapa = 'inicio' | 'numero' | 'codigo'

const TELEFONE_VAZIO: Telefone = { ddi: '', ddd: '', celular: '' }

const classeInput =
  'w-full py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-slate-900 placeholder:text-slate-400'

const somenteDigitos = (valor: string, maximo: number) => valor.replace(/\D/g, '').slice(0, maximo)

const formatarCelular = (celular: string) =>
  celular.length > 5 ? `${celular.slice(0, 5)}-${celular.slice(5)}` : celular

const formatarTelefone = (telefone: Telefone) =>
  `+${telefone.ddi} (${telefone.ddd}) ${formatarCelular(telefone.celular)}`

const paraNumeroInternacional = (telefone: Telefone) =>
  `+${telefone.ddi}${telefone.ddd}${telefone.celular}`

function validarTelefone(telefone: Telefone) {
  if (!telefone.ddi) return 'Informe o DDI do país (ex.: 55 para o Brasil).'
  if (telefone.ddd.length !== 2) return 'Informe o DDD com 2 dígitos.'
  if (telefone.celular.length !== 9) return 'O número de celular deve ter 9 dígitos.'
  return null
}

function CamposTelefone({
  telefone,
  onChange,
}: {
  telefone: Telefone;
  onChange: (telefone: Telefone) => void;
}) {
  const id = useId()

  return (
    <div className="grid grid-cols-2 sm:grid-cols-[6rem_5rem_1fr] gap-3">
      <div className="space-y-1.5">
        <label htmlFor={`${id}-ddi`} className="block text-sm font-medium text-slate-700">
          DDI
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500 pointer-events-none">
            +
          </span>
          <input
            id={`${id}-ddi`}
            type="text"
            inputMode="numeric"
            autoComplete="tel-country-code"
            value={telefone.ddi}
            onChange={(e) => onChange({ ...telefone, ddi: somenteDigitos(e.target.value, 3) })}
            placeholder="55"
            className={`${classeInput} pl-8 pr-3`}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`${id}-ddd`} className="block text-sm font-medium text-slate-700">
          DDD
        </label>
        <input
          id={`${id}-ddd`}
          type="text"
          inputMode="numeric"
          autoComplete="tel-area-code"
          value={telefone.ddd}
          onChange={(e) => onChange({ ...telefone, ddd: somenteDigitos(e.target.value, 2) })}
          placeholder="11"
          className={`${classeInput} px-4`}
        />
      </div>

      <div className="space-y-1.5 col-span-2 sm:col-span-1">
        <label htmlFor={`${id}-celular`} className="block text-sm font-medium text-slate-700">
          Celular
        </label>
        <input
          id={`${id}-celular`}
          type="text"
          inputMode="numeric"
          autoComplete="tel-local"
          value={formatarCelular(telefone.celular)}
          onChange={(e) => onChange({ ...telefone, celular: somenteDigitos(e.target.value, 9) })}
          placeholder="91234-5678"
          className={`${classeInput} px-4`}
        />
      </div>
    </div>
  )
}

export function ConectarTelegram({ codUsuario }: ConectarTelegramProps) {
  const [etapa, setEtapa] = useState<Etapa>('inicio')
  const [telefone, setTelefone] = useState<Telefone>(TELEFONE_VAZIO)
  const [confirmacao, setConfirmacao] = useState<Telefone>(TELEFONE_VAZIO)
  const [codigo, setCodigo] = useState('')
  const [contaConectadaAgora, setContaConectadaAgora] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const idCodigo = useId()

  const { nome, cor, Icone } = REDES_SOCIAIS.telegram
  const contaConectada =
    contaConectadaAgora ?? (codUsuario != null ? lerRedesConectadas(codUsuario).telegram : undefined)

  const marcarConectado = (numero: Telefone) => {
    const conta = formatarTelefone(numero)
    if (codUsuario != null) salvarRedeConectada(codUsuario, 'telegram', conta)
    setContaConectadaAgora(conta)
    setEtapa('inicio')
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
      const resposta = await fetch('/api/auth/tg/codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: paraNumeroInternacional(telefone) }),
      })

      if (!resposta.ok) {
        const mensagem = extrairMensagemErro(
          await lerResposta(resposta),
          'Erro ao enviar o código de confirmação.',
        )
        // O backend recusa com 400 quando já existe sessão salva para o número, ou seja, a conta já está conectada.
        if (mensagem.includes('já cadastrada')) {
          marcarConectado(telefone)
          return
        }
        throw new Error(mensagem)
      }

      setConfirmacao(TELEFONE_VAZIO)
      setCodigo('')
      setEtapa('codigo')
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro de conexão com o servidor.')
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
      const resposta = await fetch('/api/auth/tg/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: paraNumeroInternacional(confirmacao), codigo }),
      })

      if (!resposta.ok) {
        throw new Error(
          extrairMensagemErro(await lerResposta(resposta), 'Não foi possível confirmar a conexão.'),
        )
      }

      marcarConectado(confirmacao)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro de conexão com o servidor.')
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
              {contaConectada ?? 'Não conectado'}
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
            disabled={codUsuario == null}
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

      {contaConectadaAgora && (
        <div role="status" className="mt-4 p-3 text-sm text-brand-700 bg-brand-50 rounded-xl">
          Telegram conectado com sucesso!
        </div>
      )}

      {!contaConectada && etapa !== 'inicio' && (
        <div className="mt-5 space-y-4 lg:max-w-lg">
          {erro && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl">{erro}</div>}

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
                  className={`${classeInput} px-4 text-center text-lg font-semibold tracking-[0.4em]`}
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
