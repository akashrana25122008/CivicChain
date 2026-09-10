'use client';

import { use } from 'react';
import { ResolutionWorkbenchView } from '@/components/department/ResolutionWorkbench';

export default function ResolutionWorkbenchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ResolutionWorkbenchView id={id} />;
}