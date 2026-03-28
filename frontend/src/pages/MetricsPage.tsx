import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getArtifactUrl, getRunResults, getRunStatus } from "../api/client";
import { DisclaimerBanner } from "../components/DisclaimerBanner";

type RunResults = {
  run: { status: string; progress: number; error_message?: string | null };
  outputs: { model_name: string; output_path: string; diff_path?: string | null; roi_compare_path?: string | null }[];
  metrics: {
    model_name: string;
    psnr?: number | null;
    lpips?: number | null;
    ssim?: number | null;
    ocr_json: {
      available?: boolean;
      text?: string;
      confidence?: number | null;
      normalized_edit_distance?: number | null;
      note?: string | null;
    };
    face_json: {
      available?: boolean;
      score?: number | null;
      note?: string | null;
    };
  }[];
  disclaimer: string;
};

function fmtMetric(value: number | null | undefined, digits = 4): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Not computed";
  }
  return value.toFixed(digits);
}

function CompareSlider({ beforePath, afterPath, title }: { beforePath: string; afterPath: string; title: string }) {
  const [position, setPosition] = useState(50);
  return (
    <div>
      <small>{title}</small>
      <div className="compare-slider" style={{ ["--split" as string]: `${position}%` }}>
        <img src={getArtifactUrl(beforePath)} alt={`${title} baseline`} />
        <div className="compare-after">
          <img src={getArtifactUrl(afterPath)} alt={`${title} enhanced`} />
        </div>
        <div className="compare-handle" />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
        className="compare-range"
      />
    </div>
  );
}

export function MetricsPage() {
  const { runId } = useParams();
  const id = Number(runId);
  const [status, setStatus] = useState<{ status: string; progress: number; error_message?: string | null } | null>(null);
  const [results, setResults] = useState<RunResults | null>(null);
  const [error, setError] = useState("");
  const bicubicOutput = results?.outputs.find((o) => o.model_name === "bicubic");

  useEffect(() => {
    let timer: number | undefined;
    async function poll() {
      try {
        const s = await getRunStatus(id);
        setStatus(s);
        if (s.status === "completed") {
          setResults(await getRunResults(id));
        } else if (s.status === "running" || s.status === "queued") {
          timer = window.setTimeout(() => {
            void poll();
          }, 1500);
        }
      } catch (e) {
        setError(String(e));
      }
    }
    void poll();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [id]);

  return (
    <section className="card panel">
      <h2>Run Metrics</h2>
      <DisclaimerBanner />
      {status ? <p className="selected-pill">Status: {status.status} ({status.progress}%)</p> : null}
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
                      <img src={getArtifactUrl(o.output_path)} alt={`${o.model_name} output`} />
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
                        <img src={getArtifactUrl(o.diff_path)} alt={`${o.model_name} diff`} />
                      </div>
                    ) : null}
                    {o.roi_compare_path ? (
                      <div>
                        <small>ROI</small>
                        <img src={getArtifactUrl(o.roi_compare_path)} alt={`${o.model_name} roi compare`} />
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
                      OCR confidence:{" "}
                      {m.ocr_json.confidence === null || m.ocr_json.confidence === undefined
                        ? "N/A"
                        : m.ocr_json.confidence.toFixed(2)}
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
      {error ? <pre className="error">{error}</pre> : null}
    </section>
  );
}
