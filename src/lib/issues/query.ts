import { prisma } from '@/lib/db';
import { serializeIssueListRow } from '@/lib/issues/serialize';
import {
  IssueCategory,
  IssueStatus,
  type Prisma,
} from '../../../generated/prisma/client';

export interface IssueQueryParams {
  viewerId?: string | null;
  /** Scope the query to a single department (authorityId). */
  authorityId?: string | null;
  /** Scope the query to a single reporter. */
  reporterId?: string | null;
  q?: string | null;
  category?: string | null;
  status?: string | null;
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
  authority: true,
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
  const pageSize = Math.min(100, Math.max(1, rawSize));

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
        reporter: issue.reporter,
      }),
    ),
    total,
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
  };
}