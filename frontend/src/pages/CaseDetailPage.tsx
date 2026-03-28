import { FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCase, useUploadImage } from "../hooks/useCases";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export function CaseDetailPage() {
  const { caseId } = useParams();
  const id = Number(caseId);
  const { data, isLoading, error: fetchError } = useCase(id);
  const upload = useUploadImage(id);
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState("");
  const [fileError, setFileError] = useState("");

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setFileError("File too large. Maximum size is 20MB.");
      return;
    }
    setFileError("");
    setInfo("");
    try {
      const uploaded = await upload.mutateAsync(file);
      setFile(null);
      setInfo(`Uploaded "${String(uploaded.metadata_json.filename ?? uploaded.original_path)}" successfully.`);
    } catch {
      // error available via upload.error
    }
  }

  if (isLoading) return <p className="hint">Loading case...</p>;

  return (
    <div className="grid case-grid">
      <section className="card panel">
        <h2>Case</h2>
        <p className="case-title">{data?.title}</p>
        <p className="muted">{data?.description}</p>
        <form onSubmit={handleUpload} className="form-grid">
          <label>Upload Image</label>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button type="submit" disabled={!file || upload.isPending}>
            {upload.isPending ? "Uploading..." : "Upload"}
          </button>
        </form>
      </section>
      <section className="card panel">
        <h2>Images</h2>
        <ul className="list">
          {data?.images.map((img) => (
            <li key={img.id}>
              <span className="item-name">{String(img.metadata_json.filename ?? img.original_path)}</span>
              <Link className="item-link" to={`/cases/${id}/run?imageId=${img.id}`}>Run Comparison</Link>
            </li>
          ))}
        </ul>
        {data && data.images.length === 0 ? <small className="hint">No images uploaded in this case yet.</small> : null}
        {info ? <div className="success-inline">{info}</div> : null}
        {fileError ? <pre className="error">{fileError}</pre> : null}
        {upload.error ? <pre className="error">{(upload.error as any).message ?? String(upload.error)}</pre> : null}
        {fetchError ? <pre className="error">{(fetchError as any).message ?? String(fetchError)}</pre> : null}
      </section>
    </div>
  );
}
