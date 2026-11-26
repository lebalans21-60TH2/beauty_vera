import { useMemo, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface MultiSelectFilterGroupProps {
  label: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  defaultOpen?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  matchMode?: 'any' | 'all';
  onMatchModeChange?: (mode: 'any' | 'all') => void;
}

export function MultiSelectFilterGroup({
  label,
  options,
  selected,
  onToggle,
  onClear,
  defaultOpen = false,
  searchable = false,
  searchPlaceholder = 'Lọc nhanh...',
  matchMode,
  onMatchModeChange,
}: MultiSelectFilterGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [localQuery, setLocalQuery] = useState('');

  const visibleOptions = useMemo(() => {
    const q = localQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, localQuery]);

  return (
    <div className="border-t border-[#CFD4DC] pt-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="flex-1 flex items-center justify-between gap-2 py-1 text-left group"
        >
          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500 group-hover:text-[#090D16] transition-colors flex items-center gap-2">
            <span>{label}</span>
            {selected.length > 0 && (
              <span className="text-[#C81E3A] font-semibold tabular-nums">
                ({selected.length})
              </span>
            )}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${
              open ? 'rotate-180 text-[#090D16]' : ''
            }`}
          />
        </button>

        {selected.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-mono text-zinc-500 hover:text-[#C81E3A] underline underline-offset-2 shrink-0"
          >
            Bỏ chọn
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2.5 space-y-2">
          {matchMode && onMatchModeChange && selected.length > 1 && (
            <div className="flex items-center justify-between gap-2 bg-[#F1F3F6] border border-[#CFD4DC] p-1 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => onMatchModeChange('any')}
                className={`flex-1 py-1 text-center transition-colors ${
                  matchMode === 'any'
                    ? 'bg-[#090D16] text-white font-medium'
                    : 'text-zinc-600 hover:text-[#090D16]'
                }`}
              >
                Khớp bất kỳ (OR)
              </button>
              <button
                type="button"
                onClick={() => onMatchModeChange('all')}
                className={`flex-1 py-1 text-center transition-colors ${
                  matchMode === 'all'
                    ? 'bg-[#090D16] text-white font-medium'
                    : 'text-zinc-600 hover:text-[#090D16]'
                }`}
              >
                Chứa tất cả (AND)
              </button>
            </div>
          )}

          {searchable && options.length > 5 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-[#CFD4DC] bg-[#F1F3F6] focus:bg-white focus:outline-none focus:border-[#090D16]"
              />
            </div>
          )}

          <div className="max-h-48 overflow-y-auto divide-y divide-[#CFD4DC]/60 border border-[#CFD4DC] bg-[#F1F3F6]/50">
            {visibleOptions.length === 0 ? (
              <p className="px-3 py-2 text-xs text-zinc-500">Không có tùy chọn phù hợp.</p>
            ) : (
              visibleOptions.map((opt) => {
                const isSelected = selected.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    onClick={() => onToggle(opt.value)}
                    className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left text-xs transition-colors ${
                      isSelected
                        ? 'bg-white text-[#090D16] font-medium'
                        : 'text-zinc-700 hover:bg-white hover:text-[#090D16]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-3.5 h-3.5 border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-[#C81E3A] border-[#C81E3A] text-white'
                            : 'bg-white border-zinc-400'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </span>
                      <span className="truncate">{opt.label}</span>
                    </span>
                    {opt.count !== undefined && (
                      <span className="font-mono text-[11px] text-zinc-500 tabular-nums shrink-0">
                        {opt.count}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
