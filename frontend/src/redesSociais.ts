import type { ComponentType } from 'react'
import { IconeTelegram } from './components/IconeTelegram'

export type RedeSocial = 'telegram'

export const REDES_SOCIAIS: Record<
  RedeSocial,
  { nome: string; cor: string; Icone: ComponentType<{ className?: string }> }
> = {
  telegram: { nome: 'Telegram', cor: 'bg-[#26A5E4]', Icone: IconeTelegram },
}

type RedesConectadas = Partial<Record<RedeSocial, string>>

// O backend ainda não tem rota que liste as contas conectadas, então o vínculo fica salvo no navegador.
const chave = (codUsuario: number | string) => `redesConectadas:${codUsuario}`

export function lerRedesConectadas(codUsuario: number | string): RedesConectadas {
  try {
    return JSON.parse(localStorage.getItem(chave(codUsuario)) ?? '{}')
  } catch {
    return {}
  }
}

export function listarRedesConectadas(codUsuario: number | string): RedeSocial[] {
  const conectadas = lerRedesConectadas(codUsuario)
  return (Object.keys(REDES_SOCIAIS) as RedeSocial[]).filter((rede) => conectadas[rede])
}

export function salvarRedeConectada(codUsuario: number | string, rede: RedeSocial, conta: string) {
  const conectadas = lerRedesConectadas(codUsuario)
  conectadas[rede] = conta
  localStorage.setItem(chave(codUsuario), JSON.stringify(conectadas))
}

export function removerRedesConectadas(codUsuario: number | string) {
  localStorage.removeItem(chave(codUsuario))
}
