import { Link, Route, Routes, useParams } from "react-router-dom";
import { useRemote } from "./useRemote";
import type { Project } from "./types";
import { PageHeading, State } from "./ui";
import { OverviewPage } from "./OverviewPage";
import {
  AddContractPage,
  AddSubscriptionPage,
  WatchersPage,
} from "./WatchersPage";
import { EventDetailPage, EventsPage } from "./EventsPage";
import {
  AlertDetailPage,
  AlertsPage,
  CreateRulePage,
  RulesPage,
} from "./AlertsPage";
import "./monitoring-live.css";

export function MonitoringWorkspace({
  entry = "monitoring",
}: {
  entry?: "monitoring" | "alerts";
}) {
  const { projectId } = useParams();
  const valid =
    projectId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      projectId,
    );
  if (!valid)
    return (
      <div className="m3">
        <ProjectChooser entry={entry} />
      </div>
    );
  return (
    <div className="m3" key={projectId}>
      <Routes>
        <Route index element={<OverviewPage projectId={projectId} />} />
        <Route
          path="watchers"
          element={<WatchersPage projectId={projectId} />}
        />
        <Route
          path="contracts/new"
          element={<AddContractPage projectId={projectId} />}
        />
        <Route
          path="watchers/:watcherId/subscriptions/new"
          element={<AddSubscriptionPage projectId={projectId} />}
        />
        <Route path="events" element={<EventsPage projectId={projectId} />} />
        <Route
          path="contracts/:contractId/events"
          element={<EventsPage projectId={projectId} />}
        />
        <Route
          path="events/:eventId"
          element={<EventDetailPage projectId={projectId} />}
        />
        <Route path="alerts" element={<AlertsPage projectId={projectId} />} />
        <Route
          path="alerts/:alertId"
          element={<AlertDetailPage projectId={projectId} />}
        />
        <Route path="rules" element={<RulesPage projectId={projectId} />} />
        <Route
          path="rules/new"
          element={<CreateRulePage projectId={projectId} />}
        />
        <Route
          path="*"
          element={
            <div className="m3-state">
              <h1>Monitoring page not found</h1>
              <Link to={`/projects/${projectId}/monitoring`}>
                Return to monitoring
              </Link>
            </div>
          }
        />
      </Routes>
    </div>
  );
}
function ProjectChooser({ entry }: { entry: string }) {
  const remote = useRemote<Project[]>("monitoring/projects");
  return (
    <>
      <PageHeading
        title={entry === "alerts" ? "Alert Inbox" : "Monitoring"}
        description="Select an accessible project to view its monitoring data."
      />
      <State
        loading={remote.loading}
        error={remote.error}
        retry={remote.refresh}
      >
        {remote.data && (
          <section className="m3-card">
            <h2>Your projects</h2>
            {remote.data.length ? (
              <ul className="m3-project-list">
                {remote.data.map((p) => (
                  <li key={p.id}>
                    <Link
                      className="m3-button"
                      to={`/projects/${p.id}/monitoring${entry === "alerts" ? "/alerts" : ""}`}
                    >
                      {p.name}
                      <small>{p.organizationName}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m3-muted">
                No accessible projects. Ask your organization administrator to
                add you to a project.
              </p>
            )}
          </section>
        )}
      </State>
    </>
  );
}
