from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import torch

from app.core.config import settings
from app.ml.generator import Generator
from app.ml.realesrgan_x4v3 import SRVGGNetCompact
from app.ml.rrdbnet import RRDBNet


def resolve_device() -> torch.device:
    if settings.MODEL_DEVICE == "cpu":
        return torch.device("cpu")
    if settings.MODEL_DEVICE == "cuda":
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def _load_state(path: Path) -> dict:
    state = torch.load(path, map_location="cpu", weights_only=True)
    if isinstance(state, dict) and "params_ema" in state:
        return state["params_ema"]
    if isinstance(state, dict) and "params" in state:
        return state["params"]
    return state


def _blend_states(state_a: dict, state_b: dict, weight_a: float, weight_b: float) -> dict:
    out = {}
    for key in state_a.keys():
        out[key] = weight_a * state_a[key] + weight_b * state_b[key]
    return out


@lru_cache(maxsize=1)
def get_srgan() -> tuple[Generator, torch.device]:
    device = resolve_device()
    model = Generator()
    state = torch.load(settings.SRGAN_WEIGHTS, map_location="cpu", weights_only=True)
    model.load_state_dict(state, strict=True)
    model.eval().to(device)
    return model, device


@lru_cache(maxsize=1)
def get_realesrgan() -> tuple[SRVGGNetCompact, torch.device]:
    device = resolve_device()
    model = SRVGGNetCompact(num_in_ch=3, num_out_ch=3, num_feat=64, num_conv=32, upscale=4, act_type="prelu")
    general = _load_state(settings.REALESRGAN_X4_WEIGHTS)
    wdn = _load_state(settings.REALESRGAN_WDN_X4_WEIGHTS)
    alpha = settings.DENOISE_STRENGTH
    state = _blend_states(general, wdn, alpha, 1.0 - alpha)
    model.load_state_dict(state, strict=True)
    model.eval().to(device)
    return model, device


@lru_cache(maxsize=1)
def get_realesrgan_x4plus() -> tuple[RRDBNet, torch.device]:
    device = resolve_device()
    model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
    state = _load_state(settings.REALESRGAN_X4PLUS_WEIGHTS)
    model.load_state_dict(state, strict=True)
    model.eval().to(device)
    return model, device

