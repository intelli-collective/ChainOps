import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { monitoringApi, monitoringRoot } from "./api";
import { useRemote } from "./useRemote";
import type { Catalog, RegistryResult, Watcher } from "./types";
import { Json, PageHeading, State, Status } from "./ui";
import { errorText, short, time } from "./format";

export function WatchersPage({ projectId }: { projectId: string }) {
  const root = monitoringRoot(projectId),
    base = `/projects/${projectId}/monitoring`;
  const remote = useRemote<{ rpcConfigured: boolean; items: Watcher[] }>(
    `${root}/watchers`,
    true,
  );
  const [selectedId, setSelectedId] = useState("");
  const [saved, setSaved] = useState<Watcher | null>(null);
  const [connection, setConnection] = useState("");
  const [testing, setTesting] = useState(false);
  const selected =
    remote.data?.items.find((m) => m.id === selectedId) ??
    remote.data?.items[0];
  const test = async () => {
    setTesting(true);
    setConnection("");
    try {
      const result = await monitoringApi.request<{
        headBlock: string;
        checkedAt: string;
      }>(`${root}/test-connection`, "POST", {});
      setConnection(
        `RPC reachable · Sepolia head ${result.headBlock} · ${time(result.checkedAt)}. Indexer status is shown separately.`,
      );
    } catch (error) {
      setConnection(errorText(error));
    } finally {
      setTesting(false);
    }
  };
  if (saved)
    return (
      <>
        <PageHeading
          title="Watcher Settings Saved"
          description="Your watcher configuration has been saved."
          back={base}
        />
        <div className="m3-card m3-saved">
          <h2>✓ Watcher configuration saved</h2>
          <p>Network: Sepolia Testnet</p>
          <p>
            Contract: {saved.name} · {short(saved.address)}
          </p>
          <p>Polling interval: {saved.pollingSeconds}s</p>
          <p>
            {saved.enabled
              ? "Enabled · queued for the standalone worker"
              : "Paused · indexing disabled"}
          </p>
          <div className="m3-actions">
            <Link className="m3-button m3-primary" to={base}>
              Open Monitoring
            </Link>
            <button className="m3-button" onClick={() => setSaved(null)}>
              Return to configuration
            </button>
          </div>
        </div>
      </>
    );
  return (
    <>
      <PageHeading
        title="Watcher Configuration"
        description="Configure monitored contracts, event subscriptions and indexing settings."
        back={base}
      >
        {selected && (
          <button
            className="m3-button m3-primary"
            type="submit"
            form="m3-watcher-settings"
          >
            Save Changes
          </button>
        )}
      </PageHeading>
      <State
        loading={remote.loading}
        error={remote.error}
        retry={remote.refresh}
      >
        {remote.data && (
          <>
            <section className="m3-card">
              <div className="m3-section-heading">
                <Status
                  value={
                    !remote.data.rpcConfigured
                      ? "unconfigured"
                      : (selected?.status ?? "pending")
                  }
                />
                <button
                  className="m3-button"
                  disabled={testing}
                  onClick={() => void test()}
                >
                  {testing ? "Testing…" : "Test Connection"}
                </button>
              </div>
              <p className="m3-muted">
                Sepolia Testnet RPC · Last indexed block:{" "}
                {selected?.lastIndexedBlock ?? "None"} · Polling interval:{" "}
                {selected?.pollingSeconds ?? 10}s
              </p>
              {connection && <p role="status">{connection}</p>}
            </section>
            <div className="m3-watcher-columns">
              <aside className="m3-card">
                <h2>Monitored Contracts ({remote.data.items.length})</h2>
                <Link
                  className="m3-button m3-wide"
                  to={`${base}/contracts/new`}
                >
                  + Add Contract
                </Link>
                <div className="m3-targets">
                  {remote.data.items.map((m) => (
                    <button
                      key={m.id}
                      className={m.id === selected?.id ? "is-selected" : ""}
                      onClick={() => setSelectedId(m.id)}
                    >
                      <strong>{m.name}</strong>
                      <Status value={m.status} />
                    </button>
                  ))}
                </div>
                {!remote.data.items.length && (
                  <p className="m3-muted">
                    Choose a deployed contract from the Contract Registry to get
                    started.
                  </p>
                )}
              </aside>
              {selected ? (
                <WatcherEditor
                  key={`${selected.id}:${selected.enabled}:${selected.pollingSeconds}:${selected.confirmations}`}
                  watcher={selected}
                  root={root}
                  base={base}
                  onSaved={(settings) => {
                    setSaved({ ...selected, ...settings });
                    remote.refresh();
                  }}
                />
              ) : (
                <div className="m3-card m3-state">
                  <h2>No contract selected</h2>
                  <p>Add a registry contract to configure its watcher.</p>
                </div>
              )}
            </div>
          </>
        )}
      </State>
    </>
  );
}

function WatcherEditor({
  watcher,
  root,
  base,
  onSaved,
}: {
  watcher: Watcher;
  root: string;
  base: string;
  onSaved: (settings: Partial<Watcher>) => void;
}) {
  const remote = useRemote<Catalog>(`${root}/watchers/${watcher.id}/catalog`);
  const [tab, setTab] = useState("Events"),
    [enabled, setEnabled] = useState(watcher.enabled);
  const [polling, setPolling] = useState(watcher.pollingSeconds),
    [confirmations, setConfirmations] = useState(watcher.confirmations),
    [startBlock, setStartBlock] = useState(watcher.startBlock ?? "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const save = async (nextEnabled = enabled) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const settings = await monitoringApi.request<Partial<Watcher>>(
        `${root}/watchers/${watcher.id}`,
        "PATCH",
        {
          enabled: nextEnabled,
          pollingSeconds: polling,
          confirmations,
          ...(startBlock && !watcher.startBlock ? { startBlock } : {}),
        },
      );
      onSaved(settings);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await monitoringApi.request(
        `${root}/watchers/${watcher.id}/subscriptions/${id}`,
        "DELETE",
      );
      remote.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      id="m3-watcher-settings"
      className="m3-card m3-watcher-editor"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="m3-section-heading">
        <h2>Contract Configuration · {watcher.name}</h2>
        <button
          type="button"
          className="m3-button"
          disabled={
            busy || (!watcher.enabled && !remote.data?.subscriptions.length)
          }
          onClick={() => void save(!watcher.enabled)}
        >
          {watcher.enabled ? "Disconnect" : "Reconnect"}
        </button>
      </div>
      <p className="m3-muted">
        Address: <code title={watcher.address}>{short(watcher.address)}</code> ·
        Sepolia Testnet · {watcher.registryVersion ?? "No registry version"}
      </p>
      <div
        className="m3-tabs"
        role="tablist"
        aria-label="Watcher configuration"
      >
        {["Events", "ABI Source", "Confirmations", "Advanced"].map((name) => (
          <button
            key={name}
            id={`m3-tab-${name.replaceAll(" ", "-")}`}
            role="tab"
            type="button"
            aria-controls="m3-watcher-panel"
            aria-selected={tab === name}
            className={`m3-button${tab === name ? " m3-primary" : ""}`}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="m3-watcher-panel"
        aria-labelledby={`m3-tab-${tab.replaceAll(" ", "-")}`}
      >
        {tab === "Events" && (
          <>
            <div className="m3-section-heading">
              <h2>Subscribed Events</h2>
              <Link
                className="m3-button"
                to={`${base}/watchers/${watcher.id}/subscriptions/new`}
              >
                + Add Event
              </Link>
            </div>
            <State
              loading={remote.loading}
              error={remote.error}
              retry={remote.refresh}
            >
              {remote.data && (
                <>
                  {!remote.data.available && (
                    <p className="m3-warning">{remote.data.message}</p>
                  )}
                  {remote.data.subscriptions.map((s) => (
                    <div className="m3-subscription" key={s.id}>
                      <span>✓ {s.signature.split("(")[0]}</span>
                      <code>{s.signature}</code>
                      <button
                        className="m3-button"
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(s.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {!remote.data.subscriptions.length && (
                    <p className="m3-muted">
                      No ABI event subscriptions configured.
                    </p>
                  )}
                </>
              )}
            </State>
          </>
        )}
        {tab === "ABI Source" && (
          <>
            <h2>Registered contract ABI</h2>
            <p className="m3-muted">
              Read from the deployed M2 Contract Registry for this version.
            </p>
            <State
              loading={remote.loading}
              error={remote.error}
              retry={remote.refresh}
            >
              {remote.data?.available ? (
                <Json value={remote.data.abi} />
              ) : (
                <p className="m3-warning">{remote.data?.message}</p>
              )}
            </State>
          </>
        )}
        {tab === "Confirmations" && (
          <label className="m3-field">
            Confirmations
            <input
              type="number"
              min={1}
              max={128}
              value={confirmations}
              required
              onChange={(e) => setConfirmations(Number(e.target.value))}
            />
            <small>
              Only blocks behind the chain head by this many confirmations are
              indexed.
            </small>
          </label>
        )}
        {tab === "Advanced" && (
          <div className="m3-form-stack">
            <label className="m3-field">
              Polling interval (seconds)
              <input
                type="number"
                min={2}
                max={300}
                required
                value={polling}
                onChange={(e) => setPolling(Number(e.target.value))}
              />
            </label>
            <label className="m3-field">
              Start block (optional)
              <input
                inputMode="numeric"
                pattern="[0-9]{1,15}"
                value={startBlock}
                disabled={watcher.startBlock !== null}
                onChange={(e) => setStartBlock(e.target.value)}
              />
              <small>
                Leave empty to begin at the confirmed head. An existing start
                block is preserved.
              </small>
            </label>
            <p className="m3-muted">
              HTTP polling · Durable worker jobs · Last successful scan:{" "}
              {time(watcher.succeededAt)}
            </p>
          </div>
        )}
      </div>
      <label className="m3-check">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Enable watcher
      </label>
      {!watcher.enabled && (
        <p className="m3-warning">
          Watcher paused: events are not indexed until enabled and the worker is
          running.
        </p>
      )}
      {error && (
        <p role="alert" className="m3-error">
          {error}
        </p>
      )}
      <button className="m3-button m3-primary" disabled={busy} type="submit">
        {busy ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}

export function AddContractPage({ projectId }: { projectId: string }) {
  const root = monitoringRoot(projectId),
    base = `/projects/${projectId}/monitoring`,
    navigate = useNavigate();
  const remote = useRemote<RegistryResult>(`${root}/registry-contracts`),
    [id, setId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const selected = remote.data?.contracts.find((c) => c.id === id);
  return (
    <>
      <PageHeading
        title="Add Monitored Contract"
        description="Choose an existing registry contract to monitor."
        back={`${base}/watchers`}
      />
      <form
        className="m3-card m3-selection"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || !selected) return;
          setBusy(true);
          setError("");
          try {
            await monitoringApi.request(`${root}/targets`, "POST", {
              registryContractId: id,
            });
            navigate(`${base}/watchers`);
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Contract selection</h2>
        <State
          loading={remote.loading}
          error={remote.error}
          retry={remote.refresh}
        >
          {remote.data && (
            <>
              {remote.data.message && (
                <p className="m3-warning">{remote.data.message}</p>
              )}
              <label className="m3-field">
                Registered contract
                <select
                  required
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                >
                  <option value="">Select a deployed registry contract</option>
                  {remote.data.contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.version} · {short(c.address)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="m3-field">
                Network
                <input
                  readOnly
                  value={selected ? "Sepolia Testnet" : ""}
                  placeholder="Select a registered contract"
                />
              </label>
              {error && (
                <p className="m3-error" role="alert">
                  {error}
                </p>
              )}
              <div className="m3-actions">
                <Link className="m3-button" to={`${base}/watchers`}>
                  Cancel
                </Link>
                <button
                  className="m3-button m3-primary"
                  disabled={busy || !selected}
                >
                  {busy ? "Adding…" : "Add contract →"}
                </button>
              </div>
            </>
          )}
        </State>
      </form>
    </>
  );
}

export function AddSubscriptionPage({ projectId }: { projectId: string }) {
  const { watcherId = "" } = useParams(),
    root = monitoringRoot(projectId),
    base = `/projects/${projectId}/monitoring`,
    navigate = useNavigate();
  const remote = useRemote<Catalog>(
    `${root}/watchers/${encodeURIComponent(watcherId)}/catalog`,
  );
  const watchers = useRemote<{ items: Watcher[] }>(`${root}/watchers`);
  const contract = watchers.data?.items.find((item) => item.id === watcherId);
  const [signature, setSignature] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const available =
    remote.data?.events.filter(
      (e) =>
        !remote.data?.subscriptions.some((s) => s.signature === e.signature),
    ) ?? [];
  return (
    <>
      <PageHeading
        title="Add Event Subscription"
        description="Select an ABI event to subscribe to."
        back={`${base}/watchers`}
      />
      <form
        className="m3-card m3-selection"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || !signature) return;
          setBusy(true);
          setError("");
          try {
            await monitoringApi.request(
              `${root}/watchers/${watcherId}/subscriptions`,
              "POST",
              { signature },
            );
            navigate(`${base}/watchers`);
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Event selection</h2>
        <State
          loading={remote.loading}
          error={remote.error}
          retry={remote.refresh}
        >
          {remote.data && (
            <>
              {!remote.data.available && (
                <p className="m3-warning">{remote.data.message}</p>
              )}
              <label className="m3-field">
                Contract
                <input
                  readOnly
                  value={
                    contract
                      ? `${contract.name} · ${short(contract.address)}`
                      : watcherId
                  }
                />
              </label>
              <label className="m3-field">
                Event
                <select
                  required
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                >
                  <option value="">Select an ABI event</option>
                  {available.map((event) => (
                    <option key={event.signature} value={event.signature}>
                      {event.signature}
                    </option>
                  ))}
                </select>
              </label>
              {!available.length && remote.data.available && (
                <p className="m3-muted">
                  All available ABI events are already subscribed, or the ABI
                  contains no events.
                </p>
              )}
              {error && (
                <p role="alert" className="m3-error">
                  {error}
                </p>
              )}
              <div className="m3-actions">
                <Link className="m3-button" to={`${base}/watchers`}>
                  Cancel
                </Link>
                <button
                  className="m3-button m3-primary"
                  disabled={busy || !signature}
                >
                  {busy ? "Adding…" : "Add event →"}
                </button>
              </div>
            </>
          )}
        </State>
      </form>
    </>
  );
}
