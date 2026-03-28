import { FormEvent, useState } from "react";
import { createBatchExperiment, generateReport, getExperimentCsvUrl, getExperimentSummary, getReportUrl } from "../api/client";

export function ResearchExportPage() {
  const [datasetPath, setDatasetPath] = useState("D:\\BE_Final_Year_Project\\super-resolution-image-enhancer-main\\Image_For_Test2");
  const [experimentId, setExperimentId] = useState<number | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [reportId, setReportId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function startExperiment(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const exp = await createBatchExperiment({
        name: "Forensic Benchmark",
        dataset_path: datasetPath,
        mode: "synthetic_x4",
        models: ["srgan", "realesrgan", "bicubic"],
        limit: 100
      });
      setExperimentId(exp.id);
      setSummary(exp.summary_json);
    } catch (e) {
      setError(String(e));
    }
  }

  async function refreshSummary() {
    if (!experimentId) return;
    try {
      const exp = await getExperimentSummary(experimentId);
      setSummary(exp.summary_json);
    } catch (e) {
      setError(String(e));
    }
  }

  async function createReport() {
    if (!experimentId) return;
    try {
      const rep = await generateReport({
        experiment_id: experimentId,
        title: "Forensic Enhancement Research Summary"
      });
      setReportId(rep.id);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <section className="card">
      <h2>Research Export</h2>
      <form onSubmit={startExperiment} className="form-grid">
        <label>Dataset Folder</label>
        <input value={datasetPath} onChange={(e) => setDatasetPath(e.target.value)} />
        <button type="submit">Start Batch Experiment</button>
      </form>

      {experimentId ? (
        <div className="row">
          <button onClick={refreshSummary}>Refresh Summary</button>
          <a href={getExperimentCsvUrl(experimentId)} target="_blank" rel="noreferrer">
            Download CSV
          </a>
          <button onClick={createReport}>Generate Report</button>
        </div>
      ) : null}

      {summary ? <pre>{JSON.stringify(summary, null, 2)}</pre> : null}
      {reportId ? (
        <p>
          Report ready:{" "}
          <a href={getReportUrl(reportId)} target="_blank" rel="noreferrer">
            Download
          </a>
        </p>
      ) : null}
      {error ? <pre className="error">{error}</pre> : null}
    </section>
  );
}

