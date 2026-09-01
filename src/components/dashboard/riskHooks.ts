'use client';

import useSWR from 'swr';
import type {
  WardRiskSummary,
  WardRiskDetail,
  RiskSummary,
  RiskHotspot,
} from '@/lib/risk/types';

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
});

/**
 * Fetch ward-level risk summaries.
 */
export function useWardRisks(params: { riskLevel?: string; category?: string; departmentId?: string; days?: number; limit?: number; offset?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.riskLevel) qs.set('riskLevel', params.riskLevel);
  if (params.category) qs.set('category', params.category);
  if (params.departmentId) qs.set('departmentId', params.departmentId);
  if (params.days) qs.set('days', String(params.days));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  const query = qs.toString();

  return useSWR<{ wards: WardRiskSummary[] }>(
    `/api/risk/wards${query ? `?${query}` : ''}`,
    fetcher,
    { refreshInterval: 60000 },
  );
}

/**
 * Fetch a single ward's full risk detail.
 */
export function useWardDetail(wardId: string | null, params: { category?: string; departmentId?: string; days?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.category) qs.set('category', params.category);
  if (params.departmentId) qs.set('departmentId', params.departmentId);
  if (params.days) qs.set('days', String(params.days));
  const query = qs.toString();

  return useSWR<{ ward: WardRiskDetail }>(
    wardId ? `/api/risk/wards/${encodeURIComponent(wardId)}${query ? `?${query}` : ''}` : null,
    fetcher,
    { refreshInterval: 60000 },
  );
}

/**
 * Fetch the risk dashboard summary.
 */
export function useRiskSummary(params: { category?: string; departmentId?: string; days?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.category) qs.set('category', params.category);
  if (params.departmentId) qs.set('departmentId', params.departmentId);
  if (params.days) qs.set('days', String(params.days));
  const query = qs.toString();

  return useSWR<RiskSummary>(
    `/api/risk/summary${query ? `?${query}` : ''}`,
    fetcher,
    { refreshInterval: 60000 },
  );
}

/**
 * Fetch risk hotspots for the map.
 */
export function useRiskHotspots(params: { riskLevel?: string; category?: string; departmentId?: string; days?: number; limit?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.riskLevel) qs.set('riskLevel', params.riskLevel);
  if (params.category) qs.set('category', params.category);
  if (params.departmentId) qs.set('departmentId', params.departmentId);
  if (params.days) qs.set('days', String(params.days));
  if (params.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();

  return useSWR<{ hotspots: RiskHotspot[] }>(
    `/api/risk/hotspots${query ? `?${query}` : ''}`,
    fetcher,
    { refreshInterval: 60000 },
  );
}
