import type { ComponentType } from 'react'
import { MessageCircle } from 'lucide-react'
import { IconeTelegram } from './components/IconeTelegram'
import type { AppConversa, Conversa } from './api'

export type RedeSocial = 'telegram' | 'signal'

interface InfoRede {
  /** Valor gravado pelo back-end em Conversa.app e esperado no campo `app` dos payloads. */
  nome: AppConversa;
  cor: string;
  Icone: ComponentType<{ className?: string }>;
  /** O back-end só edita e exclui mensagens do Telegram. */
  permiteAlterarMensagens: boolean;
}

export const REDES_SOCIAIS: Record<RedeSocial, InfoRede> = {
  telegram: { nome: 'Telegram', cor: 'bg-[#26A5E4]', Icone: IconeTelegram, permiteAlterarMensagens: true },
  signal: { nome: 'Signal', cor: 'bg-[#3A76F0]', Icone: MessageCircle, permiteAlterarMensagens: false },
}

export function redeDoApp(app: string): RedeSocial | null {
  const nome = app.trim().toLowerCase()
  return Object.hasOwn(REDES_SOCIAIS, nome) ? (nome as RedeSocial) : null
}

export function redesConectadas(conversas: Conversa[]): RedeSocial[] {
  const redes = new Set<RedeSocial>()
  for (const conversa of conversas) {
    const rede = redeDoApp(conversa.app)
    if (rede) redes.add(rede)
  }
  return (Object.keys(REDES_SOCIAIS) as RedeSocial[]).filter((rede) => redes.has(rede))
}

/** Conversa com uma pessoa: no Telegram o id é positivo; no Signal, grupos começam com "group.". */
export function ehConversaIndividual(conversa: Conversa): boolean {
  switch (redeDoApp(conversa.app)) {
    case 'telegram':
      return Number(conversa.chat_id) > 0
    case 'signal':
      return !conversa.chat_id.startsWith('group.')
    default:
      return false
  }
}

type RotulosRedes = Partial<Record<RedeSocial, string>>

const chave = (codUsuario: number) => `redesConectadas:${codUsuario}`

export function lerRedesConectadas(codUsuario: number): RotulosRedes {
  try {
    return JSON.parse(localStorage.getItem(chave(codUsuario)) ?? '{}')
  } catch {
    return {}
  }
}

export function salvarRedeConectada(codUsuario: number, rede: RedeSocial, conta: string) {
  const rotulos = lerRedesConectadas(codUsuario)
  rotulos[rede] = conta
  localStorage.setItem(chave(codUsuario), JSON.stringify(rotulos))
}

export function removerRedesConectadas(codUsuario: number) {
  localStorage.removeItem(chave(codUsuario))
}
