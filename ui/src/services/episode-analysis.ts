import type { SessionCaptureFile, SessionCaptureMetadata } from "../stores/session-capture";
import type { TimelineEventRecord } from "../stores/timeline";

export interface ComparisonMetrics {
  baseRewardAvg: number;
  comparisonRewardAvg: number;
  rewardDelta: number;
  rewardDeltaPercent: number;
  baseActionCount: number;
  comparisonActionCount: number;
  actionCountDelta: number;
  baseEventCount: number;
  comparisonEventCount: number;
  eventCountDelta: number;
  sequenceDelta: number; // count of events in different order or missing
}

export interface AnomalyIndicator {
  type: "reward-delta" | "action-count-delta" | "event-sequence-divergence";
  severity: "info" | "warning" | "error";
  message: string;
  value?: number;
}

export interface EpisodeComparisonResult {
  baseSession: SessionCaptureMetadata;
  comparisonSession: SessionCaptureMetadata;
  metrics: ComparisonMetrics;
  anomalies: AnomalyIndicator[];
  recommendation: string;
}

function getRewardEvents(session: SessionCaptureFile): TimelineEventRecord[] {
  return session.events.filter((e) => e.eventType === "agent:reward");
}

function extractRewardValue(event: TimelineEventRecord): number {
  if (typeof event.payload === "object" && event.payload !== null) {
    const p = event.payload as Record<string, unknown>;
    if (typeof p.reward === "number") return p.reward;
    if (typeof p.value === "number") return p.value;
  }
  return 0;
}

function getActionEvents(session: SessionCaptureFile): TimelineEventRecord[] {
  return session.events.filter((e) => e.eventType === "agent:action");
}

function extractActionLabel(event: TimelineEventRecord): string {
  if (typeof event.payload === "object" && event.payload !== null) {
    const p = event.payload as Record<string, unknown>;
    if (typeof p.action === "string") return p.action;
    if (typeof p.type === "string") return p.type;
  }
  return "unknown";
}

function calculateSequenceDelta(base: TimelineEventRecord[], comp: TimelineEventRecord[]): number {
  let delta = 0;
  const baseIds = new Set(base.map((e) => e.id));
  const compIds = new Set(comp.map((e) => e.id));

  // Count events in base but not in comp (missing)
  baseIds.forEach((id) => {
    if (!compIds.has(id)) delta += 1;
  });

  // Count events in comp but not in base (extra)
  compIds.forEach((id) => {
    if (!baseIds.has(id)) delta += 1;
  });

  // Count order differences (position mismatch)
  const shared = Array.from(baseIds).filter((id) => compIds.has(id));
  const baseOrder = base.filter((e) => shared.includes(e.id)).map((e) => e.id);
  const compOrder = comp.filter((e) => shared.includes(e.id)).map((e) => e.id);
  for (let i = 0; i < baseOrder.length && i < compOrder.length; i++) {
    if (baseOrder[i] !== compOrder[i]) delta += 1;
  }

  return delta;
}

export function analyzeEpisodeComparison(
  baseFile: SessionCaptureFile,
  comparisonFile: SessionCaptureFile,
): EpisodeComparisonResult {
  const baseRewards = getRewardEvents(baseFile).map((e) => extractRewardValue(e));
  const compRewards = getRewardEvents(comparisonFile).map((e) => extractRewardValue(e));

  const baseRewardAvg = baseRewards.length > 0 ? baseRewards.reduce((a, b) => a + b) / baseRewards.length : 0;
  const compRewardAvg = compRewards.length > 0 ? compRewards.reduce((a, b) => a + b) / compRewards.length : 0;
  const rewardDelta = compRewardAvg - baseRewardAvg;
  const rewardDeltaPercent =
    baseRewardAvg !== 0 ? (rewardDelta / Math.abs(baseRewardAvg)) * 100 : rewardDelta !== 0 ? 100 : 0;

  const baseActions = getActionEvents(baseFile);
  const compActions = getActionEvents(comparisonFile);
  const baseActionCounts: Record<string, number> = {};
  const compActionCounts: Record<string, number> = {};

  baseActions.forEach((e) => {
    const label = extractActionLabel(e);
    baseActionCounts[label] = (baseActionCounts[label] ?? 0) + 1;
  });
  compActions.forEach((e) => {
    const label = extractActionLabel(e);
    compActionCounts[label] = (compActionCounts[label] ?? 0) + 1;
  });

  const baseActionTotal = baseActions.length;
  const compActionTotal = compActions.length;
  const actionCountDelta = compActionTotal - baseActionTotal;

  const eventCountDelta = comparisonFile.events.length - baseFile.events.length;
  const sequenceDelta = calculateSequenceDelta(baseFile.events, comparisonFile.events);

  const anomalies: AnomalyIndicator[] = [];

  // Reward anomaly
  if (Math.abs(rewardDeltaPercent) > 10) {
    const severity = rewardDelta < 0 ? "error" : "info";
    anomalies.push({
      type: "reward-delta",
      severity,
      message: `Reward changed by ${rewardDeltaPercent.toFixed(1)}% (${rewardDelta > 0 ? "+" : ""}${rewardDelta.toFixed(2)})`,
      value: rewardDelta,
    });
  }

  // Action count anomaly
  if (Math.abs(actionCountDelta) > baseActionTotal * 0.2) {
    const severity = actionCountDelta < 0 ? "warning" : "info";
    anomalies.push({
      type: "action-count-delta",
      severity,
      message: `Action count changed by ${actionCountDelta} (${((actionCountDelta / Math.max(baseActionTotal, 1)) * 100).toFixed(1)}%)`,
      value: actionCountDelta,
    });
  }

  // Sequence anomaly
  if (sequenceDelta > baseFile.events.length * 0.15) {
    anomalies.push({
      type: "event-sequence-divergence",
      severity: "warning",
      message: `Event sequence divergence detected: ${sequenceDelta} differences`,
      value: sequenceDelta,
    });
  }

  let recommendation = "Episodes are similar.";
  if (rewardDelta > 5) recommendation = "Comparison episode outperformed baseline.";
  else if (rewardDelta < -5) recommendation = "Baseline episode outperformed comparison; investigate anomaly.";
  if (sequenceDelta > baseFile.events.length * 0.2) recommendation += " Significant event sequence divergence detected.";

  return {
    baseSession: baseFile.metadata,
    comparisonSession: comparisonFile.metadata,
    metrics: {
      baseRewardAvg,
      comparisonRewardAvg: compRewardAvg,
      rewardDelta,
      rewardDeltaPercent,
      baseActionCount: baseActionTotal,
      comparisonActionCount: compActionTotal,
      baseEventCount: baseFile.events.length,
      comparisonEventCount: comparisonFile.events.length,
      eventCountDelta,
      actionCountDelta,
      sequenceDelta,
    },
    anomalies,
    recommendation,
  };
}
