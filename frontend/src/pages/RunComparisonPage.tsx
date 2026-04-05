import { FormEvent, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useCase, useUploadImage } from "../hooks/useCases";
import { useCreateRun } from "../hooks/useRuns";
import { getErrorMessage } from "../api/client";

function useQueryParams() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function RunComparisonPage() {
  const { caseId } = useParams();
  const query = useQueryParams();
  const imageId = Number(query.get("imageId"));
  const caseNumericId = Number(caseId);

  const { data: caseData } = useCase(caseNumericId);
  const createRun = useCreateRun();
  const uploadRef = useUploadImage(caseNumericId);

  const [includeSrgan, setIncludeSrgan] = useState(true);
  const [includeRealesr, setIncludeRealesr] = useState(true);
  const [includeBicubic, setIncludeBicubic] = useState(true);
  const [referenceImageId, setReferenceImageId] = useState("");
  const [faceReferenceImageId, setFaceReferenceImageId] = useState("");
  const [referenceText, setReferenceText] = useState("");
  const [preprocess, setPreprocess] = useState("auto");
  const [denoiseStrength, setDenoiseStrength] = useState(10);
  const [referenceUploadFile, setReferenceUploadFile] = useState<File | null>(null);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  const imageOptions = useMemo(() => {
    return (caseData?.images ?? []).map((img) => ({
      id: img.id,
      label: String(img.metadata_json.filename ?? img.original_path),
    }));
  }, [caseData]);

  const selectedInputName = useMemo(() => {
    const match = (caseData?.images ?? []).find((img) => img.id === imageId);
    return match ? String(match.metadata_json.filename ?? match.original_path) : null;
  }, [caseData, imageId]);

  const selectedQualityIsInput = referenceImageId !== "" && Number(referenceImageId) === imageId;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const models: string[] = [];
    if (includeSrgan) models.push("srgan");
    if (includeRealesr) models.push("realesrgan");
    if (includeBicubic) models.push("bicubic");
    if (models.length === 0) {
      setError("Select at least one model.");
      return;
    }
    if (selectedQualityIsInput) {
      setError("Quality reference cannot be the same as input image.");
      return;
    }
    setError("");
    setInfo("");
    try {
      await createRun.mutateAsync({
        case_id: caseNumericId,
        image_id: imageId,
        models,
        scale: 4,
        reference_image_id: referenceImageId ? Number(referenceImageId) : null,
        face_reference_image_id: faceReferenceImageId ? Number(faceReferenceImageId) : null,
        reference_text: referenceText || null,
        preprocess,
        denoise_strength: denoiseStrength,
      });
    } catch { /* mutation error rendered via hook */ }
  }

  async function handleReferenceUpload(event: FormEvent) {
    event.preventDefault();
    if (!referenceUploadFile) return;
    setError("");
    setInfo("");
    try {
      const uploaded = await uploadRef.mutateAsync(referenceUploadFile);
      setReferenceImageId(String(uploaded.id));
      setReferenceUploadFile(null);
      setUploadInputKey((v) => v + 1);
      setInfo("Reference image uploaded and selected for quality metrics.");
    } catch { /* mutation error rendered via hook */ }
  }

  return (
    <section className="card panel">
      <h2>Run Comparison</h2>
      {selectedInputName ? <p className="selected-pill">Selected image: {selectedInputName}</p> : null}
      <form onSubmit={submit} className="form-grid run-form">
        <label className="check-row">
          <input type="checkbox" checked={includeSrgan} onChange={(e) => setIncludeSrgan(e.target.checked)} /> SRGAN
        </label>
        <label className="check-row">
          <input type="checkbox" checked={includeRealesr} onChange={(e) => setIncludeRealesr(e.target.checked)} /> Real-ESRGAN
        </label>
        <label className="check-row">
          <input type="checkbox" checked={includeBicubic} onChange={(e) => setIncludeBicubic(e.target.checked)} /> Bicubic
        </label>
        <label>Image Preprocessing</label>
        <select value={preprocess} onChange={(e) => setPreprocess(e.target.value)}>
          <option value="auto">Auto (detect blur and preprocess if needed)</option>
          <option value="deblur">Always deblur</option>
          <option value="none">None (skip preprocessing)</option>
        </select>
        <small className="hint">Preprocessing sharpens blurry images before enhancement. Auto mode detects blur level automatically.</small>
        {preprocess !== "none" ? (
          <>
            <label>Denoise Strength: {denoiseStrength}</label>
            <input type="range" min={0} max={30} value={denoiseStrength} onChange={(e) => setDenoiseStrength(Number(e.target.value))} />
            <small className="hint">Higher values remove more noise but may smooth details. Default: 10.</small>
          </>
        ) : null}
        <label>Reference Text (optional)</label>
        <input value={referenceText} onChange={(e) => setReferenceText(e.target.value)} />
        <label>Quality Reference Image (optional, enables PSNR/LPIPS/SSIM)</label>
        <select value={referenceImageId} onChange={(e) => setReferenceImageId(e.target.value)}>
          <option value="">None</option>
          {imageOptions.map((opt) => (<option key={opt.id} value={opt.id}>{opt.label}</option>))}
        </select>
        <small className="hint">Choose a different higher-quality image of the same scene/object.</small>
        {selectedQualityIsInput ? (
          <div className="warning-inline">Selected quality reference is same as input. Pick another image.</div>
        ) : null}
        <label>Face Reference Image (optional, enables face similarity)</label>
        <select value={faceReferenceImageId} onChange={(e) => setFaceReferenceImageId(e.target.value)}>
          <option value="">None</option>
          {imageOptions.map((opt) => (<option key={opt.id} value={opt.id}>{opt.label}</option>))}
        </select>
        <small className="hint">Choose a clear face image of the same person to calculate face similarity score.</small>
        <button type="submit" disabled={selectedQualityIsInput || createRun.isPending}>
          {createRun.isPending ? "Starting..." : "Start Run"}
        </button>
      </form>

      <form onSubmit={handleReferenceUpload} className="form-grid top-gap">
        <label>Need to upload a new reference image?</label>
        <input key={uploadInputKey} type="file" accept="image/*" onChange={(e) => setReferenceUploadFile(e.target.files?.[0] ?? null)} />
        <button type="submit" disabled={!referenceUploadFile || uploadRef.isPending}>
          {uploadRef.isPending ? "Uploading..." : "Upload Reference Image"}
        </button>
      </form>

      {createRun.data ? (
        <p className="success-inline">
          Run created successfully. <Link to={`/runs/${createRun.data.id}/metrics`}>View Metrics</Link>
        </p>
      ) : null}
      {info ? <div className="success-inline">{info}</div> : null}
      {error ? <pre className="error">{error}</pre> : null}
      {createRun.error ? <pre className="error">{getErrorMessage(createRun.error)}</pre> : null}
      {uploadRef.error ? <pre className="error">{getErrorMessage(uploadRef.error)}</pre> : null}
    </section>
  );
}
