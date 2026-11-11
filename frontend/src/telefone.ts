export interface Telefone {
  ddi: string;
  ddd: string;
  celular: string;
}

export const TELEFONE_VAZIO: Telefone = { ddi: '', ddd: '', celular: '' }

export const classeCampo =
  'w-full py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-slate-900 placeholder:text-slate-400'

export const somenteDigitos = (valor: string, maximo: number) => valor.replace(/\D/g, '').slice(0, maximo)

export const formatarCelular = (celular: string) =>
  celular.length > 5 ? `${celular.slice(0, 5)}-${celular.slice(5)}` : celular

export const formatarTelefone = (telefone: Telefone) =>
  `+${telefone.ddi} (${telefone.ddd}) ${formatarCelular(telefone.celular)}`

/** Formato internacional (+5511912345678) enviado em `numero` e gravado em Conta.usuario_app. */
export const paraNumeroInternacional = (telefone: Telefone) =>
  `+${telefone.ddi}${telefone.ddd}${telefone.celular}`

export function validarTelefone(telefone: Telefone): string | null {
  if (!telefone.ddi) return 'Informe o DDI do país (ex.: 55 para o Brasil).'
  if (telefone.ddd.length !== 2) return 'Informe o DDD com 2 dígitos.'
  if (telefone.celular.length !== 9) return 'O número de celular deve ter 9 dígitos.'
  return null
}
