import { useState } from "react";
import { Link } from "react-router-dom";
import { monitoringRoot } from "./api";
import { useRemote } from "./useRemote";
import type { Overview } from "./types";
import { PageHeading, State, Status } from "./ui";
import { short, time } from "./format";
const seriesColor = (name: string) =>
  name === "Transfer" ? 1 : name === "Withdrawal" ? 2 : 0;

export function OverviewPage({ projectId }: { projectId: string }) {
  const [range, setRange] = useState("24h");
  const remote = useRemote<Overview>(
    `${monitoringRoot(projectId)}/overview?range=${range}`,
    true,
  );
  const data = remote.data,
    base = `/projects/${encodeURIComponent(projectId)}/monitoring`;
  const active = data?.monitors.filter((m) => m.enabled) ?? [];
  const healthy =
    active.length > 0 && active.every((m) => m.status === "healthy");
  const health = !data?.rpcConfigured
    ? "Not configured"
    : !active.length
      ? "Paused"
      : healthy
        ? "Healthy"
        : active.some((m) => m.status === "degraded")
          ? "Degraded"
          : active.some((m) => m.status === "catching_up")
            ? "Catching up"
            : "Awaiting worker";
  const blocks = (
    data?.monitors
      .map((m) => m.lastIndexedBlock)
      .filter((v): v is string => v !== null) ?? []
  ).map(BigInt);
  const lastBlock = blocks.length
    ? blocks.reduce((a, b) => (a < b ? a : b)).toLocaleString("en-US")
    : "—";
  const buckets = [...new Set(data?.throughput.map((row) => row.time) ?? [])];
  const series = [
    ...new Set(data?.throughput.map((row) => row.eventName) ?? []),
  ];
  const max = Math.max(1, ...(data?.throughput.map((row) => row.count) ?? []));
  return (
    <>
      <PageHeading
        title="Monitoring Overview"
        description="Visibility into contract activity, indexed events and watcher health."
      >
        <Link className="m3-button m3-primary" to={`${base}/watchers`}>
          Configure Watchers
        </Link>
      </PageHeading>
      <State
        loading={remote.loading}
        error={remote.error}
        retry={remote.refresh}
      >
        {data && (
          <>
            <div className="m3-context">
              <span>
                {data.project.organizationName} / {data.project.name} · Sepolia
                Testnet
              </span>
              <label>
                Time range{" "}
                <select
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                >
                  <option value="1h">Past hour</option>
                  <option value="24h">Past 24 hours</option>
                  <option value="7d">Past 7 days</option>
                </select>
              </label>
              <button className="m3-link" onClick={remote.refresh}>
                Refresh
              </button>
            </div>
            <div className="m3-stats">
              <article className="m3-card">
                <h2>Watcher Status</h2>
                <strong>{health}</strong>
                <p>
                  {healthy
                    ? "Confirmed RPC indexing is up to date"
                    : !data.rpcConfigured
                      ? "Sepolia RPC setup required"
                      : `${active.length} watcher(s) enabled`}
                </p>
              </article>
              <article className="m3-card">
                <h2>Event Rate</h2>
                <strong>{data.eventRate} events/min</strong>
                <p>Indexed in the past minute</p>
              </article>
              <article className="m3-card">
                <h2>Last Indexed Block</h2>
                <strong>{lastBlock}</strong>
                <p>
                  {blocks.length
                    ? "Lowest checkpoint across indexed contracts"
                    : "No confirmed block indexed yet"}
                </p>
              </article>
            </div>
            <section className="m3-card m3-throughput">
              <div className="m3-section-heading">
                <h2>
                  Event Throughput (
                  {range === "24h"
                    ? "past 24 hours"
                    : range === "1h"
                      ? "past hour"
                      : "past 7 days"}
                  )
                </h2>
                <div className="m3-legend">
                  {(series.length
                    ? series
                    : ["Deposit", "Transfer", "Withdrawal"]
                  ).map((name) => (
                    <span
                      key={name}
                      className={`m3-series-${seriesColor(name)}`}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
              <p className="m3-muted">Indexed events · UTC</p>
              {!buckets.length ? (
                <div className="m3-chart-empty">
                  No indexed events in this period.
                </div>
              ) : (
                <>
                  <div
                    className="m3-chart"
                    role="img"
                    aria-label="Indexed event counts by hour. Exact values are in the data table."
                  >
                    {buckets.map((bucket) => (
                      <div className="m3-bar-group" key={bucket}>
                        {series.map((name) => (
                          <span
                            key={name}
                            className={`m3-bar m3-bar-${seriesColor(name)}`}
                            title={`${time(bucket)} · ${name}: ${data.throughput.find((row) => row.time === bucket && row.eventName === name)?.count ?? 0}`}
                            style={{
                              height: `${((data.throughput.find((row) => row.time === bucket && row.eventName === name)?.count ?? 0) / max) * 100}%`,
                            }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  <details>
                    <summary>View all event counts</summary>
                    <div className="m3-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Hour (UTC)</th>
                            <th>Event</th>
                            <th>Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.throughput.map((row) => (
                            <tr key={`${row.time}:${row.eventName}`}>
                              <td>{time(row.time)}</td>
                              <td>{row.eventName}</td>
                              <td>{row.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </>
              )}
            </section>
            <div className="m3-two-columns">
              <section className="m3-card">
                <div className="m3-section-heading">
                  <h2>Monitored Contracts ({data.monitors.length})</h2>
                  <Link to={`${base}/watchers`}>View all →</Link>
                </div>
                {data.monitors.length ? (
                  <ul className="m3-contract-list">
                    {data.monitors.slice(0, 5).map((m) => (
                      <li key={m.id}>
                        <Link to={`${base}/events?monitoredContractId=${m.id}`}>
                          {m.name}
                        </Link>
                        <code title={m.address}>{short(m.address)}</code>
                        <Status value={m.status} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="m3-muted">
                    No monitored contracts.{" "}
                    <Link to={`${base}/contracts/new`}>
                      Choose a registry contract →
                    </Link>
                  </p>
                )}
              </section>
              <section className="m3-card">
                <div className="m3-section-heading">
                  <h2>Recent Alerts ({data.alerts.length})</h2>
                  <Link to={`${base}/alerts`}>View all →</Link>
                </div>
                {data.alerts.length ? (
                  <ul className="m3-alert-list">
                    {data.alerts.map((a) => (
                      <li key={a.id}>
                        <Link to={`${base}/alerts/${a.id}`}>{a.title}</Link>
                        <span>{a.contractName}</span>
                        <Status value={a.removed ? "invalidated" : a.status} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="m3-muted">No rule-generated alerts yet.</p>
                )}
                {data.monitors
                  .filter((m) => m.lastError)
                  .map((m) => (
                    <p className="m3-warning" key={m.id}>
                      {m.name}: {m.lastError}
                    </p>
                  ))}
              </section>
            </div>
            <Link className="m3-button m3-primary" to={`${base}/events`}>
              Browse contract events
            </Link>
            <p className="m3-muted m3-small">
              Updated {time(data.fetchedAt)} · Refreshes every 10 seconds while
              this tab is visible.
            </p>
          </>
        )}
      </State>
    </>
  );
}
