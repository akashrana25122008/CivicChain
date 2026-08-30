/**
 * UI-facing labels + display-status mapping.
 *
 * IMPORTANT — client-bundle safe: only `import type` from the generated
 * Prisma client is used here; the runtime enum constants (which pull in
 * Node-only modules) must never reach the browser bundle. Server-side modules
 * (e.g. serializers) keep using the real enum values from the generated client.
 */
import type {
  AICategory,
  InfrastructureType,
  IssueCategory,
  IssueStatus,
  PriorityLevel,
  PromiseStatus,
  SafetyRisk,
  Severity,
} from '../../../generated/prisma/client';
import type { Promise as CivicPromise } from '../../../generated/prisma/client';

export const CATEGORY_LABELS: Record<IssueCategory, string> = {
  POTHOLE: 'Road Pothole',
  DRAINAGE: 'Drain Blockage',
  STREETLIGHT: 'Streetlight Failure',
  GARBAGE: 'Garbage Accumulation',
  INFRASTRUCTURE: 'Infrastructure Damage',
  WATER: 'Water Supply Issue',
  OTHER: 'Other Civic Issue',
};

export const CATEGORY_SELECT_OPTIONS: Array<{ value: string; label: string }> =
  (Object.keys(CATEGORY_LABELS) as IssueCategory[]).map((value) => ({
    value,
    label: CATEGORY_LABELS[value],
  }));

export const STATUS_LABELS: Record<IssueStatus, string> = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  VERIFIED: 'Verified',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected',
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export function promiseDisplayStatus(promise: Pick<CivicPromise, 'status'>): string {
  switch (promise.status as PromiseStatus) {
    case 'COMPLETED':
      return 'resolved';
    case 'BROKEN':
      return 'brokenPromise';
    case 'IN_PROGRESS':
      return 'onTrack';
    default:
      return 'promised';
  }
}

/**
 * Maps the authoritative lifecycle status (plus optional authority promise)
 * to the badge status vocabulary the existing UI already renders.
 */
export function toDisplayStatus(
  status: IssueStatus | string,
  promise?: Pick<CivicPromise, 'status'> | null,
): string {
  switch (status as IssueStatus) {
    case 'RESOLVED':
      return 'resolved';
    case 'REJECTED':
      return 'rejected';
    case 'IN_PROGRESS':
      if (promise) return promiseDisplayStatus(promise);
      return 'promised';
    case 'VERIFIED':
      return 'verificationPending';
    case 'ASSIGNED':
      return 'assigned';
    default:
      return 'active';
  }
}

/**
 * Static, rule-based department suggestion per category (NOT an AI model).
 * The Authority table is seeded with these departments in prisma/seed.ts.
 */
export const DEPARTMENT_BY_CATEGORY: Partial<Record<IssueCategory, string>> = {
  POTHOLE: 'Roads & Infrastructure Department',
  DRAINAGE: 'Roads & Infrastructure Department',
  STREETLIGHT: 'Public Lighting Department',
  GARBAGE: 'Sanitation Department',
  WATER: 'Water Supply Department',
  INFRASTRUCTURE: 'Infrastructure Department',
};

export function getAuthorityDepartmentForCategory(
  category: IssueCategory,
): string | null {
  return DEPARTMENT_BY_CATEGORY[category] ?? null;
}

// --- Phase 3+4 — AI classification + priority display vocabularies ---------
// Keys are literals, so these stay client-bundle safe (type-only import).

export const AI_CATEGORY_LABELS: Record<AICategory, string> = {
  ROAD_DAMAGE: 'Road Damage',
  STREET_LIGHT: 'Street Light Failure',
  GARBAGE: 'Garbage Accumulation',
  WATER_LEAKAGE: 'Water Leakage',
  DRAINAGE: 'Drainage Blocked',
  TRAFFIC_SIGNAL: 'Traffic Signal Fault',
  PUBLIC_INFRASTRUCTURE: 'Public Infrastructure Damage',
  OTHER: 'Other Civic Issue',
};

export const SAFETY_RISK_LABELS: Record<SafetyRisk, string> = {
  NONE: 'None',
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const INFRASTRUCTURE_TYPE_LABELS: Record<InfrastructureType, string> = {
  ROAD: 'Road',
  SIDEWALK: 'Sidewalk',
  BRIDGE: 'Bridge',
  STREET_LIGHT: 'Street light',
  TRAFFIC_SIGNAL: 'Traffic signal',
  DRAINAGE_SYSTEM: 'Drainage system',
  WATER_SUPPLY: 'Water supply',
  PUBLIC_BUILDING: 'Public building',
  PARK: 'Park',
  NONE: 'None',
  OTHER: 'Other',
};

export const PRIORITY_LEVEL_LABELS: Record<PriorityLevel, string> = {
  LOW: 'Low priority',
  MEDIUM: 'Medium priority',
  HIGH: 'High priority',
  CRITICAL: 'Critical priority',
};

export const DUPLICATE_BAND_LABELS = {
  probably_new: 'Probably new',
  possible: 'Possible duplicate',
  strong: 'Strong duplicate candidate',
} as const;