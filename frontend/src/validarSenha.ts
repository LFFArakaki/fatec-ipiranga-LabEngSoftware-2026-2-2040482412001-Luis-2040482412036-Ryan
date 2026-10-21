export const REGRAS_SENHA = [
  { descricao: 'Pelo menos 8 caracteres', valida: (senha: string) => senha.length >= 8 },
  { descricao: 'Pelo menos uma letra maiúscula', valida: (senha: string) => /\p{Lu}/u.test(senha) },
  { descricao: 'Pelo menos um número', valida: (senha: string) => /\d/.test(senha) },
]

export const LIMITE_BYTES_SENHA = 72

export const MENSAGEM_SENHA_INVALIDA =
  'A senha deve ter no mínimo 8 caracteres, com pelo menos uma letra maiúscula e um número.'

export const MENSAGEM_SENHA_LONGA = 'A senha é longa demais. Use no máximo 72 caracteres.'

export function senhaDentroDoLimite(senha: string) {
  return new TextEncoder().encode(senha).length <= LIMITE_BYTES_SENHA
}

export function senhaValida(senha: string) {
  return REGRAS_SENHA.every((regra) => regra.valida(senha)) && senhaDentroDoLimite(senha)
}

export function erroSenha(senha: string): string | null {
  if (!REGRAS_SENHA.every((regra) => regra.valida(senha))) return MENSAGEM_SENHA_INVALIDA
  if (!senhaDentroDoLimite(senha)) return MENSAGEM_SENHA_LONGA
  return null
}
