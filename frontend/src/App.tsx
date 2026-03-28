import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { logout } from "./api/client";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CaseDetailPage } from "./pages/CaseDetailPage";
import { RunComparisonPage } from "./pages/RunComparisonPage";
import { MetricsPage } from "./pages/MetricsPage";

function TopNav() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  return (
    <header className="topnav">
      <h1 className="brand-title">Forensic Enhancement Assistant</h1>
      {token ? (
        <nav className="row nav-actions">
          <Link className="nav-link" to="/">
            Dashboard
          </Link>
          <button
            className="nav-link"
            onClick={async () => {
              try {
                await logout();
              } catch {
                // Ignore logout API failures and clear local session anyway.
              }
              localStorage.removeItem("token");
              navigate("/login");
            }}
          >
            Logout
          </button>
        </nav>
      ) : null}
    </header>
  );
}

function Protected({ children }: { children: JSX.Element }) {
  if (!localStorage.getItem("token")) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <>
      <TopNav />
      <main className="container app-shell">
        <Routes>
          <Route path="/login" element={<LoginPage onAuthenticated={() => (window.location.href = "/")} />} />
          <Route
            path="/"
            element={
              <Protected>
                <DashboardPage />
              </Protected>
            }
          />
          <Route
            path="/cases/:caseId"
            element={
              <Protected>
                <CaseDetailPage />
              </Protected>
            }
          />
          <Route
            path="/cases/:caseId/run"
            element={
              <Protected>
                <RunComparisonPage />
              </Protected>
            }
          />
          <Route
            path="/runs/:runId/metrics"
            element={
              <Protected>
                <MetricsPage />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
