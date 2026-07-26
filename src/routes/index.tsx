import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type EJRow = {
  id: string;
  nome: string;
  presente: boolean;
  meta: number;
  faturamento: number;
  farol: string | null;
  aposta_verde: string | null;
  aposta_sde: string | null;
  alcancou: boolean;
  guardioes: { nome: string } | null;
  squads: { nome: string } | null;
};

const ejsQuery = queryOptions({
  queryKey: ["ejs"],
  queryFn: async (): Promise<EJRow[]> => {
    const { data, error } = await supabase
      .from("ejs")
      .select(
        "id, nome, presente, meta, faturamento, farol, aposta_verde, aposta_sde, alcancou, guardioes(nome), squads(nome)",
      )
      .order("nome");
    if (error) throw error;
    return (data ?? []) as unknown as EJRow[];
  },
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Corrida ENEJ — Dashboard de EJs" },
      {
        name: "description",
        content:
          "Acompanhamento em tempo real das EJs das Corrida : EJSs da Rede, faróis de performance, metas e apostas por squad e guardião.",
      },
      { property: "og:title", content: "Corrida ENEJ — Dashboard de EJs" },
      {
        property: "og:description",
        content: "Acompanhamento em tempo real das EJs das Corrida : EJSs da Rede, faróis de performance, metas e apostas por squad e guardião.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(ejsQuery),
  component: Dashboard,
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center text-destructive p-6">
      Erro ao carregar: {error.message}
    </div>
  ),
});

const FAROL_ORDER = ["AZUL", "VERDE", "AMARELO", "VERMELHO", "ZERADA", "RESERVA"] as const;

function farolClasses(farol: string | null): string {
  const f = (farol ?? "").toUpperCase();
  switch (f) {
    case "AZUL":
      return "bg-farol-azul text-white";
    case "VERDE":
      return "bg-farol-verde text-white";
    case "AMARELO":
      return "bg-farol-amarelo text-primary-foreground";
    case "VERMELHO":
      return "bg-farol-vermelho text-white";
    case "RESERVA":
      return "bg-farol-reserva text-white";
    default:
      return "bg-farol-zerada text-white";
  }
}

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function Dashboard() {
  const { data: ejs } = useSuspenseQuery(ejsQuery);
  const [squad, setSquad] = useState<string>("all");
  const [guardiao, setGuardiao] = useState<string>("all");
  const [farol, setFarol] = useState<string>("all");
  const [q, setQ] = useState("");

  const squads = useMemo(
    () => Array.from(new Set(ejs.map((e) => e.squads?.nome).filter(Boolean))).sort() as string[],
    [ejs],
  );
  const guardioes = useMemo(
    () =>
      Array.from(new Set(ejs.map((e) => e.guardioes?.nome).filter(Boolean))).sort() as string[],
    [ejs],
  );

  const filtered = useMemo(() => {
    return ejs.filter((e) => {
      if (squad !== "all" && e.squads?.nome !== squad) return false;
      if (guardiao !== "all" && e.guardioes?.nome !== guardiao) return false;
      if (farol !== "all" && (e.farol ?? "").toUpperCase() !== farol) return false;
      if (q && !e.nome.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [ejs, squad, guardiao, farol, q]);

  const stats = useMemo(() => {
    const totalMeta = filtered.reduce((s, e) => s + Number(e.meta), 0);
    const totalFat = filtered.reduce((s, e) => s + Number(e.faturamento), 0);
    const byFarol = FAROL_ORDER.map((f) => ({
      farol: f,
      count: filtered.filter((e) => (e.farol ?? "").toUpperCase() === f).length,
    }));
    return {
      totalMeta,
      totalFat,
      pct: totalMeta ? (totalFat / totalMeta) * 100 : 0,
      byFarol,
    };
  }, [filtered]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex items-baseline justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">
                RJ76 · Corrida para o ENEJ
              </p>
              <h1 className="text-3xl md:text-4xl font-bold mt-2">Dashboard de Empresas Juniores</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {ejs.length} EJs cadastradas · 6 squads · 23 guardiões
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Atingimento geral (filtro atual)
              </p>
              <p className="text-3xl font-bold text-primary">{stats.pct.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">
                {fmtBRL(stats.totalFat)} / {fmtBRL(stats.totalMeta)}
              </p>
            </div>
          </div>

          {/* Farol stats */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-6">
            {stats.byFarol.map((s) => (
              <div
                key={s.farol}
                className={`rounded-lg px-3 py-3 ${farolClasses(s.farol)} shadow-sm`}
              >
                <p className="text-[10px] uppercase tracking-wider opacity-90">{s.farol}</p>
                <p className="text-2xl font-bold">{s.count}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Filters */}
      <section className="mx-auto max-w-7xl px-6 py-5 flex flex-wrap gap-3 border-b border-border/60">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar EJ…"
          className="bg-input text-foreground rounded-md px-3 py-2 text-sm border border-border/60 outline-none focus:border-primary min-w-56"
        />
        <select
          value={squad}
          onChange={(e) => setSquad(e.target.value)}
          className="bg-input text-foreground rounded-md px-3 py-2 text-sm border border-border/60 outline-none focus:border-primary"
        >
          <option value="all">Todos os Squads</option>
          {squads.map((s) => (
            <option key={s} value={s}>
              Squad {s}
            </option>
          ))}
        </select>
        <select
          value={guardiao}
          onChange={(e) => setGuardiao(e.target.value)}
          className="bg-input text-foreground rounded-md px-3 py-2 text-sm border border-border/60 outline-none focus:border-primary"
        >
          <option value="all">Todos os Guardiões</option>
          {guardioes.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={farol}
          onChange={(e) => setFarol(e.target.value)}
          className="bg-input text-foreground rounded-md px-3 py-2 text-sm border border-border/60 outline-none focus:border-primary"
        >
          <option value="all">Todos os faróis</option>
          {FAROL_ORDER.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <span className="ml-auto text-sm text-muted-foreground self-center">
          {filtered.length} EJ{filtered.length === 1 ? "" : "s"}
        </span>
      </section>

      {/* Table */}
      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="rounded-xl border border-border/60 overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Empresa Júnior</th>
                  <th className="text-left px-3 py-3 font-semibold">Squad</th>
                  <th className="text-left px-3 py-3 font-semibold">Guardião</th>
                  <th className="text-center px-3 py-3 font-semibold">Farol</th>
                  <th className="text-right px-3 py-3 font-semibold">Meta</th>
                  <th className="text-right px-3 py-3 font-semibold">Faturamento</th>
                  <th className="text-right px-3 py-3 font-semibold">%</th>
                  <th className="text-center px-3 py-3 font-semibold">Aposta</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const pct = e.meta > 0 ? (Number(e.faturamento) / Number(e.meta)) * 100 : 0;
                  return (
                    <tr
                      key={e.id}
                      className="border-t border-border/40 hover:bg-accent/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {e.alcancou && (
                            <span title="Alcançou" className="text-primary">
                              ★
                            </span>
                          )}
                          <span className="font-medium">{e.nome}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{e.squads?.nome ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {e.guardioes?.nome ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider ${farolClasses(e.farol)}`}
                        >
                          {(e.farol ?? "—").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{fmtBRL(Number(e.meta))}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {fmtBRL(Number(e.faturamento))}
                      </td>
                      <td
                        className={`px-3 py-3 text-right tabular-nums font-semibold ${pct >= 100 ? "text-farol-verde" : pct >= 66 ? "text-primary" : "text-muted-foreground"}`}
                      >
                        {pct.toFixed(0)}%
                      </td>
                      <td className="px-3 py-3 text-center">
                        {e.aposta_verde === "SIM" && (
                          <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold bg-farol-verde/20 text-farol-verde mr-1">
                            VERDE
                          </span>
                        )}
                        {e.aposta_sde === "SUBIR" && (
                          <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold bg-farol-azul/20 text-farol-azul mr-1">
                            SUBIR
                          </span>
                        )}
                        {e.aposta_sde === "CAIR" && (
                          <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold bg-farol-vermelho/20 text-farol-vermelho mr-1">
                            CAIR
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma EJ encontrada com esses filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <footer className="mx-auto max-w-7xl px-6 py-6 text-xs text-muted-foreground">
        Passo 1 concluído · próximos passos: checkpoints semanais e edição por guardião.
      </footer>
    </div>
  );
}
