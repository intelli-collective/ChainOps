// Browser-only review fixtures; never imported by application/runtime code.
// Start a dedicated headless Chrome with debugging port 9444, then run this file.
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const projectId = "05d2496e-5fa4-4d7a-9606-7dd98d154e4b";
const ids = [
  "05d2496e-5fa4-4d7a-9606-7dd98d154e4c",
  "05d2496e-5fa4-4d7a-9606-7dd98d154e4d",
  "05d2496e-5fa4-4d7a-9606-7dd98d154e4e",
];
const eventId = "05d2496e-5fa4-4d7a-9606-7dd98d154e4f",
  alertId = "05d2496e-5fa4-4d7a-9606-7dd98d154e50",
  ruleId = "05d2496e-5fa4-4d7a-9606-7dd98d154e51";
const now = new Date().toISOString(),
  tx = "0x" + "ab".repeat(32),
  abi = ["event Withdrawal(address indexed owner,uint256 amount)"];
const monitors = ids.map((id, i) => ({
  id,
  projectId,
  name: ["Vault", "TokenFactory", "Treasury"][i],
  address: "0x" + String(i + 1).repeat(40),
  network: "sepolia",
  registryContractId: id,
  registryVersion: "v1.4",
  enabled: true,
  pollingSeconds: 2,
  confirmations: 12,
  startBlock: "7842300",
  lastIndexedBlock: "7842311",
  lastHeadBlock: "7842323",
  checkedAt: now,
  succeededAt: now,
  lastError: null,
  status: "healthy",
}));
const additionalRegistry = {
  ...monitors[0],
  id: "05d2496e-5fa4-4d7a-9606-7dd98d154e52",
  name: "Escrow",
  address: "0x" + "44".repeat(20),
  version: "v1.0",
  abi,
};
const event = {
  id: eventId,
  projectId,
  monitoredContractId: ids[0],
  contractName: "Vault",
  address: monitors[0].address,
  network: "sepolia",
  eventName: "Withdrawal",
  signature: "Withdrawal(address,uint256)",
  args: { owner: "0x" + "12".repeat(20), amount: "9007199254740993" },
  rawLog: {
    address: monitors[0].address,
    transactionHash: tx,
    logIndex: 12,
    removed: false,
  },
  abi,
  registryVersion: "v1.4",
  transactionHash: tx,
  blockHash: "0x" + "cd".repeat(32),
  blockNumber: "7842311",
  logIndex: 12,
  transactionIndex: 3,
  timestamp: now,
  removed: false,
  decodeError: null,
  previousId: null,
  nextId: null,
};
const rules = [
  {
    id: ruleId,
    projectId,
    monitoredContractId: ids[0],
    contractName: "Vault",
    name: "Large Withdrawal",
    description: "Review large withdrawals",
    severity: "critical",
    mode: "parameter",
    windowSeconds: null,
    eventName: "Withdrawal",
    condition: { field: "amount", operator: "gt", value: "100" },
    enabled: true,
    createdAt: now,
  },
];
const alert = {
  id: alertId,
  projectId,
  ruleId,
  eventId,
  title: "Large Withdrawal",
  severity: "critical",
  status: "open",
  evidence: {
    condition: rules[0].condition,
    observed: "9007199254740993",
    mode: "parameter",
    windowSeconds: null,
  },
  acknowledgedAt: null,
  resolvedAt: null,
  invalidatedAt: null,
  createdAt: now,
  contractName: "Vault",
  address: monitors[0].address,
  monitoredContractId: ids[0],
  network: "sepolia",
  transactionHash: tx,
  eventName: "Withdrawal",
  blockNumber: "7842311",
  removed: false,
  acknowledgedBy: null,
  resolvedBy: null,
  history: [
    {
      id: "trigger",
      action: "triggered",
      note: "",
      actorName: null,
      createdAt: now,
    },
  ],
};
const subscriptions = new Map(
  ids.map((id) => [
    id,
    [
      {
        id: "sub-" + id,
        signature: "Withdrawal(address,uint256)",
        enabled: true,
      },
    ],
  ]),
);
let missingRegistry = false,
  failOverview = false,
  emptyEvents = false;
const mutations = [];
const server = await createServer({
  root: fileURLToPath(new URL("../../../../", import.meta.url)),
  configFile: fileURLToPath(
    new URL("../../../../vite.config.ts", import.meta.url),
  ),
  server: { host: "127.0.0.1", port: 5188, strictPort: true },
});
await server.listen();
let pages;
for (let attempt = 0; attempt < 50; attempt++) {
  try {
    pages = await (await fetch("http://127.0.0.1:9444/json/list")).json();
    break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
if (!pages) {
  await server.close();
  throw new Error("Dedicated Chrome debug port 9444 is unavailable");
}
const ws = new WebSocket(
  pages.find((p) => p.type === "page").webSocketDebuggerUrl,
);
await new Promise((resolve) =>
  ws.addEventListener("open", resolve, { once: true }),
);
let sequence = 0;
const pending = new Map(),
  errors = [];
const call = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
async function respond(message) {
  const { requestId, request } = message.params,
    url = new URL(request.url),
    path = url.pathname.replace(/^\/api/, "");
  let data,
    status = 200;
  const body = request.postData ? JSON.parse(request.postData) : {};
  if (request.method !== "GET")
    mutations.push({ path, method: request.method, body });
  if (path === "/auth/me")
    data = {
      user: {
        id: "review-user",
        fullName: "Review member",
        email: "review@example.test",
      },
      organizations: [{ id: "org", name: "ChainOps Team" }],
      nextPath: "/projects",
    };
  else if (path === "/auth/csrf") data = { csrfToken: "x".repeat(43) };
  else if (path === "/monitoring/projects")
    data = [
      { id: projectId, name: "ChainVault", organizationName: "ChainOps Team" },
    ];
  else if (path.endsWith("/overview")) {
    if (failOverview) {
      status = 503;
      data = { message: "Review fixture: backend unavailable" };
    } else
      data = {
        project: { name: "ChainVault", organizationName: "ChainOps Team" },
        monitors,
        throughput: Array.from({ length: 24 }, (_, i) =>
          ["Deposit", "Transfer", "Withdrawal"].map((eventName, j) => ({
            time: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
            eventName,
            count: 10 + ((i * 17 + j * 29) % 100),
          })),
        ).flat(),
        eventRate: 42,
        alerts: [alert],
        rpcConfigured: true,
        registryConfigured: true,
        fetchedAt: now,
      };
  } else if (path.endsWith("/registry-contracts"))
    data = {
      available: !missingRegistry,
      message: missingRegistry ? "M2 deployed registry unavailable" : null,
      contracts: missingRegistry
        ? []
        : [
            ...monitors.map((m) => ({ ...m, version: m.registryVersion, abi })),
            additionalRegistry,
          ],
    };
  else if (path.endsWith("/targets")) {
    monitors.push({
      ...additionalRegistry,
      registryContractId: additionalRegistry.id,
      registryVersion: additionalRegistry.version,
      enabled: false,
      status: "paused",
    });
    subscriptions.set(additionalRegistry.id, []);
    data = { id: additionalRegistry.id };
    status = 201;
  } else if (path.endsWith("/watchers"))
    data = { items: monitors, rpcConfigured: true };
  else if (path.endsWith("/catalog")) {
    const id = path.split("/").at(-2);
    data = {
      available: true,
      message: null,
      abi,
      events: [
        {
          name: "Withdrawal",
          signature: "Withdrawal(address,uint256)",
          fields: [
            { name: "owner", type: "address" },
            { name: "amount", type: "uint256" },
          ],
        },
        {
          name: "Deposit",
          signature: "Deposit(address,uint256)",
          fields: [
            { name: "owner", type: "address" },
            { name: "amount", type: "uint256" },
          ],
        },
      ],
      subscriptions: subscriptions.get(id) ?? [],
    };
  } else if (request.method === "PATCH" && path.includes("/watchers/")) {
    const m = monitors.find((m) => m.id === path.split("/").at(-1));
    Object.assign(m, body, { status: body.enabled ? "pending" : "paused" });
    data = m;
  } else if (path.endsWith("/subscriptions")) {
    const id = path.split("/").at(-2);
    subscriptions
      .get(id)
      .push({ id: "added-sub", signature: body.signature, enabled: true });
    data = { id: "added-sub" };
    status = 201;
  } else if (request.method === "DELETE" && path.includes("/subscriptions/")) {
    const id = path.split("/").at(-3);
    subscriptions.set(
      id,
      subscriptions.get(id).filter((s) => s.id !== path.split("/").at(-1)),
    );
    data = { ok: true };
  } else if (path.endsWith("/test-connection"))
    data = { network: "sepolia", headBlock: "7842323", checkedAt: now };
  else if (path.endsWith("/events"))
    data = {
      items: emptyEvents ? [] : [event],
      total: emptyEvents ? 0 : 1,
      page: 1,
      limit: 25,
    };
  else if (path.includes("/events/")) data = event;
  else if (path.endsWith("/rules") && request.method === "POST") {
    rules.push({
      ...body,
      id: "new-rule",
      projectId,
      contractName: "Vault",
      createdAt: now,
    });
    data = { id: "new-rule" };
    status = 201;
  } else if (path.endsWith("/rules")) data = rules;
  else if (path.includes("/rules/")) {
    Object.assign(
      rules.find((r) => r.id === path.split("/").at(-1)),
      body,
    );
    data = { id: path.split("/").at(-1), enabled: body.enabled };
  } else if (path.endsWith("/alerts"))
    data = { items: [alert], total: 1, page: 1, limit: 25 };
  else if (path.endsWith("/acknowledge") || path.endsWith("/resolve")) {
    const action = path.endsWith("/resolve") ? "resolved" : "acknowledged";
    alert.status = action;
    alert[action === "resolved" ? "resolvedBy" : "acknowledgedBy"] =
      "Review member";
    alert.history.push({
      id: action,
      action,
      note: body.note ?? "",
      actorName: "Review member",
      createdAt: now,
    });
    data = { id: alertId, status: action };
  } else if (path.includes("/alerts/")) data = alert;
  else {
    status = 404;
    data = { message: "Unexpected review request: " + path };
    errors.push(data.message);
  }
  await call("Fetch.fulfillRequest", {
    requestId,
    responseCode: status,
    responseHeaders: [{ name: "Content-Type", value: "application/json" }],
    body: Buffer.from(JSON.stringify(data)).toString("base64"),
  });
}
ws.addEventListener("message", ({ data }) => {
  const m = JSON.parse(data);
  if (m.id) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
  } else if (m.method === "Runtime.exceptionThrown")
    errors.push(
      m.params.exceptionDetails.exception?.description ??
        m.params.exceptionDetails.text,
    );
  else if (m.method === "Fetch.requestPaused")
    void respond(m).catch((e) => {
      if (!e.message.includes("Invalid InterceptionId")) errors.push(e.message);
    });
});
const evaluate = async (expression) => {
  const r = await call("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails)
    throw new Error(
      r.exceptionDetails.exception?.description ?? r.exceptionDetails.text,
    );
  return r.result.value;
};
const wait = async (expression) => {
  for (let n = 0; n < 120; n++) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Timed out: " + expression);
};
const click = (label) =>
  evaluate(
    `(()=>{const e=[...document.querySelectorAll('.m3 button,.m3 a')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!e)throw new Error('Missing control');e.click();})()`,
  );
const field = (label, value) =>
  evaluate(
    `(()=>{const l=[...document.querySelectorAll('.m3 label')].find(l=>l.textContent.trim().startsWith(${JSON.stringify(label)}));const e=l?.querySelector('input,select,textarea');if(!e)throw new Error('Missing field');const p=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`,
  );
const navigate = async (path) => {
  await call("Page.navigate", {
    url: `http://localhost:5188/projects/${projectId}/monitoring${path}`,
  });
  await wait(
    "document.querySelector('.m3 h1') && !document.querySelector('.m3 [role=status]')",
  );
  await evaluate("document.fonts.ready");
};
const assert = async (expression, label) => {
  if (!(await evaluate(expression))) throw new Error(label);
  console.log("PASS " + label);
};
const output = new URL("./live/", import.meta.url);
await mkdir(output, { recursive: true });
const screenshot = async (name) => {
  await evaluate(
    "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))",
  );
  await new Promise((resolve) => setTimeout(resolve, 200));
  const { data } = await call("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  await writeFile(new URL(name + ".png", output), Buffer.from(data, "base64"));
};
try {
  await call("Runtime.enable");
  await call("Page.enable");
  await call("Fetch.enable", {
    patterns: [
      { urlPattern: "http://localhost:5188/api/*" },
      { urlPattern: "http://localhost:5188/auth/*" },
    ],
  });
  await call("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1240,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await navigate("");
  await wait("document.querySelector('.m3-stats strong')");
  await screenshot("overview-desktop");
  await assert(
    "!document.querySelector('.m3').textContent.includes('Mock data')",
    "App monitoring route uses API-backed data",
  );
  await navigate("/watchers");
  await wait("document.querySelector('#m3-watcher-settings')");
  await screenshot("watchers-desktop");
  await click("Disconnect");
  await wait(
    "document.querySelector('.m3 h1').textContent==='Watcher Settings Saved'",
  );
  await assert(
    "document.querySelector('.m3').textContent.includes('Paused')",
    "Disconnect saves disabled watcher state",
  );
  await screenshot("watcher-saved-desktop");
  await click("Return to configuration");
  await wait("document.querySelector('#m3-watcher-settings')");
  await screenshot("watcher-disconnected-desktop");
  await click("+ Add Event");
  await wait(
    "document.querySelector('.m3 h1').textContent==='Add Event Subscription'",
  );
  await field("Event", "Deposit(address,uint256)");
  await screenshot("subscription-desktop");
  await click("Add event →");
  await wait(
    "document.querySelector('.m3 h1').textContent==='Watcher Configuration'",
  );
  await wait(
    "document.querySelector('.m3').textContent.includes('Deposit(address,uint256)')",
  );
  await navigate("/contracts/new");
  await wait(
    `document.querySelector('.m3 select option[value="${additionalRegistry.id}"]')`,
  );
  await field("Registered contract", additionalRegistry.id);
  await screenshot("add-contract-desktop");
  await click("Add contract →");
  await wait(
    "document.querySelector('.m3 h1').textContent==='Watcher Configuration'",
  );
  await wait("document.querySelector('.m3').textContent.includes('Escrow')");
  await navigate("/events");
  await wait("document.querySelector('.m3 tbody tr')");
  await screenshot("events-desktop");
  await click("View →");
  await wait(
    "document.querySelector('.m3 h1').textContent.includes('Decoded')",
  );
  await screenshot("decoded-desktop");
  await click("ABI");
  await assert(
    "document.querySelector('.m3-json').textContent.includes('9007199254740993')",
    "Decoded uint256 stays exact",
  );
  await navigate("/rules/new");
  await wait("document.querySelector('.m3 form')");
  await screenshot("create-rule-desktop");
  await field("Name *", "Review high volume");
  await field("Event *", "Withdrawal");
  await field("Threshold *", "500");
  await click("Save rule");
  await wait("document.querySelector('.m3 h1').textContent==='Alert Rules'");
  await wait(
    "document.querySelector('.m3').textContent.includes('Review high volume')",
  );
  await screenshot("rules-desktop");
  await navigate("/alerts");
  await wait("document.querySelector('.m3 tbody tr')");
  await screenshot("alerts-desktop");
  await click("Large Withdrawal");
  await wait(
    "document.querySelector('.m3 h1').textContent==='Large Withdrawal'",
  );
  await screenshot("alert-open-desktop");
  await click("Acknowledge");
  await wait(
    "document.querySelector('.m3 [role=status]')?.textContent.includes('acknowledged')",
  );
  await screenshot("alert-acknowledged-desktop");
  await click("✓ Resolve");
  await wait(
    "document.querySelector('.m3 [role=status]')?.textContent.includes('resolved')",
  );
  await screenshot("alert-resolved-desktop");
  missingRegistry = true;
  await navigate("/contracts/new");
  await wait(
    "document.querySelector('.m3').textContent.includes('M2 deployed registry unavailable')",
  );
  await assert(
    "[...document.querySelectorAll('.m3 button')].some(b=>b.textContent.includes('Add contract')&&b.disabled)",
    "Missing M2 integration disables unsupported contract creation",
  );
  emptyEvents = true;
  await navigate("/events");
  await wait(
    "document.querySelector('.m3').textContent.includes('No indexed events')",
  );
  await screenshot("events-empty-desktop");
  failOverview = true;
  await navigate("");
  await wait("document.querySelector('.m3 [role=alert]')");
  await assert(
    "document.querySelector('.m3 [role=alert]').textContent.includes('backend unavailable')",
    "Backend failure presents retry state",
  );
  failOverview = false;
  await click("Try again");
  await wait("document.querySelector('.m3-stats')");
  await call("Emulation.setDeviceMetricsOverride", {
    width: 375,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await navigate("");
  await wait("document.querySelector('.m3-stats')");
  await screenshot("overview-mobile");
  await assert(
    "document.documentElement.scrollWidth<=window.innerWidth",
    "Mobile overview has no horizontal page overflow",
  );
  await navigate("/watchers");
  await wait("document.querySelector('#m3-watcher-settings')");
  await screenshot("watchers-mobile");
  await assert(
    "document.documentElement.scrollWidth<=window.innerWidth",
    "Mobile watcher configuration has no horizontal page overflow",
  );
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "PASS browser interactions, loading/empty/error states, API mutations, desktop/mobile screenshots and runtime errors",
  );
  console.log(
    JSON.stringify({
      mutations: mutations.map((m) => ({ path: m.path, method: m.method })),
      screenshots: fileURLToPath(output),
    }),
  );
} catch (error) {
  console.error("Browser review failure:", error.message);
  console.error("Runtime errors:", JSON.stringify(errors));
  console.error(
    "Visible page:",
    await evaluate("document.body.innerText.slice(0,2000)"),
  );
  await screenshot("failure");
  throw error;
} finally {
  await server.close();
  try {
    await call("Browser.close");
  } catch {}
  ws.close();
}
