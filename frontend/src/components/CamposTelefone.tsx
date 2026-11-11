import { useId } from 'react'
import { classeCampo, formatarCelular, somenteDigitos, type Telefone } from '../telefone'

interface CamposTelefoneProps {
  telefone: Telefone;
  onChange: (telefone: Telefone) => void;
}

export function CamposTelefone({ telefone, onChange }: CamposTelefoneProps) {
  const id = useId()

  return (
    <div className="grid grid-cols-2 sm:grid-cols-[6rem_5rem_1fr] gap-3">
      <div className="space-y-1.5">
        <label htmlFor={`${id}-ddi`} className="block text-sm font-medium text-slate-700">
          DDI
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500 pointer-events-none">
            +
          </span>
          <input
            id={`${id}-ddi`}
            type="text"
            inputMode="numeric"
            autoComplete="tel-country-code"
            value={telefone.ddi}
            onChange={(e) => onChange({ ...telefone, ddi: somenteDigitos(e.target.value, 3) })}
            placeholder="55"
            className={`${classeCampo} pl-8 pr-3`}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`${id}-ddd`} className="block text-sm font-medium text-slate-700">
          DDD
        </label>
        <input
          id={`${id}-ddd`}
          type="text"
          inputMode="numeric"
          autoComplete="tel-area-code"
          value={telefone.ddd}
          onChange={(e) => onChange({ ...telefone, ddd: somenteDigitos(e.target.value, 2) })}
          placeholder="11"
          className={`${classeCampo} px-4`}
        />
      </div>

      <div className="space-y-1.5 col-span-2 sm:col-span-1">
        <label htmlFor={`${id}-celular`} className="block text-sm font-medium text-slate-700">
          Celular
        </label>
        <input
          id={`${id}-celular`}
          type="text"
          inputMode="numeric"
          autoComplete="tel-local"
          value={formatarCelular(telefone.celular)}
          onChange={(e) => onChange({ ...telefone, celular: somenteDigitos(e.target.value, 9) })}
          placeholder="91234-5678"
          className={`${classeCampo} px-4`}
        />
      </div>
    </div>
  )
}
