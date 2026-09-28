export const REGRAS_SENHA = [
  { descricao: 'Pelo menos 8 caracteres', valida: (senha: string) => senha.length >= 8 },
  { descricao: 'Pelo menos uma letra maiúscula', valida: (senha: string) => /\p{Lu}/u.test(senha) },
  { descricao: 'Pelo menos um número', valida: (senha: string) => /\d/.test(senha) },
]

export const MENSAGEM_SENHA_INVALIDA =
  'A senha deve ter no mínimo 8 caracteres, com pelo menos uma letra maiúscula e um número.'

export function senhaValida(senha: string) {
  return REGRAS_SENHA.every((regra) => regra.valida(senha))
}
