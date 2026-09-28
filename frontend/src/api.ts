export async function lerResposta(resposta: Response): Promise<unknown> {
  const texto = await resposta.text()
  try {
    return texto ? JSON.parse(texto) : {}
  } catch {
    return texto
  }
}

export function extrairMensagemErro(dados: unknown, fallback: string): string {
  if (typeof dados === 'string' && dados) return dados
  if (dados && typeof dados === 'object' && 'detail' in dados) {
    const { detail } = dados as { detail: unknown }
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return detail[0].msg
  }
  return fallback
}
