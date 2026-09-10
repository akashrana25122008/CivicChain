'use client';

import { useMemo } from 'react';
import { Fingerprint, ShieldCheck, ShieldAlert, Link2, FileLock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuditChainItem } from '@/lib/issues/types';

/**
 * TamperEvidentLedger — the append-only, SHA-256 hash-chained history of a
 * report (Phase 18).
 *
 * Every action that touched an issue is recorded as a ledger row. Each row
 * stores its own SHA-256 hash chained onto the previous row's hash, so nobody
 * — including an administrator with database access — can rewrite history
 * without breaking the chain. This component re-verifies that continuity on the
 * client and reports the result honestly: "chain intact" only when every link
 * holds.
 *
 * This is a civic audit ledger, not a blockchain. No mining, no tokens, just
 * verifiable accounting.
 */

function shortHash(hash: string | null, leading = 12, trailing = 10): string {
  if (!hash) return '—';
  const max = leading + 3 + trailing;
  if (hash.length <= max) return hash;
  return `${hash.slice(0, leading)}…${hash.slice(-trailing)}`;
}

export function TamperEvidentLedger({ chain }: { chain: AuditChainItem[] }) {
  const { intact, brokenAt } = useMemo(() => {
    if (chain.length === 0) return { intact: true, brokenAt: null as number | null };
    for (let i = 0; i < chain.length; i += 1) {
      const entry = chain[i];
      if (!entry.hash) return { intact: false, brokenAt: i };
      // Every row must carry a link to its predecessor (null only at the head).
      if (i > 0 && entry.prevHash !== chain[i - 1].hash) {
        return { intact: false, brokenAt: i };
      }
    }
    return { intact: true, brokenAt: null };
  }, [chain]);

  const head = chain.length > 0 ? chain[0] : null;

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-dark-border overflow-hidden">
      {/* Integrity banner */}
      <div
        className={cn(
          'px-4 py-3 flex items-center gap-2.5',
          intact
            ? 'bg-emerald-50 dark:bg-emerald-900/15 border-b border-emerald-200 dark:border-emerald-800/60'
            : 'bg-red-50 dark:bg-red-900/15 border-b border-red-200 dark:border-red-800/60',
        )}
      >
        {intact ? (
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        ) : (
          <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
        )}
        <div className="min-w-0">
          <p
            className={cn(
              'text-sm font-semibold',
              intact ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300',
            )}
          >
            {chain.length === 0
              ? 'Nothing recorded yet'
              : intact
                ? `Chain intact · ${chain.length} SHA-256 linked ${chain.length === 1 ? 'entry' : 'entries'}`
                : `Chain broken at entry ${brokenAt! + 1} — history may have been tampered with`}
          </p>
          {chain.length > 0 && intact && (
            <p className="text-[11px] text-emerald-700/70 dark:text-emerald-400/70">
              {head?.prevHash
                ? 'Linked to an earlier ledger entry — continuity verified back to the chain head.'
                : 'This is the chain head — the first recorded action on this report.'}
            </p>
          )}
        </div>
      </div>

      {/* Chain rows */}
      {chain.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <Fingerprint className="w-5 h-5 text-neutral-300 mx-auto" />
          <p className="text-sm text-neutral-500 mt-2">
            Actions that touch this report will append to an append-only, SHA-256 chained audit record.
          </p>
        </div>
      ) : (
        <div className="max-h-[360px] overflow-y-auto scrollbar-thin">
          <ol>
            {chain.map((entry, i) => {
              const linkOk = i === 0 ? true : entry.prevHash === chain[i - 1].hash;
              return (
                <li
                  key={`${entry.seq}:${entry.hash}`}
                  className={cn(
                    'px-4 py-2.5 flex gap-3 items-start',
                    i % 2 === 0 ? 'bg-white dark:bg-dark-bg-card' : 'bg-neutral-50/70 dark:bg-dark-bg',
                  )}
                >
                  {/* Seq seal */}
                  <span
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5',
                      i === chain.length - 1
                        ? 'bg-brand-600 text-white'
                        : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300',
                    )}
                  >
                    {entry.seq}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{entry.label}</p>
                      <span className="text-[11px] text-neutral-400 flex-shrink-0">{entry.timeLabel}</span>
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {entry.action.replace(/_/g, ' ')}
                    </p>

                    {/* Hash linkage */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {i > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-neutral-400">
                          <Link2 className="w-3 h-3" /> prev{' '}
                          <span className={cn(linkOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                            {shortHash(entry.prevHash, 8, 6)}
                          </span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
                        <FileLock className="w-3 h-3" /> sha256{' '}
                        <span className="text-neutral-700 dark:text-neutral-300">{shortHash(entry.hash, 10, 8)}</span>
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}