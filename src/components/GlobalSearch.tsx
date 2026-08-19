import { useState, useRef, useEffect } from 'react';
import { Search, Users, Truck, Wrench, Package, DollarSign, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useNav } from '@/contexts/NavContext';

interface SearchResult {
  id: string;
  type: string;
  label: string;
  sublabel: string;
  page: 'associados' | 'rastreadores' | 'ordens' | 'estoque' | 'financeiro' | 'base-tecnica';
}

const typeConfig: Record<string, { icon: typeof Search; page: SearchResult['page'] }> = {
  associado: { icon: Users, page: 'associados' },
  rastreador: { icon: Truck, page: 'rastreadores' },
  ordem: { icon: Wrench, page: 'ordens' },
  estoque: { icon: Package, page: 'estoque' },
  financeiro: { icon: DollarSign, page: 'financeiro' },
  base: { icon: FileText, page: 'base-tecnica' },
};

/**
 * Removes every character that PostgREST treats as filter syntax, so a search
 * term can never inject extra conditions into the query it is embedded in.
 * Also removes the LIKE wildcards, which are matched literally by intent here.
 */
function sanitizeFilterTerm(raw: string): string {
  return raw
    .replace(/[(),.*%\\"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { setPage } = useNav();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      // `or()` takes a filter EXPRESSION, so the raw term must never be spliced
      // into it: a comma, dot, parenthesis or wildcard would be parsed as filter
      // syntax rather than as text to match. Strip those characters first.
      const safe = sanitizeFilterTerm(query);
      if (!safe) {
        setResults([]);
        setLoading(false);
        return;
      }
      const [a, r, o, e, f, b] = await Promise.all([
        supabase.from('associados').select('id, nome, plano').ilike('nome', `%${safe}%`).limit(5),
        supabase.from('rastreadores').select('id, imei, veiculo_placa').or(`imei.ilike.%${safe}%,veiculo_placa.ilike.%${safe}%`).limit(5),
        supabase.from('ordens_servico').select('id, numero, tipo').or(`numero.ilike.%${safe}%,descricao.ilike.%${safe}%`).limit(5),
        supabase.from('estoque').select('id, nome, categoria').ilike('nome', `%${safe}%`).limit(5),
        supabase.from('financeiro').select('id, descricao, valor').ilike('descricao', `%${safe}%`).limit(5),
        supabase.from('base_tecnica').select('id, titulo, categoria').ilike('titulo', `%${safe}%`).limit(5),
      ]);

      const all: SearchResult[] = [];
      a.data?.forEach((x) => all.push({ id: x.id, type: 'associado', label: x.nome, sublabel: x.plano, page: 'associados' }));
      r.data?.forEach((x) => all.push({ id: x.id, type: 'rastreador', label: x.imei, sublabel: x.veiculo_placa || '-', page: 'rastreadores' }));
      o.data?.forEach((x) => all.push({ id: x.id, type: 'ordem', label: `OS ${x.numero}`, sublabel: x.tipo, page: 'ordens' }));
      e.data?.forEach((x) => all.push({ id: x.id, type: 'estoque', label: x.nome, sublabel: x.categoria, page: 'estoque' }));
      f.data?.forEach((x) => all.push({ id: x.id, type: 'financeiro', label: x.descricao, sublabel: `R$ ${x.valor}`, page: 'financeiro' }));
      b.data?.forEach((x) => all.push({ id: x.id, type: 'base', label: x.titulo, sublabel: x.categoria, page: 'base-tecnica' }));
      setResults(all);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div ref={ref} className="relative flex-1 max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar em todo o sistema..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all"
        />
      </div>
      {open && (query.length >= 2) && (
        <div className="absolute top-full mt-2 w-full card p-2 max-h-80 overflow-y-auto z-50 animate-fadeIn">
          {loading ? (
            <p className="text-sm text-slate-400 px-3 py-4 text-center">Buscando...</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-slate-400 px-3 py-4 text-center">Nenhum resultado encontrado</p>
          ) : (
            results.map((r) => {
              const cfg = typeConfig[r.type];
              const Icon = cfg.icon;
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => { setPage(r.page); setOpen(false); setQuery(''); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                >
                  <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{r.label}</p>
                    <p className="text-xs text-slate-400 truncate">{r.sublabel}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
