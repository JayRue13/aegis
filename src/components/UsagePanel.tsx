"use client";

import { useEffect, useState } from "react";
import type { Usage } from "@/lib/usage";
import { Modal } from "./Modal";

export function UsagePanel({
  load,
  dailyLimit,
  onClose,
}: {
  load: () => Promise<Usage>;
  dailyLimit?: number;
  onClose: () => void;
}) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load()
      .then(setUsage)
      .catch((e: Error) => setError(e.message));
  }, [load]);

  return (
    <Modal title="Usage" onClose={onClose} wide>
      {error && <p className="text-sm text-danger">Couldn&apos;t load usage: {error}</p>}
      {!usage && !error && <p className="text-sm text-muted">Loading…</p>}
      {usage && (
        <div className="space-y-7">
          <section>
            <h3 className="text-sm font-semibold">Your messages</h3>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center" data-testid="own-usage">
              {(
                [
                  ["Today", usage.own.today],
                  ["Last 7 days", usage.own.last7],
                  ["Last 30 days", usage.own.last30],
                ] as const
              ).map(([label, n]) => (
                <div key={label} className="rounded-xl border border-line bg-surface-2/50 px-3 py-2.5">
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{n}</dd>
                </div>
              ))}
            </dl>
            {dailyLimit ? (
              <p className="mt-2 text-xs text-muted">
                Daily limit: {dailyLimit} messages, resetting at midnight UTC. Admins are not limited.
              </p>
            ) : null}
          </section>

          {usage.everyone && (
            <section>
              <h3 className="text-sm font-semibold">Everyone (last 30 days)</h3>
              <p className="mt-0.5 text-xs text-faint">Only admins see this.</p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm" data-testid="everyone-usage">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="py-1.5 pr-3 font-medium">Person</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Today</th>
                      <th className="py-1.5 pr-3 text-right font-medium">7 days</th>
                      <th className="py-1.5 pr-3 text-right font-medium">30 days</th>
                      <th className="py-1.5 font-medium">Last active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.everyone.map((r) => (
                      <tr key={r.email} className="border-t border-line">
                        <td className="py-1.5 pr-3 break-all">{r.email}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{r.today}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{r.last7}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{r.last30}</td>
                        <td className="py-1.5 whitespace-nowrap text-muted">{r.lastActive ?? "–"}</td>
                      </tr>
                    ))}
                    {usage.everyone.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-faint">
                          No messages in the last 30 days.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
