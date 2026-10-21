import type { ComponentType } from 'react'
import { IconeTelegram } from './components/IconeTelegram'
import type { Conversa } from './api'

export type RedeSocial = 'telegram'

export const REDES_SOCIAIS: Record<
  RedeSocial,
  { nome: string; cor: string; Icone: ComponentType<{ className?: string }> }
> = {
  telegram: { nome: 'Telegram', cor: 'bg-[#26A5E4]', Icone: IconeTelegram },
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
