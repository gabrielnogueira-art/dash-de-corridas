import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowUpDown, ArrowUp, ArrowDown, X, RotateCcw, Filter, Calendar, Edit3, Star, CheckCircle, Activity, HeartHandshake, Smile, Layers } from "lucide-react";
import { EJProfileModal, computeFarol, farolClasses, fmtBRL, parseEjMetrics, FAROL_ORDER, MESES_NOMES, EJData } from "@/components/EJProfileModal";
import { computeIndex, clusterFromIndex, type ClusterMode } from "@/lib/cluster";

type EJRow = EJData;

const ejsQuery = queryOptions({
  queryKey: ["ejs"],
  queryFn: async (): Promise<EJRow[]> => {
    const { data, error } = await supabase
      .from("ejs")
      .select(
        "id, nome, presente, meta, faturamento, fat_colaborativo, farol, aposta_verde, aposta_sde, alcancou, guardiao_id, squad_id, informacoes, guardioes(id, nome), squads(id, nome)",
      )
      .order("nome");
    if (error) throw error;
    return (data ?? []) as unknown as EJRow[];
  },
});

const squadsQuery = queryOptions({
  queryKey: ["squads"],
  queryFn: async () => {
    const { data, error } = await supabase.from("squads").select("id, nome").order("nome");
    if (error) throw error;
    return data ?? [];
  },
});

const guardioesQuery = queryOptions({
  queryKey: ["guardioes"],
  queryFn: async () => {
    const { data, error } = await supabase.from("guardioes").select("id, nome").order("nome");
    if (error) throw error;
    return data ?? [];
  },
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Corrida ENEJ — Dashboard, ECM & CSAT" },
      {
        name: "description",
        content:
          "Acompanhamento em tempo real das EJs das Corrida ENEJ, com faróis de performance, engajamento com o MEJ (ECM) e satisfação de clientes (CSAT).",
      },
      { property: "og:title", content: "Corrida ENEJ — Dashboard, ECM & CSAT" },
      {
        property: "og:description",
        content: "Acompanhamento em tempo real das EJs das Corrida ENEJ, com faróis de performance, engajamento com o MEJ (ECM) e satisfação de clientes (CSAT).",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(ejsQuery),
  component: Dashboard,
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center text-destructive p-6">
      Erro ao carregar dados: {error.message}
    </div>
  ),
});

function Dashboard() {
  const queryClient = useQueryClient();
  const { data: ejs } = useSuspenseQuery(ejsQuery);
  const { data: allSquads = [] } = useQuery(squadsQuery);
  const { data: allGuardioes = [] } = useQuery(guardioesQuery);

  // Month Reference for Farol (Defaults to Current Month 1-12)
  const [currentMonth, setCurrentMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [clusterMode, setClusterMode] = useState<ClusterMode>("ANUAL");
  const [filterCluster, setFilterCluster] = useState<string>("all");

  // Profile Modal State
  const [selectedEj, setSelectedEj] = useState<EJRow | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Column Filter States
  const [filterNome, setFilterNome] = useState("");
  const [filterSquad, setFilterSquad] = useState("all");
  const [filterGuardiao, setFilterGuardiao] = useState("all");
  const [filterFarol, setFilterFarol] = useState("all");
  const [filterMetaMin, setFilterMetaMin] = useState("");
  const [filterFatMin, setFilterFatMin] = useState("");
  const [filterPct, setFilterPct] = useState("all");
  const [filterAposta, setFilterAposta] = useState("all");
  const [filterAlcancou, setFilterAlcancou] = useState(false);
  const [filterEcmMin, setFilterEcmMin] = useState("");
  const [filterCsatMin, setFilterCsatMin] = useState("");

  // Sorting States
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Dynamic EJs with updated Farol calculation and parsed ECM/CSAT
  const ejsParsed = useMemo(() => {
    return ejs.map((e) => {
      const computedFarol = computeFarol(e.meta, e.faturamento, currentMonth);
      const parsed = parseEjMetrics(e.informacoes ?? null, e.ecm, e.csat);
      const inputs = {
        faturamento: Number(e.faturamento) || 0,
        fatColaborativo: Number(e.fat_colaborativo) || 0,
        ecm: parsed.ecm,
        csat: parsed.csat,
        currentMonth,
      };
      const idxAnual = computeIndex("ANUAL", inputs);
      const idxEnej = computeIndex("ENEJ", inputs);
      return {
        ...e,
        farolCalculado: computedFarol,
        ecm: parsed.ecm,
        csat: parsed.csat,
        indexAnual: idxAnual,
        indexEnej: idxEnej,
        clusterAnual: clusterFromIndex(idxAnual),
        clusterEnej: clusterFromIndex(idxEnej),
      };
    });
  }, [ejs, currentMonth]);

  const squads = useMemo(
    () => Array.from(new Set(ejs.map((e) => e.squads?.nome).filter(Boolean))).sort() as string[],
    [ejs],
  );
  const guardioes = useMemo(
    () =>
      Array.from(new Set(ejs.map((e) => e.guardioes?.nome).filter(Boolean))).sort() as string[],
    [ejs],
  );

  const hasActiveFilters = useMemo(() => {
    return (
      filterNome !== "" ||
      filterSquad !== "all" ||
      filterGuardiao !== "all" ||
      filterFarol !== "all" ||
      filterMetaMin !== "" ||
      filterFatMin !== "" ||
      filterPct !== "all" ||
      filterAposta !== "all" ||
      filterAlcancou ||
      filterEcmMin !== "" ||
      filterCsatMin !== "" ||
      filterCluster !== "all"
    );
  }, [
    filterNome,
    filterSquad,
    filterGuardiao,
    filterFarol,
    filterMetaMin,
    filterFatMin,
    filterPct,
    filterAposta,
    filterAlcancou,
    filterEcmMin,
    filterCsatMin,
    filterCluster,
  ]);

  const clearFilters = () => {
    setFilterNome("");
    setFilterSquad("all");
    setFilterGuardiao("all");
    setFilterFarol("all");
    setFilterMetaMin("");
    setFilterFatMin("");
    setFilterPct("all");
    setFilterAposta("all");
    setFilterAlcancou(false);
    setFilterEcmMin("");
    setFilterCsatMin("");
  };

  const filtered = useMemo(() => {
    return ejsParsed.filter((e) => {
      if (filterNome && !e.nome.toLowerCase().includes(filterNome.toLowerCase())) return false;
      if (filterSquad !== "all" && e.squads?.nome !== filterSquad) return false;
      if (filterGuardiao !== "all" && e.guardioes?.nome !== filterGuardiao) return false;
      if (filterFarol !== "all" && e.farolCalculado !== filterFarol) return false;
      if (filterAlcancou && !e.alcancou) return false;

      if (filterMetaMin !== "") {
        const minM = Number(filterMetaMin);
        if (!isNaN(minM) && Number(e.meta) < minM) return false;
      }

      if (filterFatMin !== "") {
        const minF = Number(filterFatMin);
        if (!isNaN(minF) && Number(e.faturamento) < minF) return false;
      }

      const pct = e.meta > 0 ? (Number(e.faturamento) / Number(e.meta)) * 100 : 0;
      if (filterPct === ">=100" && pct < 100) return false;
      if (filterPct === "66-99" && (pct < 66 || pct >= 100)) return false;
      if (filterPct === "<66" && pct >= 66) return false;

      if (filterAposta !== "all") {
        if (filterAposta === "VERDE" && e.aposta_verde !== "SIM") return false;
        if (filterAposta === "SUBIR" && e.aposta_sde !== "SUBIR") return false;
        if (filterAposta === "CAIR" && e.aposta_sde !== "CAIR") return false;
      }

      if (filterEcmMin !== "") {
        const minEcm = Number(filterEcmMin);
        if (!isNaN(minEcm) && (e.ecm === null || e.ecm === undefined || e.ecm < minEcm)) return false;
      }

      if (filterCsatMin !== "") {
        const minCsat = Number(filterCsatMin);
        if (!isNaN(minCsat) && (e.csat === null || e.csat === undefined || e.csat < minCsat)) return false;
      }

      return true;
    });
  }, [
    ejsParsed,
    filterNome,
    filterSquad,
    filterGuardiao,
    filterFarol,
    filterMetaMin,
    filterFatMin,
    filterPct,
    filterAposta,
    filterAlcancou,
    filterEcmMin,
    filterCsatMin,
  ]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (sortCol) {
        case "nome":
          valA = a.nome.toLowerCase();
          valB = b.nome.toLowerCase();
          break;
        case "squad":
          valA = a.squads?.nome ?? "";
          valB = b.squads?.nome ?? "";
          break;
        case "guardiao":
          valA = a.guardioes?.nome ?? "";
          valB = b.guardioes?.nome ?? "";
          break;
        case "farol":
          valA = FAROL_ORDER.indexOf(a.farolCalculado as any);
          valB = FAROL_ORDER.indexOf(b.farolCalculado as any);
          if (valA === -1) valA = 999;
          if (valB === -1) valB = 999;
          break;
        case "meta":
          valA = Number(a.meta);
          valB = Number(b.meta);
          break;
        case "faturamento":
          valA = Number(a.faturamento);
          valB = Number(b.faturamento);
          break;
        case "pct":
          valA = a.meta > 0 ? (Number(a.faturamento) / Number(a.meta)) * 100 : 0;
          valB = b.meta > 0 ? (Number(b.faturamento) / Number(b.meta)) * 100 : 0;
          break;
        case "ecm":
          valA = a.ecm ?? -1;
          valB = b.ecm ?? -1;
          break;
        case "csat":
          valA = a.csat ?? -1;
          valB = b.csat ?? -1;
          break;
        default:
          return 0;
      }

      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortCol, sortDir]);

  const handleSort = (colKey: string) => {
    if (sortCol === colKey) {
      if (sortDir === "asc") setSortDir("desc");
      else {
        setSortCol(null);
        setSortDir("asc");
      }
    } else {
      setSortCol(colKey);
      setSortDir("asc");
    }
  };

  const renderSortIcon = (colKey: string) => {
    if (sortCol !== colKey) {
      return <ArrowUpDown className="w-3 h-3 text-muted-foreground/50 inline-block ml-1" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 text-primary inline-block ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-primary inline-block ml-1" />
    );
  };

  const stats = useMemo(() => {
    const totalMeta = filtered.reduce((s, e) => s + Number(e.meta), 0);
    const totalFat = filtered.reduce((s, e) => s + Number(e.faturamento), 0);
    const byFarol = FAROL_ORDER.map((f) => ({
      farol: f,
      count: filtered.filter((e) => e.farolCalculado === f).length,
    }));

    const ecmList = filtered.map((e) => e.ecm).filter((v): v is number => v !== null && v !== undefined);
    const avgEcm = ecmList.length > 0 ? ecmList.reduce((a, b) => a + b, 0) / ecmList.length : null;

    const csatList = filtered.map((e) => e.csat).filter((v): v is number => v !== null && v !== undefined);
    const avgCsat = csatList.length > 0 ? csatList.reduce((a, b) => a + b, 0) / csatList.length : null;

    return {
      totalMeta,
      totalFat,
      pct: totalMeta ? (totalFat / totalMeta) * 100 : 0,
      byFarol,
      avgEcm,
      avgCsat,
      countWithEcm: ecmList.length,
      countWithCsat: csatList.length,
    };
  }, [filtered]);

  const handleOpenProfile = (ej: EJRow) => {
    setSelectedEj(ej);
    setIsProfileOpen(true);
  };

  const handleSaveSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["ejs"] });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header Banner */}
      <header className="border-b border-border/60 bg-card/40">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-primary font-bold flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 fill-primary" /> RJ76 · Corrida para o ENEJ
              </p>
              <h1 className="text-3xl md:text-4xl font-extrabold mt-2 tracking-tight">
                Dashboard de Empresas Juniores
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {ejs.length} EJs cadastradas · Clique em qualquer linha para editar o Perfil (Meta, Faturamento, ECM & CSAT)
              </p>
            </div>

            <div className="flex flex-col items-end gap-3">
              {/* Reference Month Selector */}
              <div className="flex items-center gap-2 bg-secondary/80 border border-border/80 rounded-xl px-3 py-1.5 text-xs">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground font-medium">Mês de Referência do Farol:</span>
                <select
                  value={currentMonth}
                  onChange={(e) => setCurrentMonth(Number(e.target.value))}
                  className="bg-background text-foreground font-bold rounded px-2 py-1 outline-none border border-border/60 focus:border-primary"
                >
                  {MESES_NOMES.map((nome, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      Mês {idx + 1} ({nome})
                    </option>
                  ))}
                </select>
              </div>

              {/* Total Summary */}
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                  Atingimento Geral (filtro atual)
                </p>
                <p className="text-3xl font-extrabold text-primary">{stats.pct.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">
                  {fmtBRL(stats.totalFat)} / {fmtBRL(stats.totalMeta)}
                </p>
              </div>
            </div>
          </div>

          {/* Indicators Overview Row (Farol Stats + ECM & CSAT Summary) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 mt-6">
            {stats.byFarol.map((s) => (
              <div
                key={s.farol}
                className={`rounded-xl px-3 py-2.5 ${farolClasses(s.farol)} shadow-md cursor-pointer hover:opacity-90 transition-opacity`}
                onClick={() => setFilterFarol(filterFarol === s.farol ? "all" : s.farol)}
                title={`Filtrar por ${s.farol}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[9px] uppercase tracking-wider font-extrabold opacity-90">{s.farol}</p>
                  {filterFarol === s.farol && <CheckCircle className="w-3 h-3" />}
                </div>
                <p className="text-xl font-black mt-0.5">{s.count}</p>
              </div>
            ))}

            {/* ECM Summary Card */}
            <div className="rounded-xl px-3 py-2.5 bg-card border border-border/80 shadow-md">
              <div className="flex items-center justify-between text-muted-foreground text-[10px] uppercase tracking-wider font-bold">
                <span>Média ECM</span>
                <Activity className="w-3 h-3 text-primary" />
              </div>
              <p className="text-xl font-black text-foreground mt-0.5">
                {stats.avgEcm !== null ? `${stats.avgEcm.toFixed(1)}%` : "—"}
              </p>
              <p className="text-[9px] text-muted-foreground">Engajamento MEJ</p>
            </div>

            {/* CSAT Summary Card */}
            <div className="rounded-xl px-3 py-2.5 bg-card border border-border/80 shadow-md">
              <div className="flex items-center justify-between text-muted-foreground text-[10px] uppercase tracking-wider font-bold">
                <span>Média CSAT</span>
                <Smile className="w-3 h-3 text-farol-verde" />
              </div>
              <p className="text-xl font-black text-foreground mt-0.5">
                {stats.avgCsat !== null ? stats.avgCsat.toFixed(1) : "—"}
              </p>
              <p className="text-[9px] text-muted-foreground">Satisfação Cliente</p>
            </div>
          </div>
        </div>
      </header>

      {/* Control Bar */}
      <section className="mx-auto max-w-7xl px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/60">
        <div className="flex items-center gap-2 text-sm">
          <Filter className="w-4 h-4 text-primary" />
          <span className="font-semibold text-foreground">Filtros por Coluna</span>
          <span className="text-xs text-muted-foreground">
            ({filtered.length} de {ejs.length} EJ{ejs.length === 1 ? "" : "s"} exibidas)
          </span>
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Limpar todos os filtros
          </button>
        )}
      </section>

      {/* Main Table */}
      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="rounded-xl border border-border/60 overflow-hidden bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground border-b border-border/60">
                {/* Column Titles */}
                <tr>
                  <th
                    className="text-left px-4 py-3 font-semibold cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => handleSort("nome")}
                  >
                    Empresa Júnior {renderSortIcon("nome")}
                  </th>
                  <th
                    className="text-left px-3 py-3 font-semibold cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => handleSort("squad")}
                  >
                    Squad {renderSortIcon("squad")}
                  </th>
                  <th
                    className="text-left px-3 py-3 font-semibold cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => handleSort("guardiao")}
                  >
                    Guardião {renderSortIcon("guardiao")}
                  </th>
                  <th
                    className="text-center px-3 py-3 font-semibold cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => handleSort("farol")}
                  >
                    Farol {renderSortIcon("farol")}
                  </th>
                  <th
                    className="text-right px-3 py-3 font-semibold cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => handleSort("meta")}
                  >
                    Meta {renderSortIcon("meta")}
                  </th>
                  <th
                    className="text-right px-3 py-3 font-semibold cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => handleSort("faturamento")}
                  >
                    Faturamento {renderSortIcon("faturamento")}
                  </th>
                  <th
                    className="text-right px-3 py-3 font-semibold cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => handleSort("pct")}
                  >
                    % {renderSortIcon("pct")}
                  </th>
                  <th
                    className="text-center px-3 py-3 font-semibold cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => handleSort("ecm")}
                  >
                    ECM (%) {renderSortIcon("ecm")}
                  </th>
                  <th
                    className="text-center px-3 py-3 font-semibold cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => handleSort("csat")}
                  >
                    CSAT {renderSortIcon("csat")}
                  </th>
                  <th className="text-center px-3 py-3 font-semibold">Aposta</th>
                  <th className="text-center px-3 py-3 font-semibold">Perfil</th>
                </tr>

                {/* Per-column Filters */}
                <tr className="bg-muted/40 border-t border-border/40">
                  {/* Empresa Júnior filter */}
                  <th className="px-3 py-2 text-left font-normal normal-case">
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={filterNome}
                          onChange={(e) => setFilterNome(e.target.value)}
                          placeholder="Filtrar EJ…"
                          className="w-full bg-background text-foreground text-xs rounded border border-border/60 px-2 py-1 pr-6 outline-none focus:border-primary"
                        />
                        {filterNome && (
                          <button
                            onClick={() => setFilterNome("")}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => setFilterAlcancou(!filterAlcancou)}
                        title={filterAlcancou ? "Mostrando apenas ★ Bateu Meta" : "Filtrar apenas ★ Bateu Meta"}
                        className={`p-1 rounded border text-xs transition-colors ${
                          filterAlcancou
                            ? "bg-primary/20 text-primary border-primary font-bold"
                            : "bg-background text-muted-foreground border-border/60 hover:text-foreground"
                        }`}
                      >
                        ★
                      </button>
                    </div>
                  </th>

                  {/* Squad filter */}
                  <th className="px-2 py-2 text-left font-normal normal-case">
                    <select
                      value={filterSquad}
                      onChange={(e) => setFilterSquad(e.target.value)}
                      className="w-full bg-background text-foreground text-xs rounded border border-border/60 px-2 py-1 outline-none focus:border-primary"
                    >
                      <option value="all">Todos</option>
                      {squads.map((s) => (
                        <option key={s} value={s}>
                          Squad {s}
                        </option>
                      ))}
                    </select>
                  </th>

                  {/* Guardião filter */}
                  <th className="px-2 py-2 text-left font-normal normal-case">
                    <select
                      value={filterGuardiao}
                      onChange={(e) => setFilterGuardiao(e.target.value)}
                      className="w-full bg-background text-foreground text-xs rounded border border-border/60 px-2 py-1 outline-none focus:border-primary"
                    >
                      <option value="all">Todos</option>
                      {guardioes.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </th>

                  {/* Farol filter */}
                  <th className="px-2 py-2 text-center font-normal normal-case">
                    <select
                      value={filterFarol}
                      onChange={(e) => setFilterFarol(e.target.value)}
                      className="w-full bg-background text-foreground text-xs rounded border border-border/60 px-2 py-1 outline-none focus:border-primary"
                    >
                      <option value="all">Todos</option>
                      {FAROL_ORDER.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </th>

                  {/* Meta filter */}
                  <th className="px-2 py-2 text-right font-normal normal-case">
                    <input
                      type="number"
                      value={filterMetaMin}
                      onChange={(e) => setFilterMetaMin(e.target.value)}
                      placeholder="Min R$"
                      className="w-full bg-background text-foreground text-xs rounded border border-border/60 px-2 py-1 outline-none focus:border-primary text-right"
                    />
                  </th>

                  {/* Faturamento filter */}
                  <th className="px-2 py-2 text-right font-normal normal-case">
                    <input
                      type="number"
                      value={filterFatMin}
                      onChange={(e) => setFilterFatMin(e.target.value)}
                      placeholder="Min R$"
                      className="w-full bg-background text-foreground text-xs rounded border border-border/60 px-2 py-1 outline-none focus:border-primary text-right"
                    />
                  </th>

                  {/* % filter */}
                  <th className="px-2 py-2 text-right font-normal normal-case">
                    <select
                      value={filterPct}
                      onChange={(e) => setFilterPct(e.target.value)}
                      className="w-full bg-background text-foreground text-xs rounded border border-border/60 px-2 py-1 outline-none focus:border-primary text-right"
                    >
                      <option value="all">Todas</option>
                      <option value=">=100">≥ 100%</option>
                      <option value="66-99">66% a 99%</option>
                      <option value="<66">&lt; 66%</option>
                    </select>
                  </th>

                  {/* ECM filter */}
                  <th className="px-2 py-2 text-center font-normal normal-case">
                    <input
                      type="number"
                      value={filterEcmMin}
                      onChange={(e) => setFilterEcmMin(e.target.value)}
                      placeholder="Min %"
                      className="w-full bg-background text-foreground text-xs rounded border border-border/60 px-2 py-1 outline-none focus:border-primary text-center"
                    />
                  </th>

                  {/* CSAT filter */}
                  <th className="px-2 py-2 text-center font-normal normal-case">
                    <input
                      type="number"
                      value={filterCsatMin}
                      onChange={(e) => setFilterCsatMin(e.target.value)}
                      placeholder="Min Nota"
                      className="w-full bg-background text-foreground text-xs rounded border border-border/60 px-2 py-1 outline-none focus:border-primary text-center"
                    />
                  </th>

                  {/* Aposta filter */}
                  <th className="px-2 py-2 text-center font-normal normal-case">
                    <select
                      value={filterAposta}
                      onChange={(e) => setFilterAposta(e.target.value)}
                      className="w-full bg-background text-foreground text-xs rounded border border-border/60 px-2 py-1 outline-none focus:border-primary"
                    >
                      <option value="all">Todas</option>
                      <option value="VERDE">Verde</option>
                      <option value="SUBIR">Subir</option>
                      <option value="CAIR">Cair</option>
                    </select>
                  </th>

                  <th className="px-2 py-2 text-center font-normal normal-case"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((e) => {
                  const pct = e.meta > 0 ? (Number(e.faturamento) / Number(e.meta)) * 100 : 0;
                  return (
                    <tr
                      key={e.id}
                      onClick={() => handleOpenProfile(e)}
                      className="border-t border-border/40 hover:bg-accent/30 cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {e.alcancou && (
                            <span title="Bateu Meta" className="text-primary font-bold">
                              ★
                            </span>
                          )}
                          <span className="font-medium group-hover:text-primary transition-colors">
                            {e.nome}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{e.squads?.nome ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {e.guardioes?.nome ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider ${farolClasses(e.farolCalculado)}`}
                        >
                          {e.farolCalculado}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-mono">{fmtBRL(Number(e.meta))}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-mono">
                        {fmtBRL(Number(e.faturamento))}
                      </td>
                      <td
                        className={`px-3 py-3 text-right tabular-nums font-semibold ${
                          pct >= 100
                            ? "text-farol-verde"
                            : pct >= 66
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      >
                        {pct.toFixed(0)}%
                      </td>

                      {/* ECM Column Cell */}
                      <td className="px-3 py-3 text-center">
                        {e.ecm !== null && e.ecm !== undefined ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-bold font-mono ${
                              e.ecm >= 80
                                ? "bg-farol-verde/20 text-farol-verde border border-farol-verde/40"
                                : e.ecm >= 60
                                ? "bg-farol-amarelo/20 text-primary border border-farol-amarelo/40"
                                : "bg-farol-vermelho/20 text-farol-vermelho border border-farol-vermelho/40"
                            }`}
                          >
                            {e.ecm}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 text-xs">—</span>
                        )}
                      </td>

                      {/* CSAT Column Cell */}
                      <td className="px-3 py-3 text-center">
                        {e.csat !== null && e.csat !== undefined ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-bold font-mono ${
                              e.csat >= 8.5
                                ? "bg-farol-azul/20 text-farol-azul border border-farol-azul/40"
                                : e.csat >= 7.0
                                ? "bg-farol-verde/20 text-farol-verde border border-farol-verde/40"
                                : "bg-farol-vermelho/20 text-farol-vermelho border border-farol-vermelho/40"
                            }`}
                          >
                            {e.csat.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 text-xs">—</span>
                        )}
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
                      <td className="px-3 py-3 text-center" onClick={(event) => event.stopPropagation()}>
                        <button
                          onClick={() => handleOpenProfile(e)}
                          className="p-1.5 rounded-lg bg-secondary/80 hover:bg-primary hover:text-primary-foreground text-xs text-muted-foreground transition-all flex items-center justify-center gap-1 mx-auto"
                          title="Editar Perfil da EJ"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Perfil</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <p>Nenhuma EJ encontrada com esses filtros.</p>
                        {hasActiveFilters && (
                          <button
                            onClick={clearFilters}
                            className="text-xs text-primary underline hover:text-primary/80 mt-1"
                          >
                            Limpar todos os filtros
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* EJ Profile & Edit Modal */}
      <EJProfileModal
        ej={selectedEj}
        isOpen={isProfileOpen}
        onClose={() => {
          setIsProfileOpen(false);
          setSelectedEj(null);
        }}
        onSaveSuccess={handleSaveSuccess}
        allSquads={allSquads}
        allGuardioes={allGuardioes}
        currentMonth={currentMonth}
      />

      <footer className="mx-auto max-w-7xl px-6 py-6 text-xs text-muted-foreground flex items-center justify-between">
        <div>
          Corrida ENEJ · Dashboard com Meta, Faturamento, ECM & CSAT.
        </div>
        <div className="font-mono text-[11px] opacity-75">
          Mês {currentMonth} ({MESES_NOMES[currentMonth - 1]})
        </div>
      </footer>
    </div>
  );
}
