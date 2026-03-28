import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { CaseItem, createRun, getCase, uploadCaseImage } from "../api/client";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function RunComparisonPage() {
  const { caseId } = useParams();
  const query = useQuery();
  const imageId = Number(query.get("imageId"));
  const caseNumericId = Number(caseId);
  const [caseData, setCaseData] = useState<CaseItem | null>(null);
  const [includeSrgan, setIncludeSrgan] = useState(true);
  const [includeRealesr, setIncludeRealesr] = useState(true);
  const [includeBicubic, setIncludeBicubic] = useState(true);
  const [referenceImageId, setReferenceImageId] = useState("");
  const [faceReferenceImageId, setFaceReferenceImageId] = useState("");
  const [referenceText, setReferenceText] = useState("");
  const [referenceUploadFile, setReferenceUploadFile] = useState<File | null>(null);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [isUploadingReference, setIsUploadingReference] = useState(false);
  const [resultRunId, setResultRunId] = useState<number | null>(null);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  async function loadCaseData() {
    try {
      const data = await getCase(caseNumericId);
      setCaseData(data);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function initialLoad() {
      try {
        const data = await getCase(caseNumericId);
        if (!cancelled) {
          setCaseData(data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(String(e));
        }
      }
    }
    if (Number.isFinite(caseNumericId) && caseNumericId > 0) {
      void initialLoad();
    }
    return () => {
      cancelled = true;
    };
  }, [caseNumericId]);

  const imageOptions = useMemo(() => {
    return (caseData?.images ?? []).map((img) => {
      const fileName = String(img.metadata_json.filename ?? img.original_path);
      return { id: img.id, label: fileName };
    });
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
      setError("Quality reference cannot be the same as input image. Upload/select a different image.");
      return;
    }
    setError("");
    setInfo("");
    try {
      const payload = await createRun({
        case_id: caseNumericId,
        image_id: imageId,
        models,
        scale: 4,
        reference_image_id: referenceImageId ? Number(referenceImageId) : null,
        face_reference_image_id: faceReferenceImageId ? Number(faceReferenceImageId) : null,
        reference_text: referenceText || null
      });
      setResultRunId(payload.id);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleReferenceUpload(event: FormEvent) {
    event.preventDefault();
    if (!referenceUploadFile) {
      setError("Choose a reference image file first.");
      return;
    }
    setError("");
    setInfo("");
    setIsUploadingReference(true);
    try {
      const uploaded = await uploadCaseImage(caseNumericId, referenceUploadFile);
      await loadCaseData();
      setReferenceImageId(String(uploaded.id));
      setReferenceUploadFile(null);
      setUploadInputKey((v) => v + 1);
      setInfo("Reference image uploaded and selected for quality metrics.");
    } catch (e) {
      setError(String(e));
    } finally {
      setIsUploadingReference(false);
    }
  }

  return (
    <section className="card panel">
      <h2>Run Comparison</h2>
      {selectedInputName ? <p className="selected-pill">Selected image: {selectedInputName}</p> : null}
      <form onSubmit={submit} className="form-grid run-form">
        <label className="check-row">
          <input type="checkbox" checked={includeSrgan} onChange={(e) => setIncludeSrgan(e.target.checked)} />
          SRGAN
        </label>
        <label className="check-row">
          <input type="checkbox" checked={includeRealesr} onChange={(e) => setIncludeRealesr(e.target.checked)} />
          Real-ESRGAN
        </label>
        <label className="check-row">
          <input type="checkbox" checked={includeBicubic} onChange={(e) => setIncludeBicubic(e.target.checked)} />
          Bicubic
        </label>
        <label>Reference Text (optional)</label>
        <input value={referenceText} onChange={(e) => setReferenceText(e.target.value)} />
        <label>Quality Reference Image (optional, enables PSNR/LPIPS/SSIM)</label>
        <select value={referenceImageId} onChange={(e) => setReferenceImageId(e.target.value)}>
          <option value="">None</option>
          {imageOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <small className="hint">
          Choose a different higher-quality image of the same scene/object. Do not choose the same input image.
        </small>
        {selectedQualityIsInput ? (
          <div className="warning-inline">
            Selected quality reference is same as input. Scores become misleading. Pick another image.
          </div>
        ) : null}
        <label>Face Reference Image (optional, enables face similarity)</label>
        <select value={faceReferenceImageId} onChange={(e) => setFaceReferenceImageId(e.target.value)}>
          <option value="">None</option>
          {imageOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <small className="hint">
          Choose a clear face image of the same person to calculate face similarity score.
        </small>
        <button type="submit" disabled={selectedQualityIsInput}>
          Start Run
        </button>
      </form>
      <form onSubmit={handleReferenceUpload} className="form-grid top-gap">
        <label>Need to upload a new reference image?</label>
        <input
          key={uploadInputKey}
          type="file"
          accept="image/*"
          onChange={(e) => setReferenceUploadFile(e.target.files?.[0] ?? null)}
        />
        <button type="submit" disabled={!referenceUploadFile || isUploadingReference}>
          {isUploadingReference ? "Uploading..." : "Upload Reference Image"}
        </button>
      </form>
      {resultRunId ? (
        <p className="success-inline">
          Run created successfully. <Link to={`/runs/${resultRunId}/metrics`}>View Metrics</Link>
        </p>
      ) : null}
      {info ? <div className="success-inline">{info}</div> : null}
      {error ? <pre className="error">{error}</pre> : null}
    </section>
  );
}
