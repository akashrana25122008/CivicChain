import { prisma } from '@/lib/db';
import { serializeIssueListRow, toEvidenceItem } from '@/lib/issues/serialize';
import {
  IssueCategory,
  IssueStatus,
  PriorityLevel,
  type Prisma,
} from '../../../generated/prisma/client';

export interface IssueQueryParams {
  viewerId?: string | null;
  /** Show reporter identity on the returned rows (staff surfaces only). */
  revealReporter?: boolean;
  /** Scope the query to a single department (authorityId). */
  authorityId?: string | null;
  /** Scope the query to a single reporter. */
  reporterId?: string | null;
  q?: string | null;
  category?: string | null;
  status?: string | null;
  /** Filter by priority band (PriorityLevel: LOW | MEDIUM | HIGH | CRITICAL). */
  priority?: string | null;
  /** Inclusive lower bound on createdAt (ISO date). */
  dateFrom?: string | null;
  /** Inclusive upper bound on createdAt (ISO date). */
  dateTo?: string | null;
  sort?: 'newest' | 'oldest' | 'updated';
  page?: number;
  pageSize?: number;
}

export interface IssueListResult {
  issues: ReturnType<typeof serializeIssueListRow>[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

const ISSUE_LIST_INCLUDE = {
  authority: { include: { department: { select: { name: true } } } },
  promise: true,
  reporter: { select: { name: true, email: true } },
} as const;

const VALID_STATUSES = new Set<string>(Object.values(IssueStatus));
const VALID_CATEGORIES = new Set<string>(Object.values(IssueCategory));

/**
 * Server-side issue listing with search, filters, and pagination. Used by the
 * citizen catalogue, the department workbench, and the admin manager so every
 * surface shares one filter implementation and one ordering contract.
 */
export async function queryIssueList(params: IssueQueryParams): Promise<IssueListResult> {
  const rawPage = Number.isFinite(params.page) ? (params.page ?? 1) : 1;
  const page = Math.max(1, rawPage);
  const rawSize = Number.isFinite(params.pageSize) ? (params.pageSize ?? 100) : 100;
  const pageSize = Math.min(200, Math.max(1, rawSize));

  const where: Prisma.IssueWhereInput = {};
  if (params.reporterId) where.reporterId = params.reporterId;
  if (params.authorityId) where.authorityId = params.authorityId;

  // Unknown filter values short-circuit to an empty page instead of leaking
  // every row when a client sends garbage.
  if (params.status) {
    if (!VALID_STATUSES.has(params.status)) {
      return { issues: [], total: 0, page, pageSize, pageCount: 0 };
    }
    where.status = params.status as IssueStatus;
  }
  if (params.category) {
    if (!VALID_CATEGORIES.has(params.category)) {
      return { issues: [], total: 0, page, pageSize, pageCount: 0 };
    }
    where.category = params.category as IssueCategory;
  }
  if (params.priority) {
    if (!PriorityLevel[params.priority as keyof typeof PriorityLevel]) {
      return { issues: [], total: 0, page, pageSize, pageCount: 0 };
    }
    where.priorityLevel = params.priority as PriorityLevel;
  }
  if (params.dateFrom || params.dateTo) {
    const from = params.dateFrom ? new Date(params.dateFrom) : null;
    const to = params.dateTo ? new Date(params.dateTo) : null;
    const validFrom = from ? !Number.isNaN(from.getTime()) : false;
    const validTo = to ? !Number.isNaN(to.getTime()) : false;
    if (validFrom || validTo) {
      where.createdAt = {
        ...(validFrom ? { gte: from! } : {}),
        ...(validTo ? { lte: to! } : {}),
      };
    }
  }

  const term = params.q?.trim();
  if (term) {
    where.OR = [
      { title: { contains: term, mode: 'insensitive' } },
      { publicId: { contains: term, mode: 'insensitive' } },
      { location: { contains: term, mode: 'insensitive' } },
    ];
  }

  const orderBy =
    params.sort === 'oldest'
      ? ({ createdAt: 'asc' } as const)
      : params.sort === 'updated'
        ? ({ updatedAt: 'desc' } as const)
        : ({ createdAt: 'desc' } as const);

  const [issues, total] = await Promise.all([
    prisma.issue.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: ISSUE_LIST_INCLUDE,
    }),
    prisma.issue.count({ where }),
  ]);

  return {
    issues: issues.map((issue) =>
      serializeIssueListRow({
        issue,
        authority: issue.authority,
        promise: issue.promise,
        viewerId: params.viewerId,
        revealReporter: params.revealReporter,
        reporter: issue.reporter,
      }),
    ),
    total,
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
  };
}

const EVIDENCE_INCLUDE = {
  verifications: {
    orderBy: { createdAt: 'desc' as const },
    include: { verifier: { select: { name: true, email: true } } },
  },
} as const;

/**
 * Canonical evidence listing for a single issue. Returns serialized evidence
 * rows with the most recent verification attached, ordered by upload time.
 */
export async function queryIssueEvidence(input: {
  issueId: string;
  viewerId?: string | null;
}): Promise<ReturnType<typeof toEvidenceItem>[]> {
  const evidence = await prisma.evidence.findMany({
    where: { issueId: input.issueId },
    orderBy: { createdAt: 'asc' },
    include: EVIDENCE_INCLUDE,
  });
  return evidence.map((ev) => toEvidenceItem(ev));
}