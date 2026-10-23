import { useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { monitoringApi, monitoringRoot } from "./api";
import { useRemote } from "./useRemote";
import type { Alert, AlertRule, Catalog, Page, Watcher } from "./types";
import { PageHeading, Pager, State, Status } from "./ui";
import { errorText, short, time } from "./format";

export function AlertsPage({ projectId }: { projectId: string }) {
  const [query, setQuery] = useSearchParams(),
    base = `/projects/${projectId}/monitoring`;
  const remote = useRemote<Page<Alert>>(
    `${monitoringRoot(projectId)}/alerts?${query}`,
    true,
  );
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(query);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setQuery(next);
  };
  return (
    <>
      <PageHeading
        title="Alert Inbox"
        description="Monitor and respond to rule-generated alerts across your contracts."
        area="Alerts"
      >
        <Link className="m3-button m3-primary" to={`${base}/rules/new`}>
          + New rule
        </Link>
      </PageHeading>
      <div className="m3-tabs">
        <span className="m3-button m3-primary">
          All alerts · {remote.data?.total ?? "—"}
        </span>
        <Link className="m3-button" to={`${base}/rules`}>
          Alert Rules
        </Link>
      </div>
      <div className="m3-filters">
        <label className="m3-field">
          Search alerts
          <input
            placeholder="Search by alert name"
            maxLength={120}
            value={query.get("search") ?? ""}
            onChange={(e) => update("search", e.target.value)}
          />
        </label>
        <label className="m3-field">
          Severity
          <select
            value={query.get("severity") ?? ""}
            onChange={(e) => update("severity", e.target.value)}
          >
            <option value="">All severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label className="m3-field">
          Status
          <select
            value={query.get("status") ?? ""}
            onChange={(e) => update("status", e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
        <label className="m3-field">
          Period
          <select
            value={query.get("days") ?? "7"}
            onChange={(e) => update("days", e.target.value)}
          >
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="365">Last year</option>
          </select>
        </label>
      </div>
      <State
        loading={remote.loading}
        error={remote.error}
        retry={remote.refresh}
      >
        {remote.data && (
          <>
            <div className="m3-table-wrap m3-inbox">
              <table>
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Alert</th>
                    <th>Source</th>
                    <th>Contract / target</th>
                    <th>Triggered</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {remote.data.items.map((alert) => (
                    <tr key={alert.id}>
                      <td>
                        <Status value={alert.severity} />
                      </td>
                      <td>
                        <Link to={`${base}/alerts/${alert.id}`}>
                          {alert.title}
                        </Link>
                        <small>
                          {alert.eventName} · block {alert.blockNumber}
                        </small>
                      </td>
                      <td>Contract event</td>
                      <td>
                        {alert.contractName}
                        <small>
                          <code title={alert.address}>
                            {short(alert.address)}
                          </code>
                        </small>
                      </td>
                      <td>{time(alert.createdAt)}</td>
                      <td>
                        <Status
                          value={alert.removed ? "invalidated" : alert.status}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!remote.data.items.length && (
                <div className="m3-card m3-state">
                  <h2>No alerts found</h2>
                  <p>
                    Alerts appear when indexed events match an enabled rule.
                  </p>
                  <Link to={`${base}/rules`}>Manage alert rules →</Link>
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
      <div className="m3-actions">
        <button className="m3-link" onClick={() => setQuery({})}>
          Clear filters
        </button>
        <Link className="m3-button" to={`${base}/rules`}>
          Manage alert rules
        </Link>
      </div>
    </>
  );
}

export function RulesPage({ projectId }: { projectId: string }) {
  const root = monitoringRoot(projectId),
    base = `/projects/${projectId}/monitoring`;
  const remote = useRemote<AlertRule[]>(`${root}/rules`),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const toggle = async (rule: AlertRule) => {
    if (busy) return;
    setBusy(rule.id);
    setError("");
    try {
      await monitoringApi.request(`${root}/rules/${rule.id}`, "PATCH", {
        enabled: !rule.enabled,
      });
      remote.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  };
  return (
    <>
      <PageHeading
        title="Alert Rules"
        description="Define typed event rules for monitored contracts."
        area="Alerts"
      >
        <Link className="m3-button m3-primary" to={`${base}/rules/new`}>
          + New rule
        </Link>
      </PageHeading>
      <div className="m3-tabs">
        <span className="m3-button m3-primary">
          All rules · {remote.data?.length ?? "—"}
        </span>
      </div>
      {error && (
        <p className="m3-error" role="alert">
          {error}
        </p>
      )}
      <State
        loading={remote.loading}
        error={remote.error}
        retry={remote.refresh}
      >
        {remote.data && (
          <div className="m3-table-wrap m3-rules-table">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Name</th>
                  <th>Condition</th>
                  <th>Target</th>
                  <th>Channel</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {remote.data.map((rule) => (
                  <tr key={rule.id}>
                    <td>
                      Event
                      <small>
                        <Status value={rule.severity} />
                      </small>
                    </td>
                    <td>
                      {rule.name}
                      <small>{rule.description}</small>
                    </td>
                    <td>
                      {rule.eventName} · {rule.condition.field}{" "}
                      {rule.condition.operator} {rule.condition.value}
                      {rule.windowSeconds && (
                        <small>within {rule.windowSeconds}s</small>
                      )}
                    </td>
                    <td>{rule.contractName ?? "All project contracts"}</td>
                    <td>
                      Alert inbox<small>M5 delivery pending</small>
                    </td>
                    <td>
                      <button
                        className="m3-link"
                        disabled={Boolean(busy)}
                        onClick={() => void toggle(rule)}
                        aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.name}`}
                      >
                        {busy === rule.id
                          ? "Saving…"
                          : rule.enabled
                            ? "Enabled"
                            : "Disabled"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!remote.data.length && (
              <div className="m3-card m3-state">
                <h2>No alert rules</h2>
                <p>Create a rule to evaluate indexed contract events.</p>
                <Link to={`${base}/rules/new`}>Create your first rule →</Link>
              </div>
            )}
          </div>
        )}
      </State>
      <Link to={`${base}/alerts`}>Back to inbox →</Link>
    </>
  );
}

export function CreateRulePage({ projectId }: { projectId: string }) {
  const root = monitoringRoot(projectId),
    base = `/projects/${projectId}/monitoring`,
    navigate = useNavigate();
  const watchers = useRemote<{ items: Watcher[] }>(`${root}/watchers`);
  const [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [monitorId, setMonitorId] = useState("");
  const [eventName, setEventName] = useState(""),
    [mode, setMode] = useState<"count" | "parameter">("count"),
    [field, setField] = useState("amount");
  const [operator, setOperator] =
      useState<AlertRule["condition"]["operator"]>("gt"),
    [value, setValue] = useState(""),
    [windowSeconds, setWindow] = useState(3600);
  const [severity, setSeverity] = useState<AlertRule["severity"]>("warning"),
    [enabled, setEnabled] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const target = watchers.data?.items.find((m) => m.id === monitorId);
  const save = async () => {
    if (busy) return;
    if (!/^(0|[1-9][0-9]{0,77})$/.test(value) || BigInt(value) >= 1n << 256n) {
      setError("Enter a uint256 threshold as a whole decimal number.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await monitoringApi.request(`${root}/rules`, "POST", {
        name,
        description,
        eventName,
        condition: {
          field: mode === "count" ? "count" : field,
          operator,
          value,
        },
        enabled,
        severity,
        mode,
        ...(monitorId ? { monitoredContractId: monitorId } : {}),
        ...(mode === "count" ? { windowSeconds } : {}),
      });
      navigate(`${base}/rules`, { state: { saved: true } });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeading
        title="Create Alert Rule"
        description="Set up a rule to detect matching indexed contract events."
        back={`${base}/rules`}
        area="Alerts"
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="m3-actions m3-form-actions">
          <button className="m3-button m3-primary" disabled={busy}>
            {busy ? "Saving…" : "Save rule"}
          </button>
          <Link className="m3-button" to={`${base}/rules`}>
            Cancel
          </Link>
        </div>
        {error && (
          <p className="m3-error" role="alert">
            {error}
          </p>
        )}
        <div className="m3-rule-columns">
          <div className="m3-form-stack">
            <section className="m3-card">
              <h2>1 Basic information</h2>
              <label className="m3-field">
                Name *
                <input
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="High event volume"
                />
              </label>
              <label className="m3-field">
                Description
                <input
                  maxLength={1000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe why this rule matters"
                />
              </label>
            </section>
            <section className="m3-card">
              <h2>2 Scope</h2>
              <label className="m3-field">
                Contract
                <select
                  value={monitorId}
                  onChange={(e) => {
                    setMonitorId(e.target.value);
                    setEventName("");
                  }}
                >
                  <option value="">All monitored project contracts</option>
                  {watchers.data?.items.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {short(m.address)}
                    </option>
                  ))}
                </select>
              </label>
              {watchers.error && (
                <p role="alert" className="m3-error">
                  {watchers.error.message}
                </p>
              )}
            </section>
            <section className="m3-card">
              <h2>3 Condition</h2>
              {target ? (
                <RuleEventFields
                  key={target.id}
                  root={root}
                  target={target}
                  eventName={eventName}
                  setEventName={setEventName}
                  field={field}
                  setField={setField}
                  mode={mode}
                />
              ) : (
                <label className="m3-field">
                  Event *
                  <input
                    required
                    maxLength={128}
                    pattern="[A-Za-z_][A-Za-z0-9_]*"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="Transfer"
                  />
                </label>
              )}
              <label className="m3-field">
                Condition type
                <select
                  value={mode}
                  onChange={(e) =>
                    setMode(e.target.value as "count" | "parameter")
                  }
                >
                  <option value="count">Event count in a time window</option>
                  <option value="parameter">Numeric event parameter</option>
                </select>
              </label>
              {mode === "parameter" && !target && (
                <label className="m3-field">
                  Parameter *
                  <input
                    required
                    pattern="[A-Za-z_][A-Za-z0-9_]*"
                    maxLength={128}
                    value={field}
                    onChange={(e) => setField(e.target.value)}
                  />
                </label>
              )}
              <div className="m3-two-columns">
                <label className="m3-field">
                  Operator
                  <select
                    value={operator}
                    onChange={(e) =>
                      setOperator(
                        e.target.value as AlertRule["condition"]["operator"],
                      )
                    }
                  >
                    {[
                      ["gt", "Greater than"],
                      ["gte", "Greater than or equal"],
                      ["eq", "Equal"],
                      ["lt", "Less than"],
                      ["lte", "Less than or equal"],
                    ].map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="m3-field">
                  Threshold *
                  <input
                    required
                    inputMode="numeric"
                    pattern="(0|[1-9][0-9]{0,77})"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="500"
                  />
                </label>
              </div>
              {mode === "count" && (
                <label className="m3-field">
                  Time window *
                  <select
                    value={windowSeconds}
                    onChange={(e) => setWindow(Number(e.target.value))}
                  >
                    <option value={60}>1 minute</option>
                    <option value={300}>5 minutes</option>
                    <option value={3600}>1 hour</option>
                    <option value={86400}>24 hours</option>
                  </select>
                </label>
              )}
            </section>
          </div>
          <div className="m3-form-stack">
            <section className="m3-card">
              <h2>Rule preview</h2>
              <p>
                When{" "}
                {mode === "count"
                  ? "the number of"
                  : "the " + field + " parameter of"}{" "}
                {eventName || "selected"} events on{" "}
                {target?.name ?? "each project contract"} is {operator}{" "}
                {value || "…"}
                {mode === "count" ? ` within ${windowSeconds} seconds` : ""},
                create an alert.
              </p>
              <dl className="m3-compact-definition">
                <dt>Type</dt>
                <dd>Event</dd>
                <dt>Target</dt>
                <dd>{target?.name ?? "Project-wide"}</dd>
                <dt>Status</dt>
                <dd>{enabled ? "Enabled" : "Disabled"}</dd>
              </dl>
            </section>
            <section className="m3-card">
              <h2>4 Notifications</h2>
              <p>Matched rules create a persisted alert in the inbox.</p>
              <label className="m3-check">
                <input type="checkbox" disabled />
                In-app notification
              </label>
              <label className="m3-check">
                <input type="checkbox" disabled />
                Email notification
              </label>
              <small className="m3-muted">
                Delivery depends on the shared M5 notification service. These
                channels are not connected yet.
              </small>
            </section>
            <section className="m3-card">
              <h2>5 Status</h2>
              <label className="m3-field">
                Severity
                <select
                  value={severity}
                  onChange={(e) =>
                    setSeverity(e.target.value as AlertRule["severity"])
                  }
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <label className="m3-check">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                Enable this rule
              </label>
              <p className="m3-muted">
                Enabled rules evaluate newly indexed events. A configured
                watcher and worker are required.
              </p>
            </section>
          </div>
        </div>
      </form>
    </>
  );
}

function RuleEventFields({
  root,
  target,
  eventName,
  setEventName,
  field,
  setField,
  mode,
}: {
  root: string;
  target: Watcher;
  eventName: string;
  setEventName: (s: string) => void;
  field: string;
  setField: (s: string) => void;
  mode: string;
}) {
  const remote = useRemote<Catalog>(`${root}/watchers/${target.id}/catalog`);
  const event = remote.data?.events.find((e) => e.name === eventName),
    fields =
      event?.fields.filter((f) => /^uint(?:[0-9]+)?$/.test(f.type)) ?? [];
  return (
    <State loading={remote.loading} error={remote.error} retry={remote.refresh}>
      {remote.data && (
        <>
          {!remote.data.available && (
            <p className="m3-warning">{remote.data.message}</p>
          )}
          <label className="m3-field">
            Event *
            <select
              required
              value={eventName}
              onChange={(e) => {
                setEventName(e.target.value);
                setField("");
              }}
            >
              <option value="">Select an ABI event</option>
              {remote.data.events.map((e) => (
                <option key={e.signature} value={e.name}>
                  {e.signature}
                </option>
              ))}
            </select>
          </label>
          {mode === "parameter" && (
            <label className="m3-field">
              Parameter *
              <select
                required
                value={field}
                onChange={(e) => setField(e.target.value)}
              >
                <option value="">Select an unsigned numeric parameter</option>
                {fields.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name} ({f.type})
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
    </State>
  );
}

export function AlertDetailPage({ projectId }: { projectId: string }) {
  const { alertId = "" } = useParams(),
    root = monitoringRoot(projectId),
    base = `/projects/${projectId}/monitoring`;
  const remote = useRemote<Alert>(
    `${root}/alerts/${encodeURIComponent(alertId)}`,
    true,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [notice, setNotice] = useState("");
  const alert = remote.data;
  const mutate = async (action: "acknowledge" | "resolve") => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await monitoringApi.request(
        `${root}/alerts/${alertId}/${action}`,
        "POST",
        { note },
      );
      setNote("");
      setNotice(
        action === "acknowledge" ? "Alert acknowledged." : "Alert resolved.",
      );
      remote.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeading
        title={alert?.title ?? "Alert detail"}
        description="Review the triggering event, rule result and incident history."
        back={`${base}/alerts`}
        area="Alerts"
      />
      <State
        loading={remote.loading}
        error={remote.error}
        retry={remote.refresh}
      >
        {alert && (
          <>
            <div className="m3-card">
              <p>
                <code>{short(alert.id)}</code> ·{" "}
                <Status value={alert.severity} /> ·{" "}
                <Status value={alert.removed ? "invalidated" : alert.status} />
              </p>
              <p className="m3-muted">
                Triggered {time(alert.createdAt)} · {alert.contractName}
              </p>
            </div>
            <div className="m3-actions">
              <button
                className="m3-button"
                disabled={busy || alert.status !== "open" || alert.removed}
                onClick={() => void mutate("acknowledge")}
              >
                Acknowledge
              </button>
              <button
                className="m3-button m3-primary"
                disabled={busy || alert.status === "resolved" || alert.removed}
                onClick={() => void mutate("resolve")}
              >
                ✓ Resolve
              </button>
              <Link to={`${base}/alerts`}>Back to inbox →</Link>
            </div>
            {notice && (
              <p className="m3-notice" role="status">
                ✓ {notice}
              </p>
            )}
            {error && (
              <p className="m3-error" role="alert">
                {error}
              </p>
            )}
            {alert.removed && (
              <p className="m3-warning">
                The triggering event was removed by a chain reorganization. This
                alert is retained for history and cannot be acknowledged or
                resolved.
              </p>
            )}
            <div className="m3-tabs">
              <span className="m3-button m3-primary">Overview</span>
            </div>
            <div className="m3-two-columns">
              <section className="m3-card">
                <h2>Alert summary</h2>
                <p>
                  {alert.evidence.mode === "count"
                    ? "Event count"
                    : alert.evidence.condition.field}
                  : {alert.evidence.observed}{" "}
                  {alert.evidence.condition.operator}{" "}
                  {alert.evidence.condition.value}
                  {alert.evidence.windowSeconds
                    ? ` within ${alert.evidence.windowSeconds}s`
                    : ""}
                  .
                </p>
                <p>
                  <Link to={`${base}/events/${alert.eventId}`}>
                    Contract · {alert.contractName} · {short(alert.address)}
                  </Link>
                </p>
                <p>
                  <Link to={`${base}/rules`}>Rule · {alert.title}</Link>
                </p>
                <Link to={`${base}/events/${alert.eventId}`}>
                  View related activity →
                </Link>
              </section>
              <section className="m3-card">
                <h2>Triggering chain evidence</h2>
                <dl className="m3-definition">
                  <div>
                    <dt>Event</dt>
                    <dd>{alert.eventName}</dd>
                  </div>
                  <div>
                    <dt>Block</dt>
                    <dd>{alert.blockNumber}</dd>
                  </div>
                  <div>
                    <dt>Transaction</dt>
                    <dd>
                      <a
                        href={`https://sepolia.etherscan.io/tx/${alert.transactionHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {short(alert.transactionHash)} ↗
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt>Network</dt>
                    <dd>{alert.network}</dd>
                  </div>
                </dl>
              </section>
              <section className="m3-card">
                <h2>Incident timeline</h2>
                <ol className="m3-history">
                  {alert.history?.map((item) => (
                    <li key={item.id}>
                      <time dateTime={item.createdAt}>
                        {time(item.createdAt)}
                      </time>
                      <strong>
                        {item.action} · {item.actorName ?? "Monitoring worker"}
                      </strong>
                      {item.note && <p>{item.note}</p>}
                    </li>
                  ))}
                </ol>
              </section>
              <section className="m3-card">
                <h2>Owner and notes</h2>
                <p>
                  Acknowledged by: {alert.acknowledgedBy ?? "Not acknowledged"}
                </p>
                <p>Resolved by: {alert.resolvedBy ?? "Not resolved"}</p>
                <label className="m3-field">
                  Transition note (optional)
                  <textarea
                    maxLength={2000}
                    value={note}
                    disabled={
                      alert.status === "resolved" || alert.removed || busy
                    }
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add context before acknowledging or resolving"
                  />
                </label>
                <p className="m3-muted">
                  Notes are saved with the selected action. Acknowledgement
                  records responsibility; resolution is a separate transition.
                </p>
              </section>
            </div>
          </>
        )}
      </State>
    </>
  );
}
