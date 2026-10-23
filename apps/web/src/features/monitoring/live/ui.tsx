import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { MonitoringApiError } from "./api";

export function Status({ value }: { value: string }) {
  return (
    <span className={`m3-status m3-status--${value}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}
export function PageHeading({
  title,
  description,
  back,
  children,
  area = "Monitoring",
}: {
  title: string;
  description: string;
  back?: string;
  children?: ReactNode;
  area?: string;
}) {
  return (
    <>
      <div className="m3-breadcrumb">
        {back && (
          <Link className="m3-button m3-back" to={back}>
            ← Back
          </Link>
        )}
        <span>
          Operate <span aria-hidden="true">›</span> {area}
        </span>
      </div>
      <div className="m3-heading">
        <h1>{title}</h1>
        {children && <div className="m3-actions">{children}</div>}
      </div>
      <p className="m3-description">{description}</p>
    </>
  );
}
export function State({
  loading,
  error,
  retry,
  children,
}: {
  loading?: boolean;
  error?: Error;
  retry?: () => void;
  children?: ReactNode;
}) {
  if (loading)
    return (
      <div className="m3-card m3-state" role="status">
        Loading…
      </div>
    );
  if (error) {
    const denied =
      error instanceof MonitoringApiError &&
      [401, 403, 404].includes(error.status);
    return (
      <div className="m3-card m3-state" role="alert">
        <h2>{denied ? "Project unavailable" : "Unable to load monitoring"}</h2>
        <p>{error.message}</p>
        {retry && (
          <button className="m3-button" onClick={retry}>
            Try again
          </button>
        )}
        {denied && <Link to="/login">Sign in</Link>}
      </div>
    );
  }
  return children;
}
export function Pager({
  page,
  total,
  limit,
  onChange,
}: {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="m3-pagination">
      <span>
        {total
          ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}`
          : "0 results"}
      </span>
      <button
        className="m3-button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        ← Previous
      </button>
      <button
        className="m3-button"
        disabled={page * limit >= total}
        onClick={() => onChange(page + 1)}
      >
        Next →
      </button>
    </div>
  );
}
export function Json({ value }: { value: unknown }) {
  return <pre className="m3-json">{JSON.stringify(value, null, 2)}</pre>;
}
