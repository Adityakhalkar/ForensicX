import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useRunStatus, useRunResults } from "../hooks/useRuns";
import { useRunProgress } from "../hooks/useRunProgress";
import { filesApi } from "../api/client";
import { DisclaimerBanner } from "../components/DisclaimerBanner";

function fmtMetric(value: number | null | undefined, digits = 4): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Not computed";
  return value.toFixed(digits);
}

function ArtifactImage({ path, alt }: { path: string; alt: string }) {
  const [src, setSrc] = useState<string>("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;
    filesApi.getArtifactUrl(path).then((url) => {
      if (cancelled) { URL.revokeObjectURL(url); return; }
      blobUrl = url;
      setSrc(url);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [path]);
  if (error) return <div className="hint">Failed to load image</div>;
  if (!src) return <div className="hint">Loading image...</div>;
  return <img src={src} alt={alt} />;
}

function CompareSlider({ beforePath, afterPath, title }: { beforePath: string; afterPath: string; title: string }) {
  const [position, setPosition] = useState(50);
  const [beforeSrc, setBeforeSrc] = useState("");
  const [afterSrc, setAfterSrc] = useState("");

  useEffect(() => {
    let cancelled = false;
    let revokeBefore: string | null = null;
    let revokeAfter: string | null = null;
    filesApi.getArtifactUrl(beforePath).then((url) => {
      if (cancelled) { URL.revokeObjectURL(url); return; }
      revokeBefore = url;
      setBeforeSrc(url);
    }).catch(() => {});
    filesApi.getArtifactUrl(afterPath).then((url) => {
      if (cancelled) { URL.revokeObjectURL(url); return; }
      revokeAfter = url;
      setAfterSrc(url);
    }).catch(() => {});
    return () => {
      cancelled = true;
      if (revokeBefore) URL.revokeObjectURL(revokeBefore);
      if (revokeAfter) URL.revokeObjectURL(revokeAfter);
    };
  }, [beforePath, afterPath]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") setPosition((p) => Math.max(0, p - 2));
    if (e.key === "ArrowRight") setPosition((p) => Math.min(100, p + 2));
  }

  if (!beforeSrc || !afterSrc) return <div className="hint">Loading comparison...</div>;

  return (
    <div>
      <small>{title}</small>
      <div className="compare-slider" style={{ ["--split" as string]: `${position}%` }}>
        <img src={beforeSrc} alt={`${title} baseline`} />
        <div className="compare-after">
          <img src={afterSrc} alt={`${title} enhanced`} />
        </div>
        <div className="compare-handle" />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
        onKeyDown={handleKeyDown}
        className="compare-range"
        aria-label={`${title} comparison slider`}
      />
    </div>
  );
}

export function MetricsPage() {
  const { runId } = useParams();
  const id = Number(runId);

  if (!runId || isNaN(id) || id <= 0) {
    return <section className="card panel"><h2>Invalid run ID</h2></section>;
  }

  const { data: status } = useRunStatus(id);
  const isComplete = status?.status === "completed";
  const isFailed = status?.status === "failed";
  const { data: results } = useRunResults(id, isComplete);

  // SSE for real-time progress
  useRunProgress(id);

  const bicubicOutput = results?.outputs.find((o) => o.model_name === "bicubic");

  return (
    <section className="card panel">
      <h2>Run Metrics</h2>
      <DisclaimerBanner />
      {status ? (
        <div className="selected-pill">
          Status: {status.status} ({status.progress}%)
          {!isComplete && !isFailed ? (
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${status.progress}%` }} />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="hint">Loading run status...</p>
      )}
      {status?.error_message ? <pre className="error">{status.error_message}</pre> : null}
      {results ? (
        <div className="grid metrics-grid">
          <section className="card panel">
            <h3>Outputs</h3>
            <ul className="list">
              {results.outputs.map((o) => (
                <li key={o.model_name}>
                  <strong>{o.model_name}</strong>
                  <div className="artifact-grid">
                    <div>
                      <small>Output</small>
                      <ArtifactImage path={o.output_path} alt={`${o.model_name} output`} />
                    </div>
                    {bicubicOutput && o.model_name !== "bicubic" ? (
                      <CompareSlider
                        beforePath={bicubicOutput.output_path}
                        afterPath={o.output_path}
                        title={`${o.model_name} vs bicubic`}
                      />
                    ) : null}
                    {o.diff_path ? (
                      <div>
                        <small>Diff</small>
                        <ArtifactImage path={o.diff_path} alt={`${o.model_name} diff`} />
                      </div>
                    ) : null}
                    {o.roi_compare_path ? (
                      <div>
                        <small>ROI</small>
                        <ArtifactImage path={o.roi_compare_path} alt={`${o.model_name} roi compare`} />
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="card panel">
            <h3>Metrics</h3>
            <ul className="list">
              {results.metrics.map((m) => (
                <li key={m.model_name}>
                  <strong>{m.model_name}</strong>
                  <div>PSNR: {fmtMetric(m.psnr, 3)}</div>
                  <div>LPIPS: {fmtMetric(m.lpips, 4)}</div>
                  <div>SSIM: {fmtMetric(m.ssim, 4)}</div>
                  {m.psnr === null && m.lpips === null && m.ssim === null ? (
                    <small className="hint">Quality metrics need a selected Quality Reference Image.</small>
                  ) : null}
                  <div>
                    OCR:{" "}
                    {m.ocr_json.available
                      ? `${m.ocr_json.text?.trim() || "(no text detected)"}`
                      : "Not computed (install Tesseract OCR to enable)."}
                  </div>
                  {m.ocr_json.available ? (
                    <small className="hint">
                      OCR confidence: {m.ocr_json.confidence == null ? "N/A" : m.ocr_json.confidence.toFixed(2)}
                    </small>
                  ) : null}
                  <div>
                    Face:{" "}
                    {m.face_json.available
                      ? `Similarity score ${fmtMetric(m.face_json.score, 4)}`
                      : "Not computed (select a Face Reference Image)."}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </section>
  );
}
