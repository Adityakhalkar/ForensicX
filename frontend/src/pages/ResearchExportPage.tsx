import { FormEvent, useState } from "react";
import { useCreateExperiment, useExperimentSummary, useGenerateReport } from "../hooks/useExperiments";
import { experimentsApi, reportsApi } from "../api/client";

export function ResearchExportPage() {
  const [datasetPath, setDatasetPath] = useState("");
  const [experimentId, setExperimentId] = useState<number | null>(null);
  const [reportId, setReportId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const createExperiment = useCreateExperiment();
  const { data: summary, refetch: refreshSummary } = useExperimentSummary(experimentId);
  const generateReport = useGenerateReport();

  async function startExperiment(event: FormEvent) {
    event.preventDefault();
    if (!datasetPath.trim()) {
      setError("Enter a dataset folder path.");
      return;
    }
    setError("");
    try {
      const exp = await createExperiment.mutateAsync({
        name: "Forensic Benchmark",
        dataset_path: datasetPath,
        mode: "synthetic_x4",
        models: ["srgan", "realesrgan", "bicubic"],
        limit: 100,
      });
      setExperimentId(exp.id);
    } catch {
      // error via createExperiment.error
    }
  }

  async function handleDownloadCsv() {
    if (!experimentId) return;
    try {
      const blobUrl = await experimentsApi.getCsvBlob(experimentId);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `experiment_${experimentId}_results.csv`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      setError((e as any).message ?? String(e));
    }
  }

  async function handleGenerateReport() {
    if (!experimentId) return;
    try {
      const rep = await generateReport.mutateAsync({
        experiment_id: experimentId,
        title: "Forensic Enhancement Research Summary",
      });
      setReportId(rep.id);
    } catch {
      // error via generateReport.error
    }
  }

  async function handleDownloadReport() {
    if (!reportId) return;
    try {
      const blobUrl = await reportsApi.getBlob(reportId);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `report_${reportId}.md`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      setError((e as any).message ?? String(e));
    }
  }

  const summaryEntries = summary?.summary_json ? Object.entries(summary.summary_json) : [];

  return (
    <section className="card panel">
      <h2>Research Export</h2>
      <form onSubmit={startExperiment} className="form-grid">
        <label>Dataset Folder</label>
        <input
          value={datasetPath}
          onChange={(e) => setDatasetPath(e.target.value)}
          placeholder="/path/to/dataset"
        />
        <button type="submit" disabled={createExperiment.isPending}>
          {createExperiment.isPending ? "Starting..." : "Start Batch Experiment"}
        </button>
      </form>

      {experimentId ? (
        <>
          <div className="selected-pill">
            Experiment #{experimentId} — Status: {summary?.status ?? "loading..."}
          </div>
          <div className="row">
            <button onClick={() => void refreshSummary()}>Refresh Summary</button>
            <button onClick={handleDownloadCsv} disabled={!summary?.csv_path}>Download CSV</button>
            <button onClick={handleGenerateReport} disabled={generateReport.isPending}>
              {generateReport.isPending ? "Generating..." : "Generate Report"}
            </button>
          </div>
        </>
      ) : null}

      {summaryEntries.length > 0 ? (
        <table className="metrics-table">
          <thead>
            <tr><th>Key</th><th>Value</th></tr>
          </thead>
          <tbody>
            {summaryEntries.map(([key, val]) => (
              <tr key={key}>
                <td>{key}</td>
                <td>{typeof val === "object" ? JSON.stringify(val, null, 2) : String(val)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {reportId ? (
        <p className="success-inline">
          Report ready. <button className="link-btn" onClick={handleDownloadReport}>Download</button>
        </p>
      ) : null}

      {error ? <pre className="error">{error}</pre> : null}
      {createExperiment.error ? <pre className="error">{(createExperiment.error as any).message}</pre> : null}
      {generateReport.error ? <pre className="error">{(generateReport.error as any).message}</pre> : null}
    </section>
  );
}
