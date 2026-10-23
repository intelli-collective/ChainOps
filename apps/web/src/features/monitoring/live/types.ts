export interface Project {
  id: string;
  name: string;
  organizationName: string;
}
export interface Watcher {
  id: string;
  projectId: string;
  name: string;
  network: string;
  address: string;
  registryContractId: string | null;
  registryVersion: string | null;
  enabled: boolean;
  pollingSeconds: number;
  confirmations: number;
  startBlock: string | null;
  lastIndexedBlock: string | null;
  lastHeadBlock: string | null;
  checkedAt: string | null;
  succeededAt: string | null;
  lastError: string | null;
  status:
    "paused" | "pending" | "healthy" | "degraded" | "stale" | "catching_up";
}
export interface RegistryContract {
  id: string;
  projectId: string;
  name: string;
  version: string;
  network: string;
  address: string;
  abi: unknown[];
}
export interface RegistryResult {
  available: boolean;
  message: string | null;
  contracts: RegistryContract[];
}
export interface Catalog {
  available: boolean;
  message: string | null;
  abi: unknown[];
  events: {
    name: string;
    signature: string;
    fields: { name: string; type: string }[];
  }[];
  subscriptions: { id: string; signature: string; enabled: boolean }[];
}
export interface ChainEvent {
  id: string;
  projectId: string;
  monitoredContractId: string;
  contractName: string;
  address: string;
  network: string;
  eventName: string | null;
  signature: string | null;
  args: Record<string, unknown> | null;
  rawLog: unknown;
  abi: unknown[];
  registryVersion: string | null;
  releaseContext?: {
    commitSha?: string;
    pipelineRunId?: string;
    artifactId?: string;
  } | null;
  transactionHash: string;
  blockHash: string;
  blockNumber: string;
  logIndex: number;
  transactionIndex: number;
  timestamp: string;
  removed: boolean;
  decodeError: string | null;
}
export interface AlertRule {
  id: string;
  projectId: string;
  monitoredContractId: string | null;
  contractName: string | null;
  name: string;
  description: string;
  severity: "info" | "warning" | "critical";
  mode: "parameter" | "count";
  windowSeconds: number | null;
  eventName: string;
  condition: {
    field: string;
    operator: "eq" | "gt" | "gte" | "lt" | "lte";
    value: string;
  };
  enabled: boolean;
  createdAt: string;
}
export interface Alert {
  id: string;
  projectId: string;
  ruleId: string;
  eventId: string;
  title: string;
  severity: AlertRule["severity"];
  status: "open" | "acknowledged" | "resolved";
  evidence: {
    condition: AlertRule["condition"];
    observed: string;
    mode: string;
    windowSeconds: number | null;
  };
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  invalidatedAt: string | null;
  createdAt: string;
  contractName: string;
  address: string;
  monitoredContractId: string;
  network: string;
  transactionHash: string;
  eventName: string;
  blockNumber: string;
  removed: boolean;
  acknowledgedBy: string | null;
  resolvedBy: string | null;
  history?: {
    id: string;
    action: string;
    note: string;
    createdAt: string;
    actorName: string | null;
  }[];
}
export interface Overview {
  project: { name: string; organizationName: string };
  monitors: Watcher[];
  eventRate: number;
  alerts: Alert[];
  throughput: { time: string; eventName: string; count: number }[];
  rpcConfigured: boolean;
  registryConfigured: boolean;
  fetchedAt: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
