import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Save, Building2, User, Users, Target, DollarSign, Award, Star, CheckCircle, AlertTriangle, Info, Activity, HeartHandshake, HandCoins, Layers } from "lucide-react";
import { computeIndex, clusterFromIndex, type ClusterMode } from "@/lib/cluster";

export const FAROL_ORDER = ["AZUL", "VERDE", "AMARELO", "VERMELHO", "ZERADA"] as const;
export type FarolType = typeof FAROL_ORDER[number];

export const MESES_NOMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function computeFarol(meta: number, faturamento: number, currentMonth: number = new Date().getMonth() + 1): FarolType {
  const fat = Number(faturamento) || 0;
  const m = Number(meta) || 0;

  if (fat <= 0) {
    return "ZERADA";
  }

  if (m <= 0) {
    return fat > 0 ? "AZUL" : "ZERADA";
  }

  // 1. Bateu a meta do ano -> AZUL
  if (fat >= m) {
    return "AZUL";
  }

  // 2. Meta do mês vigente: (meta / 12) * currentMonth
  const metaMesVigente = (m / 12) * currentMonth;
  if (fat >= metaMesVigente) {
    return "VERDE";
  }

  // 3. Faturamento do mês anterior: (meta / 12) * (currentMonth - 1)
  const mesAnterior = Math.max(0, currentMonth - 1);
  const metaMesAnterior = (m / 12) * mesAnterior;
  if (fat >= metaMesAnterior) {
    return "AMARELO";
  }

  // 4. Diferente disso -> VERMELHO
  return "VERMELHO";
}

export function farolClasses(farol: string | null): string {
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
    case "ZERADA":
      return "bg-black text-white border border-gray-700";
    default:
      return "bg-black text-white border border-gray-700";
  }
}

export function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function parseEjMetrics(informacoes: string | null, ecmDirect?: number | null, csatDirect?: number | null): {
  ecm: number | null;
  csat: number | null;
  text: string;
} {
  let ecm = ecmDirect ?? null;
  let csat = csatDirect ?? null;
  let text = "";

  if (informacoes) {
    try {
      const parsed = JSON.parse(informacoes);
      if (typeof parsed === "object" && parsed !== null) {
        if (ecm === null && parsed.ecm !== undefined) {
          ecm = parsed.ecm !== null ? Number(parsed.ecm) : null;
        }
        if (csat === null && parsed.csat !== undefined) {
          csat = parsed.csat !== null ? Number(parsed.csat) : null;
        }
        text = parsed.text ?? parsed.obs ?? "";
      } else {
        text = informacoes;
      }
    } catch {
      text = informacoes;
    }
  }

  return { ecm, csat, text };
}

export function serializeEjMetrics(ecm: number | null, csat: number | null, text: string): string {
  return JSON.stringify({
    ecm: ecm !== null && !isNaN(ecm) ? ecm : null,
    csat: csat !== null && !isNaN(csat) ? csat : null,
    text: text || "",
  });
}

export type EJData = {
  id: string;
  nome: string;
  presente: boolean;
  meta: number;
  faturamento: number;
  farol: string | null;
  aposta_verde: string | null;
  aposta_sde: string | null;
  alcancou: boolean;
  guardiao_id: string | null;
  squad_id: string | null;
  informacoes?: string | null;
  ecm?: number | null;
  csat?: number | null;
  fat_colaborativo?: number | null;
  guardioes: { id?: string; nome: string } | null;
  squads: { id?: string; nome: string } | null;
};

interface EJProfileModalProps {
  ej: EJData | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
  allSquads: Array<{ id: string; nome: string }>;
  allGuardioes: Array<{ id: string; nome: string }>;
  currentMonth: number;
}

export function EJProfileModal({
  ej,
  isOpen,
  onClose,
  onSaveSuccess,
  allSquads,
  allGuardioes,
  currentMonth,
}: EJProfileModalProps) {
  const [nome, setNome] = useState("");
  const [meta, setMeta] = useState<number | "">(0);
  const [faturamento, setFaturamento] = useState<number | "">(0);
  const [fatColab, setFatColab] = useState<number | "">(0);
  const [squadId, setSquadId] = useState<string>("");
  const [guardiaoId, setGuardiaoId] = useState<string>("");
  const [alcancou, setAlcancou] = useState(false);
  const [presente, setPresente] = useState(true);
  const [apostaVerde, setApostaVerde] = useState<string>("NAO");
  const [apostaSde, setApostaSde] = useState<string>("NENHUMA");
  const [ecmVal, setEcmVal] = useState<number | "">("");
  const [csatVal, setCsatVal] = useState<number | "">("");
  const [informacoesText, setInformacoesText] = useState<string>("");
  const [clusterMode, setClusterMode] = useState<ClusterMode>("ANUAL");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (ej) {
      const parsed = parseEjMetrics(ej.informacoes ?? null, ej.ecm, ej.csat);
      setNome(ej.nome ?? "");
      setMeta(ej.meta ?? 0);
      setFaturamento(ej.faturamento ?? 0);
      setFatColab(ej.fat_colaborativo ?? 0);
      setSquadId(ej.squad_id ?? ej.squads?.id ?? "");
      setGuardiaoId(ej.guardiao_id ?? ej.guardioes?.id ?? "");
      setAlcancou(Boolean(ej.alcancou));
      setPresente(ej.presente !== false);
      setApostaVerde(ej.aposta_verde ?? "NAO");
      setApostaSde(ej.aposta_sde ?? "NENHUMA");
      setEcmVal(parsed.ecm !== null ? parsed.ecm : "");
      setCsatVal(parsed.csat !== null ? parsed.csat : "");
      setInformacoesText(parsed.text);
      setErrorMsg(null);
    }
  }, [ej]);

  const metaNum = Number(meta) || 0;
  const fatNum = Number(faturamento) || 0;
  const fatColabNum = Number(fatColab) || 0;
  const ecmNumLive = ecmVal !== "" ? Number(ecmVal) : null;
  const csatNumLive = csatVal !== "" ? Number(csatVal) : null;

  const liveFarol = useMemo(() => {
    return computeFarol(metaNum, fatNum, currentMonth);
  }, [metaNum, fatNum, currentMonth]);

  const metaMesVigente = (metaNum / 12) * currentMonth;
  const mesAnterior = Math.max(0, currentMonth - 1);
  const metaMesAnterior = (metaNum / 12) * mesAnterior;

  const atingimentoPct = metaNum > 0 ? (fatNum / metaNum) * 100 : 0;

  const clusterInputs = {
    faturamento: fatNum,
    fatColaborativo: fatColabNum,
    ecm: ecmNumLive,
    csat: csatNumLive,
    currentMonth,
  };
  const indexAnual = computeIndex("ANUAL", clusterInputs);
  const indexEnej = computeIndex("ENEJ", clusterInputs);
  const clusterAnual = clusterFromIndex(indexAnual);
  const clusterEnej = clusterFromIndex(indexEnej);
  const activeIndex = clusterMode === "ENEJ" ? indexEnej : indexAnual;
  const activeCluster = clusterMode === "ENEJ" ? clusterEnej : clusterAnual;

  if (!isOpen || !ej) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    try {
      const farolCalculado = computeFarol(metaNum, fatNum, currentMonth);

      const ecmNum = ecmVal !== "" ? Number(ecmVal) : null;
      const csatNum = csatVal !== "" ? Number(csatVal) : null;

      const serializedInformacoes = serializeEjMetrics(ecmNum, csatNum, informacoesText);

      const { error } = await supabase
        .from("ejs")
        .update({
          nome,
          meta: metaNum,
          faturamento: fatNum,
          farol: farolCalculado,
          squad_id: squadId || null,
          guardiao_id: guardiaoId || null,
          alcancou,
          presente,
          aposta_verde: apostaVerde,
          aposta_sde: apostaSde,
          fat_colaborativo: fatColabNum,
          informacoes: serializedInformacoes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ej.id);

      if (error) throw error;

      onSaveSuccess();
      onClose();
    } catch (err: any) {
      console.error("Erro ao atualizar EJ:", err);
      setErrorMsg(err.message || "Ocorreu um erro ao salvar os dados.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Banner */}
        <div className="relative bg-gradient-to-r from-secondary/90 via-card to-secondary/90 px-6 py-5 border-b border-border/60">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground">{nome || ej.nome}</h2>
                  {alcancou && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-primary/20 text-primary border border-primary/40">
                      <Star className="w-3 h-3 fill-primary" /> Bateu a Meta
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ID: <span className="font-mono text-muted-foreground/80">{ej.id}</span>
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Computed Farol Badge in Banner */}
          <div className="mt-4 flex items-center justify-between gap-2 p-3 rounded-xl bg-background/60 border border-border/40 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Farol Recalculado ({MESES_NOMES[currentMonth - 1]}):</span>
              <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] uppercase tracking-wider ${farolClasses(liveFarol)}`}>
                {liveFarol}
              </span>
            </div>
            <div className="text-right">
              <span className="font-bold text-primary">{atingimentoPct.toFixed(1)}%</span> da Meta Anual
            </div>
          </div>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Farol Rules Explanation Card */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border/60 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-primary">
              <Info className="w-4 h-4" />
              <span>Lógica de Cálculo do Farol (Mês {currentMonth} - {MESES_NOMES[currentMonth - 1]})</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div className="p-2 rounded bg-farol-azul/10 border border-farol-azul/30">
                <span className="font-bold text-farol-azul">AZUL:</span> ≥ {fmtBRL(metaNum)} (Meta Ano)
              </div>
              <div className="p-2 rounded bg-farol-verde/10 border border-farol-verde/30">
                <span className="font-bold text-farol-verde">VERDE:</span> ≥ {fmtBRL(metaMesVigente)} (Mês Atual)
              </div>
              <div className="p-2 rounded bg-farol-amarelo/10 border border-farol-amarelo/30">
                <span className="font-bold text-farol-amarelo">AMARELO:</span> ≥ {fmtBRL(metaMesAnterior)} (Mês Ant.)
              </div>
              <div className="p-2 rounded bg-farol-vermelho/10 border border-farol-vermelho/30">
                <span className="font-bold text-farol-vermelho">VERMELHO:</span> &lt; {fmtBRL(metaMesAnterior)}
              </div>
            </div>
            {fatNum <= 0 && (
              <p className="text-[11px] text-muted-foreground font-semibold pt-1">
                * Faturamento R$ 0 = <span className="text-foreground bg-black px-1.5 py-0.5 rounded border border-gray-700">ZERADA (PRETO)</span>
              </p>
            )}
          </div>

          {/* General Information */}
          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Informações Principais
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Nome da Empresa Júnior
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-input text-foreground rounded-lg px-3 py-2 text-sm border border-border/60 outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Squad
                </label>
                <select
                  value={squadId}
                  onChange={(e) => setSquadId(e.target.value)}
                  className="w-full bg-input text-foreground rounded-lg px-3 py-2 text-sm border border-border/60 outline-none focus:border-primary"
                >
                  <option value="">Sem Squad</option>
                  {allSquads.map((s) => (
                    <option key={s.id} value={s.id}>
                      Squad {s.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Guardião
                </label>
                <select
                  value={guardiaoId}
                  onChange={(e) => setGuardiaoId(e.target.value)}
                  className="w-full bg-input text-foreground rounded-lg px-3 py-2 text-sm border border-border/60 outline-none focus:border-primary"
                >
                  <option value="">Sem Guardião</option>
                  {allGuardioes.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-4 pt-6">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={presente}
                    onChange={(e) => setPresente(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary accent-primary"
                  />
                  <span>Presente na Corrida</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={alcancou}
                    onChange={(e) => setAlcancou(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary accent-primary"
                  />
                  <span className="text-primary font-semibold">★ Bateu Meta (Alcançou)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Financial Values */}
          <div className="space-y-4 pt-2 border-t border-border/40">
            <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Valores Financeiros
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Meta Anual (R$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={meta}
                  onChange={(e) => setMeta(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full bg-input text-foreground rounded-lg px-3 py-2 text-sm border border-border/60 outline-none focus:border-primary font-mono"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Meta Mensal esperada: {fmtBRL(metaNum / 12)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Faturamento Acumulado (R$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={faturamento}
                  onChange={(e) => setFaturamento(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full bg-input text-foreground rounded-lg px-3 py-2 text-sm border border-border/60 outline-none focus:border-primary font-mono"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Diferença p/ Meta Ano: {fmtBRL(Math.max(0, metaNum - fatNum))}
                </p>
              </div>
            </div>
          </div>

          {/* Indicadores Adicionais: ECM & CSAT */}
          <div className="space-y-4 pt-2 border-t border-border/40">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                Outros Indicadores (ECM & CSAT)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1 flex items-center justify-between">
                  <span>ECM — Engajamento com o MEJ (%)</span>
                  <span className="text-[10px] text-muted-foreground">(0 a 100%)</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={ecmVal}
                    onChange={(e) => setEcmVal(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Ex: 85"
                    className="w-full bg-input text-foreground rounded-lg px-3 py-2 text-sm border border-border/60 outline-none focus:border-primary font-mono pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1 flex items-center justify-between">
                  <span>CSAT — Satisfação do Cliente (0 a 10)</span>
                  <span className="text-[10px] text-muted-foreground">(Nota 0 a 10)</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={csatVal}
                    onChange={(e) => setCsatVal(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Ex: 9.5"
                    className="w-full bg-input text-foreground rounded-lg px-3 py-2 text-sm border border-border/60 outline-none focus:border-primary font-mono pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">★</span>
                </div>
              </div>
            </div>
          </div>

          {/* Apostas & Status */}
          <div className="space-y-4 pt-2 border-t border-border/40">
            <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Apostas de Performance
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Aposta Verde
                </label>
                <select
                  value={apostaVerde}
                  onChange={(e) => setApostaVerde(e.target.value)}
                  className="w-full bg-input text-foreground rounded-lg px-3 py-2 text-sm border border-border/60 outline-none focus:border-primary"
                >
                  <option value="SIM">SIM (Vai ser verde)</option>
                  <option value="NAO">NÃO</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Aposta SDE
                </label>
                <select
                  value={apostaSde}
                  onChange={(e) => setApostaSde(e.target.value)}
                  className="w-full bg-input text-foreground rounded-lg px-3 py-2 text-sm border border-border/60 outline-none focus:border-primary"
                >
                  <option value="SUBIR">SUBIR</option>
                  <option value="CAIR">CAIR</option>
                  <option value="MANTER">MANTER</option>
                  <option value="NENHUMA">NENHUMA</option>
                </select>
              </div>
            </div>
          </div>

          {/* Observations */}
          <div className="space-y-2 pt-2 border-t border-border/40">
            <label className="block text-xs font-medium text-foreground">
              Observações & Anotações da EJ
            </label>
            <textarea
              rows={3}
              value={informacoesText}
              onChange={(e) => setInformacoesText(e.target.value)}
              placeholder="Digite anotações sobre a performance, contatos ou pendências da EJ…"
              className="w-full bg-input text-foreground rounded-lg px-3 py-2 text-xs border border-border/60 outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Salvando…" : "Salvar Alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
