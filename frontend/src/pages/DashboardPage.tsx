import { FormEvent, useEffect, useState } from "react";
import { CaseItem, createCase, listCases } from "../api/client";
import { Link, useNavigate } from "react-router-dom";

export function DashboardPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  async function loadCases() {
    try {
      setCases(await listCases());
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    void loadCases();
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const created = await createCase(title, description);
      setTitle("");
      setDescription("");
      await loadCases();
      navigate(`/cases/${created.id}`);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="grid dashboard-grid">
      <section className="card panel">
        <h2>Create Case</h2>
        <p className="hint">Group related evidence images into organized investigation cases.</p>
        <form onSubmit={handleCreate} className="form-grid">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          <label>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          <button type="submit">Create</button>
        </form>
      </section>

      <section className="card panel">
        <h2>Cases</h2>
        <ul className="list">
          {cases.map((item) => (
            <li key={item.id}>
              <Link className="item-link" to={`/cases/${item.id}`}>
                {item.title}
              </Link>
              <span className="muted">{new Date(item.created_at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
        {cases.length === 0 ? <small className="hint">No cases yet. Create your first case to begin.</small> : null}
        {error ? <pre className="error">{error}</pre> : null}
      </section>
    </div>
  );
}
