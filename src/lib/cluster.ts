export type ClusterMode = "ANUAL" | "ENEJ";

export const CLUSTER_RANGES: Array<{ min: number; max: number; cluster: number }> = [
  { min: 0, max: 12_000_000, cluster: 1 },
  { min: 12_000_000.01, max: 24_000_000, cluster: 2 },
  { min: 24_000_000.01, max: 61_000_000, cluster: 3 },
  { min: 61_000_000.01, max: 130_000_000, cluster: 4 },
  { min: 130_000_000.01, max: Infinity, cluster: 5 },
];

export function clusterFromIndex(index: number): number {
  for (const r of CLUSTER_RANGES) {
    if (index >= r.min && index <= r.max) return r.cluster;
  }
  return 1;
}

export interface ClusterInputs {
  faturamento: number;
  fatColaborativo: number;
  ecm: number | null; // percent (0-100)
  csat: number | null; // 0-10
  currentMonth: number; // 1-12
}

/**
 * Anual (imagem): Faturamento × CSAT × (1 + ECM%) × (1 + %Fat.Colab) × 100
 * onde %Fat.Colab = Fat.Colaborativo / Faturamento (fração)
 */
export function computeIndexAnual({ faturamento, fatColaborativo, ecm, csat }: ClusterInputs): number {
  const fat = Number(faturamento) || 0;
  const colab = Number(fatColaborativo) || 0;
  const ecmFrac = ecm !== null && ecm !== undefined ? Number(ecm) / 100 : 0;
  const csatVal = csat !== null && csat !== undefined ? Number(csat) : 0;
  const pctColab = fat > 0 ? colab / fat : 0;
  return fat * csatVal * (1 + ecmFrac) * (1 + pctColab) * 100;
}

/**
 * ENEJ (fórmula do usuário):
 * (Faturamento + (Faturamento/Mês * (12 - Mês))) × (1 + Fat/FatColab) × (1 + ECM) × CSAT × 100
 */
export function computeIndexEnej({ faturamento, fatColaborativo, ecm, csat, currentMonth }: ClusterInputs): number {
  const fat = Number(faturamento) || 0;
  const colab = Number(fatColaborativo) || 0;
  const mes = Math.max(1, Math.min(12, Number(currentMonth) || 1));
  const ecmFrac = ecm !== null && ecm !== undefined ? Number(ecm) / 100 : 0;
  const csatVal = csat !== null && csat !== undefined ? Number(csat) : 0;
  const projetado = fat + (fat / mes) * (12 - mes);
  const ratioFatColab = colab > 0 ? fat / colab : 0;
  return projetado * (1 + ratioFatColab) * (1 + ecmFrac) * csatVal * 100;
}

export function computeIndex(mode: ClusterMode, inputs: ClusterInputs): number {
  return mode === "ENEJ" ? computeIndexEnej(inputs) : computeIndexAnual(inputs);
}
