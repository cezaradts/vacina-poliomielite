import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import raw from "../data/vacinacao.json";

type Row = {
  code: string;
  name: string;
  uf: string;
  months: Record<string, { v: number; p: number }>;
};

const dataset = raw as { months: string[]; rows: Row[] };
const monthList = dataset.months;
const data = dataset.rows;

const monthLabel = (m: string) => {
  const [y, mm] = m.split("-");
  const names = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return `${names[Number(mm) - 1]}/${y}`;
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cobertura Vacinal Poliomielite 2026 por Município" },
      {
        name: "description",
        content:
          "Painel com população, doses aplicadas e percentual de cobertura vacinal da Poliomielite  em 2026 nos municípios brasileiros.",
      },
      { property: "og:title", content: "Cobertura Vacinal Poliomielite 2026 por Município" },
      {
        property: "og:description",
        content:
          "Painel com população, doses aplicadas e percentual de cobertura vacinal da Poliomienite em 2026 nos municípios brasileiros.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const nf = new Intl.NumberFormat("pt-BR");

type Tab = "todos" | "maior" | "menor";

const tabs: { id: Tab; label: string }[] = [
  { id: "todos", label: "Todos os municípios" },
  { id: "maior", label: "Maior cobertura vacinal" },
  { id: "menor", label: "Menor cobertura vacinal" },
];

export function Index() {
  const [tab, setTab] = useState<Tab>("todos");
  const [query, setQuery] = useState("");
  const [minPop, setMinPop] = useState(0);
  const [month, setMonth] = useState<string>("todos");

  const base = useMemo(() => {
    const pick = (r: Row) => {
      if (month === "todos") {
        let p = 0;
        let v = 0;
        for (const m of monthList) {
          p += r.months[m]?.p ?? 0;
          v += r.months[m]?.v ?? 0;
        }
        return { p, v };
      }
      return { p: r.months[month]?.p ?? 0, v: r.months[month]?.v ?? 0 };
    };
    return data.map((r) => {
      const { p, v } = pick(r);
      return {
        code: r.code,
        name: r.name,
        uf: r.uf,
        population: p,
        vaccinated: v,
        coverage: p > 0 ? (v / p) * 100 : 0,
      };
    });
  }, [month]);

  const totals = useMemo(() => {
    const pop = base.reduce((a, r) => a + r.population, 0);
    const vac = base.reduce((a, r) => a + r.vaccinated, 0);
    return { pop, vac, cov: pop > 0 ? (vac / pop) * 100 : 0 };
  }, [base]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = base.filter(
      (r) =>
        r.population >= minPop &&
        (q === "" || r.name.toLowerCase().includes(q) || r.uf.toLowerCase() === q),
    );
    if (tab === "maior") list = [...list].sort((a, b) => b.coverage - a.coverage);
    else if (tab === "menor") list = [...list].sort((a, b) => a.coverage - b.coverage);
    else list = [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return list;
  }, [tab, query, minPop, base]);

  const shown = rows.slice(0, 200);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Poliomielite ·{" "}
            {month === "todos" ? "jan–jun 2026 (acumulado)" : monthLabel(month)}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Cobertura vacinal por município
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Dados de população-alvo, doses aplicadas e percentual de cobertura dos 5.571
            municípios brasileiros.
          </p>

          <dl className="mt-8 grid gap-4 sm:grid-cols-3">
            <Stat label="Municípios" value={nf.format(data.length)} />
            <Stat label="População-alvo" value={nf.format(totals.pop)} />
            <Stat label="Cobertura nacional" value={`${totals.cov.toFixed(1)}%`} />
          </dl>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Mês
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-md border border-input bg-card px-2 py-2 text-sm text-foreground"
            >
              <option value="todos">Todos (acumulado)</option>
              {monthList.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar município ou UF (ex.: SP)"
            className="w-full max-w-xs rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring sm:w-auto"
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            População mínima
            <select
              value={minPop}
              onChange={(e) => setMinPop(Number(e.target.value))}
              className="rounded-md border border-input bg-card px-2 py-2 text-sm text-foreground"
            >
              {[0, 100, 1000, 5000, 20000].map((v) => (
                <option key={v} value={v}>
                  {v === 0 ? "sem filtro" : nf.format(v)}
                </option>
              ))}
            </select>
          </label>
          <span className="text-sm text-muted-foreground">
            {nf.format(rows.length)} resultados
          </span>
        </div>

        <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Município</th>
                <th className="px-4 py-3 font-medium">UF</th>
                <th className="px-4 py-3 text-right font-medium">População</th>
                <th className="px-4 py-3 text-right font-medium">Vacinados</th>
                <th className="px-4 py-3 text-right font-medium">% de vacinação</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.code} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.uf}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {nf.format(r.population)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {nf.format(r.vaccinated)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
                        r.coverage >= 95
                          ? "bg-primary/10 text-primary"
                          : r.coverage >= 70
                            ? "bg-accent text-accent-foreground"
                            : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {r.coverage.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > shown.length && (
          <p className="mt-3 text-xs text-muted-foreground">
            Exibindo os 200 primeiros de {nf.format(rows.length)} municípios. Refine a busca
            para ver outros.
          </p>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
