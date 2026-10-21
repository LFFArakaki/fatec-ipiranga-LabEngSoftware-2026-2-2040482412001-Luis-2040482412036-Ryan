import { useState } from 'react'
import { Check, LoaderCircle, Pencil, Trash, X } from 'lucide-react'

export interface MensagemTela {
  id: number;
  texto: string;
  data: Date | null;
  propria: boolean;
  pendente?: boolean;
  editada?: boolean;
}

interface BolhaMensagemProps {
  mensagem: MensagemTela;
  podeEditar: boolean;
  podeExcluir: boolean;
  editando: boolean;
  salvando: boolean;
  excluindo: boolean;
  compacta?: boolean;
  onIniciarEdicao: () => void;
  onCancelarEdicao: () => void;
  onSalvarEdicao: (texto: string) => void;
  onExcluir: () => void;
}

function formatarHora(data: Date | null) {
  return data ? data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''
}

const classeBotaoAcao =
  'p-1.5 rounded-full text-slate-500 bg-white/70 hover:bg-white shadow-sm transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed'

export function BolhaMensagem({
  mensagem,
  podeEditar,
  podeExcluir,
  editando,
  salvando,
  excluindo,
  compacta = false,
  onIniciarEdicao,
  onCancelarEdicao,
  onSalvarEdicao,
  onExcluir,
}: BolhaMensagemProps) {
  const [rascunho, setRascunho] = useState(mensagem.texto)
  const { propria, pendente, editada } = mensagem
  const mostrarAcoes = (podeEditar || podeExcluir) && !editando
  const ocupado = salvando || excluindo

  const iniciarEdicao = () => {
    setRascunho(mensagem.texto)
    onIniciarEdicao()
  }

  const handleTecla = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      onSalvarEdicao(rascunho)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancelarEdicao()
    }
  }

  const corBolha = propria ? 'bg-brand-500 text-white rounded-tr-sm' : 'bg-white text-slate-800 rounded-tl-sm'
  const tamanho = compacta ? 'px-4 py-2.5 max-w-[85%]' : 'px-5 py-3 max-w-[70%]'

  return (
    <div className={`group flex items-center gap-1.5 ${propria ? 'justify-end' : 'justify-start'}`}>
      {mostrarAcoes && (
        <div
          className={`flex items-center gap-1 transition-opacity ${
            excluindo ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100'
          }`}
        >
          {podeEditar && (
            <button
              type="button"
              onClick={iniciarEdicao}
              disabled={ocupado}
              aria-label="Editar mensagem"
              title="Editar"
              className={`${classeBotaoAcao} hover:text-brand-600`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {podeExcluir && (
            <button
              type="button"
              onClick={onExcluir}
              disabled={ocupado}
              aria-label="Excluir mensagem"
              title="Excluir"
              className={`${classeBotaoAcao} hover:text-red-600`}
            >
              {excluindo ? (
                <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      )}

      <div
        className={`${corBolha} ${tamanho} rounded-2xl shadow-sm relative ${pendente || excluindo ? 'opacity-70' : ''} ${
          editando ? 'w-full sm:w-auto sm:min-w-[18rem]' : ''
        }`}
      >
        {editando ? (
          <div className="flex flex-col gap-2">
            <textarea
              autoFocus
              rows={2}
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              onKeyDown={handleTecla}
              disabled={salvando}
              aria-label="Editar texto da mensagem"
              className="w-full bg-white/15 text-white placeholder:text-brand-100 rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-white/60 resize-none text-[15px] leading-snug"
            />
            <div className="flex items-center justify-end gap-1.5">
              <span className="mr-auto text-[11px] text-brand-100">Enter salva · Esc cancela</span>
              <button
                type="button"
                onClick={onCancelarEdicao}
                disabled={salvando}
                aria-label="Cancelar edição"
                title="Cancelar"
                className="p-1.5 rounded-full hover:bg-white/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onSalvarEdicao(rascunho)}
                disabled={salvando || !rascunho.trim()}
                aria-label="Salvar edição"
                title="Salvar"
                className="p-1.5 rounded-full bg-white text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                {salvando ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ) : (
          <p className={`text-[15px] whitespace-pre-wrap break-words ${compacta ? 'leading-snug' : 'leading-relaxed'}`}>
            {mensagem.texto}
          </p>
        )}
        <div className={`text-[10px] text-right mt-1 font-medium ${propria ? 'text-brand-100' : 'text-slate-400'}`}>
          {pendente ? 'Enviando...' : `${editada ? 'editada · ' : ''}${formatarHora(mensagem.data)}`}
        </div>
      </div>
    </div>
  )
}
