'use client';

import { use } from 'react';
import { IssueDetailView } from '@/components/issues/IssueDetailView';

export default function MyReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <IssueDetailView id={id} endpoint="/api/my-reports" />;
}