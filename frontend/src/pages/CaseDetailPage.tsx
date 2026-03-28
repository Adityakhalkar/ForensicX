import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CaseItem, getCase, uploadCaseImage } from "../api/client";

export function CaseDetailPage() {
  const { caseId } = useParams();
  const id = Number(caseId);
  const [data, setData] = useState<CaseItem | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setData(await getCase(id));
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setError("");
    setInfo("");
    try {
      const uploaded = await uploadCaseImage(id, file);
      setFile(null);
      await load();
      setInfo(`Uploaded "${String(uploaded.metadata_json.filename ?? uploaded.original_path)}" successfully.`);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="grid case-grid">
      <section className="card panel">
        <h2>Case</h2>
        <p className="case-title">{data?.title}</p>
        <p className="muted">{data?.description}</p>
        <form onSubmit={handleUpload} className="form-grid">
          <label>Upload Image</label>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button type="submit" disabled={!file}>
            Upload
          </button>
        </form>
      </section>
      <section className="card panel">
        <h2>Images</h2>
        <ul className="list">
          {data?.images.map((img) => (
            <li key={img.id}>
              <span className="item-name">{String(img.metadata_json.filename ?? img.original_path)}</span>
              <Link className="item-link" to={`/cases/${id}/run?imageId=${img.id}`}>
                Run Comparison
              </Link>
            </li>
          ))}
        </ul>
        {data && data.images.length === 0 ? <small className="hint">No images uploaded in this case yet.</small> : null}
        {info ? <div className="success-inline">{info}</div> : null}
        {error ? <pre className="error">{error}</pre> : null}
      </section>
    </div>
  );
}
