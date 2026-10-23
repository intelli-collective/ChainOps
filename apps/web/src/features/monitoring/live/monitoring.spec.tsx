import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MonitoringApi } from "./api";
import { MonitoringWorkspace } from "./MonitoringWorkspace";

const projectId = "05d2496e-5fa4-4d7a-9606-7dd98d154e4b",
  monitorId = "05d2496e-5fa4-4d7a-9606-7dd98d154e4c",
  alertId = "05d2496e-5fa4-4d7a-9606-7dd98d154e4d";
const watcher = {
  id: monitorId,
  projectId,
  name: "Vault",
  network: "sepolia",
  address: "0x" + "34".repeat(20),
  registryContractId: null,
  registryVersion: null,
  enabled: false,
  pollingSeconds: 10,
  confirmations: 12,
  startBlock: null,
  lastIndexedBlock: null,
  lastHeadBlock: null,
  checkedAt: null,
  succeededAt: null,
  lastError: null,
  status: "paused",
};
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function mount(path: string) {
  return render(
    <MemoryRouter initialEntries={[`/projects/${projectId}/monitoring${path}`]}>
      <Routes>
        <Route
          path="/projects/:projectId/monitoring/*"
          element={<MonitoringWorkspace />}
        />
      </Routes>
    </MemoryRouter>,
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("M3 API-backed UI", () => {
  it("refreshes CSRF state between writes after a login or cookie rotation", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ csrfToken: "x".repeat(43) }))
      .mockResolvedValueOnce(response({ ok: true }))
      .mockResolvedValueOnce(response({ csrfToken: "y".repeat(43) }))
      .mockResolvedValueOnce(response({ ok: true }));
    vi.stubGlobal("fetch", fetcher);
    const api = new MonitoringApi();
    await api.request("monitoring/test", "POST", {});
    await api.request("monitoring/test", "POST", {});
    expect(fetcher.mock.calls[3][1].headers["X-CSRF-Token"]).toBe(
      "y".repeat(43),
    );
  });
  it("uses HttpOnly cookie sessions and CSRF headers on writes without exposing tokens", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ csrfToken: "x".repeat(43) }))
      .mockResolvedValueOnce(response({ id: "saved" }, 201));
    vi.stubGlobal("fetch", fetcher);
    await new MonitoringApi().request(
      `projects/${projectId}/monitoring/rules`,
      "POST",
      { name: "Rule" },
    );
    expect(fetcher.mock.calls[0][0]).toBe("/auth/csrf");
    expect(fetcher.mock.calls[1][1]).toMatchObject({
      credentials: "include",
      headers: { "X-CSRF-Token": "x".repeat(43) },
    });
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain("Authorization");
  });
  it("shows truthful empty overview and RPC setup state instead of fake telemetry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response({
          project: { name: "Vault project", organizationName: "Team" },
          monitors: [],
          throughput: [],
          eventRate: 0,
          alerts: [],
          rpcConfigured: false,
          registryConfigured: false,
          fetchedAt: new Date().toISOString(),
        }),
      ),
    );
    mount("");
    expect(await screen.findByText("Not configured")).toBeTruthy();
    expect(screen.getByText("No indexed events in this period.")).toBeTruthy();
    expect(screen.queryByText("Healthy")).toBeNull();
  });
  it("shows a permission error and retry instead of presenting stale project data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response({ message: "Project not found or inaccessible" }, 404),
      ),
    );
    mount("");
    expect(await screen.findByText("Project unavailable")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
  it("does not offer independent contract registration when M2 deployment metadata is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response({
          available: false,
          message: "M2 deployed registry unavailable",
          contracts: [],
        }),
      ),
    );
    mount("/contracts/new");
    expect(
      await screen.findByText("M2 deployed registry unavailable"),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Add contract →",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
  it("submits a typed count rule with an exact string threshold and navigates back to persisted rules", async () => {
    const writes: { path: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string, options?: RequestInit) => {
        if (path === "/auth/csrf")
          return response({ csrfToken: "x".repeat(43) });
        if (options?.method === "POST") {
          writes.push({
            path,
            body: JSON.parse(String(options.body)) as Record<string, unknown>,
          });
          return response({ id: "saved" }, 201);
        }
        if (path.endsWith("/watchers"))
          return response({ items: [watcher], rpcConfigured: false });
        return response([]);
      }),
    );
    mount("/rules/new");
    fireEvent.change(screen.getByLabelText("Name *"), {
      target: { value: "High volume" },
    });
    fireEvent.change(screen.getByLabelText("Event *"), {
      target: { value: "Withdrawal" },
    });
    fireEvent.change(screen.getByLabelText("Threshold *"), {
      target: { value: "9007199254740993" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save rule" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].body).toMatchObject({
      name: "High volume",
      mode: "count",
      windowSeconds: 3600,
      condition: { field: "count", operator: "gt", value: "9007199254740993" },
    });
    expect(
      await screen.findByRole("heading", { name: "Alert Rules" }),
    ).toBeTruthy();
  });
  it("preserves rule input on failed save", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string, options?: RequestInit) =>
        path === "/auth/csrf"
          ? response({ csrfToken: "x".repeat(43) })
          : options?.method === "POST"
            ? response({ message: "Save temporarily unavailable" }, 503)
            : response({ items: [] }),
      ),
    );
    mount("/rules/new");
    fireEvent.change(screen.getByLabelText("Name *"), {
      target: { value: "Keep my rule" },
    });
    fireEvent.change(screen.getByLabelText("Event *"), {
      target: { value: "Transfer" },
    });
    fireEvent.change(screen.getByLabelText("Threshold *"), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save rule" }));
    expect(
      await screen.findByText("Save temporarily unavailable"),
    ).toBeTruthy();
    expect((screen.getByLabelText("Name *") as HTMLInputElement).value).toBe(
      "Keep my rule",
    );
  });
  it("acknowledges then resolves using actual API mutation requests", async () => {
    const calls: string[] = [];
    let status = "open";
    const alert = {
      id: alertId,
      projectId,
      title: "Large withdrawal",
      severity: "critical",
      get status() {
        return status;
      },
      evidence: {
        mode: "parameter",
        condition: { field: "amount", operator: "gt", value: "100" },
        observed: "101",
        windowSeconds: null,
      },
      contractName: "Vault",
      address: watcher.address,
      transactionHash: "0x" + "ab".repeat(32),
      eventName: "Withdrawal",
      eventId: monitorId,
      blockNumber: "100",
      network: "sepolia",
      createdAt: new Date().toISOString(),
      removed: false,
      history: [],
      acknowledgedBy: null,
      resolvedBy: null,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string, options?: RequestInit) => {
        if (path === "/auth/csrf")
          return response({ csrfToken: "x".repeat(43) });
        if (options?.method === "POST") {
          calls.push(path);
          status = path.endsWith("acknowledge") ? "acknowledged" : "resolved";
          return response({ id: alertId, status });
        }
        return response(alert);
      }),
    );
    mount(`/alerts/${alertId}`);
    await screen.findByRole("button", { name: "Acknowledge" });
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));
    expect(await screen.findByText("✓ Alert acknowledged.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "✓ Resolve" }));
    expect(await screen.findByText("✓ Alert resolved.")).toBeTruthy();
    expect(calls).toEqual([
      `/api/projects/${projectId}/monitoring/alerts/${alertId}/acknowledge`,
      `/api/projects/${projectId}/monitoring/alerts/${alertId}/resolve`,
    ]);
  });
});
