import { CivicMap } from '@/components/map/CivicMap';

/**
 * Civic Map — first-class geographic view of real civic reports.
 * Auth is enforced by the server layout + Proxy; scoping decisions
 * (which reports a role may see) are made by /api/map server-side.
 */
export default function MapPage() {
  return <CivicMap />;
}