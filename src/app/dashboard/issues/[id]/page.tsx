'use client';

import { use } from 'react';
import { IssueDetailView } from '@/components/issues/IssueDetailView';

export default function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <IssueDetailView id={id} endpoint="/api/issues" />;
}