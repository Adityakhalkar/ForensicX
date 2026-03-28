import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCases, useCreateCase } from "../hooks/useCases";

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: cases, isLoading, error: fetchError } = useCases();
  const createCase = useCreateCase();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    try {
      const created = await createCase.mutateAsync({ title, description: description || undefined });
      setTitle("");
      setDescription("");
      navigate(`/cases/${created.id}`);
    } catch {
      // error is available via createCase.error
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
          <button type="submit" disabled={createCase.isPending}>
            {createCase.isPending ? "Creating..." : "Create"}
          </button>
        </form>
        {createCase.error ? <pre className="error">{(createCase.error as any).message ?? String(createCase.error)}</pre> : null}
      </section>

      <section className="card panel">
        <h2>Cases</h2>
        {isLoading ? <p className="hint">Loading cases...</p> : null}
        <ul className="list">
          {cases?.map((item) => (
            <li key={item.id}>
              <Link className="item-link" to={`/cases/${item.id}`}>{item.title}</Link>
              <span className="muted">{new Date(item.created_at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
        {cases && cases.length === 0 ? <small className="hint">No cases yet. Create your first case to begin.</small> : null}
        {fetchError ? <pre className="error">{(fetchError as any).message ?? String(fetchError)}</pre> : null}
      </section>
    </div>
  );
}
