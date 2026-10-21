import type { UsuarioVisivel } from './api'

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const IDADE_MINIMA = 18

export function mascararData(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 8)
  if (digitos.length > 4) return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`
  if (digitos.length > 2) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`
  return digitos
}

function lerData(data: string): Date | null {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data)
  if (!partes) return null
  const [dia, mes, ano] = partes.slice(1).map(Number)
  const resultado = new Date(ano, mes - 1, dia)
  const dataReal =
    resultado.getFullYear() === ano && resultado.getMonth() === mes - 1 && resultado.getDate() === dia
  return dataReal ? resultado : null
}

function calcularIdade(nascimento: Date): number {
  const hoje = new Date()
  let idade = hoje.getFullYear() - nascimento.getFullYear()
  const diffMeses = hoje.getMonth() - nascimento.getMonth()
  if (diffMeses < 0 || (diffMeses === 0 && hoje.getDate() < nascimento.getDate())) idade--
  return idade
}

export function validarDadosUsuario(dados: UsuarioVisivel): string | null {
  if (!dados.nome.trim()) return 'Informe seu nome completo.'
  if (!dados.nome_usuario.trim()) return 'Informe um nome de usuário.'
  if (/\s/.test(dados.nome_usuario.trim())) return 'O nome de usuário não pode conter espaços.'
  if (!EMAIL_REGEX.test(dados.email.trim())) return 'Por favor, insira um e-mail válido.'

  const nascimento = lerData(dados.data_nascimento)
  if (!nascimento || nascimento > new Date()) return 'Data de nascimento inválida.'
  if (calcularIdade(nascimento) < IDADE_MINIMA) return 'Você precisa ter pelo menos 18 anos.'

  return null
}
