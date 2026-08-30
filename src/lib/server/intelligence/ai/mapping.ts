/**
 * Server-only mapping from the AI classification vocabulary to the existing
 * IssueCategory enum that drives the UI, department routing and filters.
 * Deliberately lives outside src/lib/issues (client-bundle safe) so runtime
 * enum constants never leak into the browser.
 */
import {
  AICategory,
  IssueCategory,
  type Severity,
} from '../../../../../generated/prisma/client';

export const AI_CATEGORY_TO_ISSUE: Record<AICategory, IssueCategory> = {
  [AICategory.ROAD_DAMAGE]: IssueCategory.POTHOLE,
  [AICategory.STREET_LIGHT]: IssueCategory.STREETLIGHT,
  [AICategory.GARBAGE]: IssueCategory.GARBAGE,
  [AICategory.WATER_LEAKAGE]: IssueCategory.WATER,
  [AICategory.DRAINAGE]: IssueCategory.DRAINAGE,
  [AICategory.TRAFFIC_SIGNAL]: IssueCategory.INFRASTRUCTURE,
  [AICategory.PUBLIC_INFRASTRUCTURE]: IssueCategory.INFRASTRUCTURE,
  [AICategory.OTHER]: IssueCategory.OTHER,
};

/** AISeverity shares its exact values with the existing Severity enum. */
export function aiSeverityToIssueSeverity(severity: string): Severity {
  return severity as Severity;
}