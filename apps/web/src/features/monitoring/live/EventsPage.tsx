import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { monitoringRoot } from "./api";
import { useRemote } from "./useRemote";
import type { ChainEvent, Page, Watcher } from "./types";
import { Json, PageHeading, Pager, State, Status } from "./ui";
import { short, time } from "./format";

export function EventsPage({ projectId }: { projectId: string }) {
  const [query, setQuery] = useSearchParams();
  const { contractId } = useParams();
  const root = monitoringRoot(projectId),
    base = `/projects/${projectId}/monitoring`;
  const filters = new URLSearchParams(query);
  if (contractId) filters.set("monitoredContractId", contractId);
  const remote = useRemote<Page<ChainEvent>>(`${root}/events?${filters}`, true);
  const watchers = useRemote<{ items: Watcher[] }>(`${root}/watchers`);
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(query);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setQuery(next);
  };
  const exportCsv = () => {
    const rows = [
      [
        "Time (UTC)",
        "Event",
        "Contract",
        "Transaction Hash",
        "Block",
        "Log Index",
        "Removed",
      ],
      ...(remote.data?.items.map((e) => [
        e.timestamp,
        e.eventName ?? "Unknown",
        e.contractName,
        e.transactionHash,
        e.blockNumber,
        String(e.logIndex),
        String(e.removed),
      ]) ?? []),
    ];
    const csv = rows
      .map((row) =>
        row
          .map(
            (value) =>
              `"${(/^[=+@-]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`,
          )
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      ),
      link = document.createElement("a");
    link.href = url;
    link.download = "chainops-indexed-events.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHeading
        title="Contract Events"
        description="Browse decoded events from monitored contracts."
        back={base}
      >
        <button
          className="m3-button"
          disabled={!remote.data?.items.length}
          title="Export the currently displayed page"
          onClick={exportCsv}
        >
          Export CSV
        </button>
        <span className="m3-button m3-muted">Refresh · 10s</span>
      </PageHeading>
      <div className="m3-filters m3-event-filters">
        <label className="m3-field">
          Contract
          <select
            value={filters.get("monitoredContractId") ?? ""}
            disabled={Boolean(contractId)}
            onChange={(e) => update("monitoredContractId", e.target.value)}
          >
            <option value="">All contracts</option>
            {watchers.data?.items.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="m3-field">
          Event type
          <input
            value={query.get("eventName") ?? ""}
            placeholder="All events"
            onChange={(e) => update("eventName", e.target.value)}
          />
        </label>
        <label className="m3-field">
          From (UTC)
          <input
            type="datetime-local"
            value={(query.get("from") ?? "").replace("Z", "")}
            onChange={(e) =>
              update("from", e.target.value ? `${e.target.value}Z` : "")
            }
          />
        </label>
        <label className="m3-field">
          To (UTC)
          <input
            type="datetime-local"
            value={(query.get("to") ?? "").replace("Z", "")}
            onChange={(e) =>
              update("to", e.target.value ? `${e.target.value}Z` : "")
            }
          />
        </label>
        <button className="m3-button" onClick={() => setQuery({})}>
          Clear
        </button>
      </div>
      {watchers.error && (
        <p role="alert" className="m3-error">
          Contract filter unavailable: {watchers.error.message}
        </p>
      )}
      <State
        loading={remote.loading}
        error={remote.error}
        retry={remote.refresh}
      >
        {remote.data && (
          <>
            <div className="m3-card m3-table-card">
              <div className="m3-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Time (UTC)</th>
                      <th>Event</th>
                      <th>Contract</th>
                      <th>Transaction Hash</th>
                      <th>Block</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {remote.data.items.map((event) => (
                      <tr key={event.id}>
                        <td>{time(event.timestamp)}</td>
                        <td>
                          <Link to={`${base}/events/${event.id}`}>
                            {event.eventName ?? "Unknown ABI event"}
                          </Link>
                          {event.removed && <Status value="invalidated" />}
                        </td>
                        <td>{event.contractName}</td>
                        <td>
                          <a
                            href={`https://sepolia.etherscan.io/tx/${event.transactionHash}`}
                            target="_blank"
                            rel="noreferrer"
                            title={event.transactionHash}
                          >
                            {short(event.transactionHash)} ↗
                          </a>
                        </td>
                        <td>
                          {BigInt(event.blockNumber).toLocaleString("en-US")}
                        </td>
                        <td>
                          <Link to={`${base}/events/${event.id}`}>View →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!remote.data.items.length && (
                <div className="m3-state">
                  <h2>No indexed events</h2>
                  <p>
                    Events appear after a registered contract has subscriptions
                    and a configured worker indexes confirmed blocks.
                  </p>
                  <Link to={`${base}/watchers`}>Configure watchers →</Link>
                </div>
              )}
            </div>
            <Pager
              page={remote.data.page}
              total={remote.data.total}
              limit={remote.data.limit}
              onChange={(page) => update("page", String(page))}
            />
          </>
        )}
      </State>
    </>
  );
}

export function EventDetailPage({ projectId }: { projectId: string }) {
  const { eventId = "" } = useParams(),
    base = `/projects/${projectId}/monitoring`;
  const remote = useRemote<
    ChainEvent & { previousId: string | null; nextId: string | null }
  >(`${monitoringRoot(projectId)}/events/${encodeURIComponent(eventId)}`);
  const [tab, setTab] = useState("Raw Log"),
    event = remote.data;
  return (
    <>
      <PageHeading
        title={
          event
            ? `${event.eventName ?? "Unknown event"} · Decoded`
            : "Decoded Event"
        }
        description={
          event
            ? `Indexed ${event.eventName ?? "unknown"} event emitted by ${event.contractName}.`
            : "Inspect indexed chain evidence and decoded arguments."
        }
        back={`${base}/events`}
      >
        <div className="m3-actions">
          {event?.previousId ? (
            <Link
              className="m3-button"
              to={`${base}/events/${event.previousId}`}
            >
              ← Previous
            </Link>
          ) : (
            <button className="m3-button" disabled>
              ← Previous
            </button>
          )}
          {event?.nextId ? (
            <Link className="m3-button" to={`${base}/events/${event.nextId}`}>
              Next →
            </Link>
          ) : (
            <button className="m3-button" disabled>
              Next →
            </button>
          )}
        </div>
      </PageHeading>
      <State
        loading={remote.loading}
        error={remote.error}
        retry={remote.refresh}
      >
        {event && (
          <>
            <div className="m3-card m3-release">
              Registry version · {event.registryVersion ?? "Unavailable"} ·{" "}
              {event.network} ·{" "}
              <Link to={`${base}/watchers`}>Watcher configuration</Link>
              {event.releaseContext?.commitSha && (
                <span>
                  {" "}
                  · Commit <code>{event.releaseContext.commitSha}</code>
                </span>
              )}
              {event.releaseContext?.pipelineRunId && (
                <span>
                  {" "}
                  · Run <code>{event.releaseContext.pipelineRunId}</code>
                </span>
              )}
              {event.releaseContext?.artifactId && (
                <span>
                  {" "}
                  · Artifact <code>{event.releaseContext.artifactId}</code>
                </span>
              )}
            </div>
            {event.removed && (
              <p role="alert" className="m3-warning">
                This log was removed by a chain reorganization. It is retained
                as historical evidence.
              </p>
            )}
            <div className="m3-event-columns">
              <section className="m3-card">
                <h2>Overview</h2>
                <dl className="m3-definition">
                  {[
                    ["Contract", event.contractName],
                    ["Address", event.address],
                    ["Event", event.signature ?? "Unmatched ABI event"],
                    ["Transaction Hash", event.transactionHash],
                    ["Block Number", event.blockNumber],
                    ["Block Timestamp", time(event.timestamp)],
                    ["Block Hash", event.blockHash],
                    ["Log Index", String(event.logIndex)],
                    ["Transaction Index", String(event.transactionIndex)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <a
                  href={`https://sepolia.etherscan.io/tx/${event.transactionHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction ↗
                </a>
              </section>
              <div className="m3-form-stack">
                <section className="m3-card">
                  <h2>Decoded Event Data</h2>
                  {event.decodeError ? (
                    <p className="m3-warning">{event.decodeError}</p>
                  ) : (
                    <Json value={event.args} />
                  )}
                </section>
                <div
                  className="m3-tabs"
                  role="tablist"
                  aria-label="Event evidence"
                >
                  {["Raw Log", "ABI"].map((name) => (
                    <button
                      className={`m3-button${tab === name ? " m3-primary" : ""}`}
                      role="tab"
                      aria-selected={tab === name}
                      aria-controls="m3-evidence-panel"
                      id={`m3-evidence-${name.replaceAll(" ", "-")}`}
                      key={name}
                      onClick={() => setTab(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <section
                  className="m3-card"
                  id="m3-evidence-panel"
                  role="tabpanel"
                  aria-labelledby={`m3-evidence-${tab.replaceAll(" ", "-")}`}
                >
                  <Json value={tab === "ABI" ? event.abi : event.rawLog} />
                </section>
              </div>
            </div>
          </>
        )}
      </State>
    </>
  );
}
