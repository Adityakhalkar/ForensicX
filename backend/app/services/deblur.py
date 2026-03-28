from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image


@dataclass
class BlurAnalysis:
    """Result of blur detection."""
    laplacian_variance: float
    is_blurry: bool
    blur_level: str  # "low", "medium", "high"


def detect_blur(image: Image.Image, threshold_low: float = 100.0, threshold_high: float = 300.0) -> BlurAnalysis:
    """Detect blur level using Laplacian variance.

    Lower variance = more blur. Typical ranges:
    - Sharp image: >300
    - Mild blur: 100-300
    - Heavy blur: <100
    """
    gray = cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2GRAY)
    variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    if variance >= threshold_high:
        level = "low"
        is_blurry = False
    elif variance >= threshold_low:
        level = "medium"
        is_blurry = True
    else:
        level = "high"
        is_blurry = True

    return BlurAnalysis(laplacian_variance=variance, is_blurry=is_blurry, blur_level=level)


def preprocess_image(
    image: Image.Image,
    mode: str = "auto",
    denoise_strength: int = 10,
    sharpen_amount: float = 1.5,
) -> tuple[Image.Image, dict]:
    """Preprocess image to reduce blur before super-resolution.

    Args:
        image: Input PIL image.
        mode: "auto" (detect and apply if blurry), "deblur" (always apply), "none" (skip).
        denoise_strength: Strength for non-local means denoising (h parameter). Higher = more smoothing.
        sharpen_amount: Strength of unsharp mask. 0 = no sharpening, 2.0 = strong.

    Returns:
        Tuple of (processed image, metadata dict with blur analysis and what was applied).
    """
    metadata: dict = {"mode": mode, "applied": []}

    # Analyze blur
    analysis = detect_blur(image)
    metadata["blur_analysis"] = {
        "laplacian_variance": round(analysis.laplacian_variance, 2),
        "blur_level": analysis.blur_level,
        "is_blurry": analysis.is_blurry,
    }

    # Decide whether to preprocess
    if mode == "none":
        return image, metadata
    if mode == "auto" and not analysis.is_blurry:
        metadata["skipped"] = "Image is sharp enough, no preprocessing needed"
        return image, metadata

    img_arr = np.asarray(image, dtype=np.uint8)

    # Stage 1: Non-local means denoising
    # Reduces noise and mild blur while preserving edges
    # h=denoise_strength, hForColor=denoise_strength, templateWindowSize=7, searchWindowSize=21
    h = denoise_strength
    if analysis.blur_level == "high":
        h = max(denoise_strength, 15)  # Stronger denoising for heavily blurred images

    denoised = cv2.fastNlMeansDenoisingColored(img_arr, None, h, h, 7, 21)
    metadata["applied"].append(f"nlmeans_denoise(h={h})")

    # Stage 2: Unsharp masking for edge enhancement
    # Gaussian blur → subtract from original → add scaled difference back
    if sharpen_amount > 0:
        gaussian = cv2.GaussianBlur(denoised, (0, 0), sigmaX=2.0)
        sharpened = cv2.addWeighted(denoised, 1.0 + sharpen_amount, gaussian, -sharpen_amount, 0)
        metadata["applied"].append(f"unsharp_mask(amount={sharpen_amount})")
    else:
        sharpened = denoised

    # Stage 3: CLAHE (Contrast Limited Adaptive Histogram Equalization) for contrast
    # Only for heavily blurred images — improves local contrast
    if analysis.blur_level == "high":
        lab = cv2.cvtColor(sharpened, cv2.COLOR_RGB2LAB)
        l_channel = lab[:, :, 0]
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        lab[:, :, 0] = clahe.apply(l_channel)
        sharpened = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)
        metadata["applied"].append("clahe(clip=2.0)")

    result = Image.fromarray(sharpened)

    # Post-analysis to show improvement
    post_analysis = detect_blur(result)
    metadata["post_blur_analysis"] = {
        "laplacian_variance": round(post_analysis.laplacian_variance, 2),
        "blur_level": post_analysis.blur_level,
        "improvement": round(post_analysis.laplacian_variance - analysis.laplacian_variance, 2),
    }

    return result, metadata
