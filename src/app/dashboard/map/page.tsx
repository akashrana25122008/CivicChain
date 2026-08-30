import { redirect } from 'next/navigation';

/** Legacy location — the map now lives at /map (workspace-first route). */
export default function LegacyMapPage() {
  redirect('/map');
}