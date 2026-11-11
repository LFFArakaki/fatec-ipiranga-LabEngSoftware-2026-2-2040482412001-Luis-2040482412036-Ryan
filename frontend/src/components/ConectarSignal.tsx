import { useEffect, useState } from 'react'
import { Check, LoaderCircle } from 'lucide-react'
import { REDES_SOCIAIS, lerRedesConectadas, redeDoApp, salvarRedeConectada } from '../redesSociais'
import { gerarQrCodeSignal, mensagemDeErro, type Conversa } from '../api'
import { CamposTelefone } from './CamposTelefone'
import { TELEFONE_VAZIO, formatarTelefone, paraNumeroInternacional, validarTelefone, type Telefone } from '../telefone'

interface ConectarSignalProps {
  codUsuario: number;
  /** Já existem conversas do Signal: o servidor recria o cliente do Signal a cada login. */
  conectado: boolean;
  /** Busca as conversas novas (GET /busca-conversas/) e devolve a lista atualizada. */
  onSincronizarConversas: () => Promise<Conversa[]>;
}

type Etapa = 'inicio' | 'numero' | 'qrcode'

const classeBotaoPrincipal =
  'w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors shadow-sm cursor-pointer disabled:opacity-50'

const classeLink =
  'text-brand-600 font-semibold hover:underline outline-none bg-transparent border-none p-0 cursor-pointer disabled:opacity-50'

export function ConectarSignal({ codUsuario, conectado, onSincronizarConversas }: ConectarSignalProps) {
  const [etapa, setEtapa] = useState<Etapa>('inicio')
  const [telefone, setTelefone] = useState<Telefone>(TELEFONE_VAZIO)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [verificando, setVerificando] = useState(false)
  const [conectadoAgora, setConectadoAgora] = useState(false)
  const [erro, setErro] = useState('')

  const { nome, cor, Icone } = REDES_SOCIAIS.signal
  const contaConectada = conectado || conectadoAgora
  const rotuloConta = lerRedesConectadas(codUsuario).signal

  // Libera da memória a imagem do QR code quando ela é trocada ou sai da tela.
  useEffect(() => {
    if (!qrCode) return
    return () => URL.revokeObjectURL(qrCode)
  }, [qrCode])

  const cancelar = () => {
    setEtapa('inicio')
    setTelefone(TELEFONE_VAZIO)
    setQrCode(null)
    setErro('')
  }

  const gerarQrCode = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const erroTelefone = validarTelefone(telefone)
    if (erroTelefone) {
      setErro(erroTelefone)
      return
    }

    setErro('')
    setGerando(true)

    try {
      const imagem = await gerarQrCodeSignal({ numero: paraNumeroInternacional(telefone) })
      setQrCode(URL.createObjectURL(imagem))
      setEtapa('qrcode')
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setGerando(false)
    }
  }

  const confirmarLeitura = async () => {
    setErro('')
    setVerificando(true)

    try {
      const conversas = await onSincronizarConversas()
      if (!conversas.some((conversa) => redeDoApp(conversa.app) === 'signal')) {
        setErro(
          'Ainda não encontramos conversas do Signal. Confira se o QR code foi escaneado e tente de novo em alguns segundos.',
        )
        return
      }
      salvarRedeConectada(codUsuario, 'signal', formatarTelefone(telefone))
      setConectadoAgora(true)
      setEtapa('inicio')
      setQrCode(null)
    } catch {
      setErro('Ainda não foi possível acessar seu Signal. Confira se o QR code foi escaneado e tente novamente em alguns segundos.')
    } finally {
      setVerificando(false)
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
              {contaConectada ? (rotuloConta ?? 'Conectado automaticamente ao entrar') : 'Não conectado'}
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
          Signal conectado com sucesso!
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
            <form onSubmit={gerarQrCode} className="space-y-4">
              <p className="text-sm text-slate-500">
                Informe o celular da sua conta do Signal com DDI, DDD e os 9 dígitos do número. Vamos gerar um
                QR code para vincular o CommuniHub como um aparelho da sua conta.
              </p>
              <CamposTelefone telefone={telefone} onChange={setTelefone} />
              <button type="submit" disabled={gerando} className={classeBotaoPrincipal}>
                {gerando ? 'Gerando QR code...' : 'Gerar QR code'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Escaneie o código com o Signal de{' '}
                <span className="font-semibold text-slate-900">{formatarTelefone(telefone)}</span>:
              </p>
              <ol className="list-decimal pl-5 space-y-1 text-sm text-slate-600">
                <li>
                  No celular, abra o Signal e entre em <strong>Configurações</strong>.
                </li>
                <li>
                  Toque em <strong>Dispositivos vinculados</strong> (Linked devices) e vincule um novo dispositivo.
                </li>
                <li>Aponte a câmera para o QR code abaixo.</li>
              </ol>

              {qrCode && (
                <div className="flex justify-center">
                  <img
                    src={qrCode}
                    alt="QR code para vincular o Signal ao CommuniHub"
                    onError={() => setErro('Não foi possível exibir o QR code. Gere um novo código.')}
                    className="w-56 h-56 p-3 bg-white border border-slate-200 rounded-2xl [image-rendering:pixelated]"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={confirmarLeitura}
                disabled={verificando || gerando}
                className={`${classeBotaoPrincipal} inline-flex items-center justify-center gap-2`}
              >
                {verificando && <LoaderCircle className="w-4 h-4 animate-spin" />}
                {verificando ? 'Buscando suas conversas...' : 'Já escaneei o QR code'}
              </button>

              <p className="text-center text-sm text-slate-600">
                O código expirou?{' '}
                <button
                  type="button"
                  onClick={() => gerarQrCode()}
                  disabled={gerando || verificando}
                  className={classeLink}
                >
                  {gerando ? 'Gerando...' : 'Gerar outro QR code'}
                </button>
                {' · '}
                <button
                  type="button"
                  onClick={() => {
                    setErro('')
                    setQrCode(null)
                    setEtapa('numero')
                  }}
                  disabled={gerando || verificando}
                  className={classeLink}
                >
                  Trocar número
                </button>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
