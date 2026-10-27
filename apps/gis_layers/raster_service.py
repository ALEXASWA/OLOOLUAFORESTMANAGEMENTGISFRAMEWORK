"""Server-side raster rendering and sampling for registered GeoTIFF layers.

Single source of truth for layer palettes: both the ingestion command and the
overlay/identify endpoints read the colormap stored on the RasterLayer record.
Supports 6- and 8-digit hex colours (8-digit includes alpha).
"""

from io import BytesIO

import numpy as np
import rasterio
from PIL import Image
from rasterio.warp import transform as warp_transform

# Oloolua class palette (spec: consistent legend for the four configured classes).
LULC_PALETTE = {
    1: ("#006400", "Forest"),
    2: ("#90EE90", "Grassland"),
    3: ("#A0522D", "Quarry / Bare land"),
    4: ("#D73027", "Built-up"),
}

# Binary change/structure layers: value 1 is the meaningful class, 0 stays transparent.
BINARY_STYLES = {
    "forest-loss-1990-2025": ("#D73027", "Forest loss (1990–2025)"),
    "forest-gain-1990-2025": ("#1A9850", "Forest gain (1990–2025)"),
    "persistent-forest-1990-2025": ("#006400", "Persistent forest (1990–2025)"),
    "builtup-expansion-1990-2025": ("#E08214", "Built-up expansion (1990–2025)"),
    "quarry-expansion-1990-2025": ("#A0522D", "Quarry expansion (1990–2025)"),
    "forest-core-2025": ("#006400", "Forest core (2025)"),
    "forest-edge-2025": ("#D4A017", "Forest edge (2025)"),
}

# Proposed analytical management zones (labels mirrored from ManagementZoneStatistic).
ZONE_STYLES = {
    0: ("#DCE9DC", "Zone 0 (surroundings)"),
    1: ("#005A32", "Core Conservation"),
    2: ("#238B45", "Conservation / Monitoring"),
    3: ("#F4C20D", "Rehabilitation"),
    4: ("#D73027", "Human-Pressure Management"),
    5: ("#74C476", "Sustainable Use / General Monitoring"),
}

RAMP_YLORRD = ["#FFFFCC", "#FED976", "#FD8D3C", "#F03B20", "#BD0026"]
RAMP_GREENS = ["#F7FCF5", "#C7E9C0", "#74C476", "#238B45", "#00441B"]
RAMP_RDYLGN = ["#A50026", "#F46D43", "#FEE08B", "#66BD63", "#006837"]


def _hex_to_rgba(color):
    color = color.lstrip("#")
    if len(color) == 6:
        color += "FF"
    return tuple(int(color[i:i + 2], 16) for i in (0, 2, 4, 6))


def lulc_colormap(classes=None):
    palette = dict(LULC_PALETTE)
    if classes:
        for code, name in classes.items():
            if code in palette:
                palette[code] = (palette[code][0], name)
    return {
        "type": "categorical",
        "entries": {str(code): {"color": color, "label": label} for code, (color, label) in palette.items()},
    }


def binary_colormap(slug):
    style = BINARY_STYLES.get(slug)
    if not style:
        match = next((key for key in BINARY_STYLES if key in slug), None)
        style = BINARY_STYLES[match] if match else ("#2D7253", "Present")
    color, label = style
    return {
        "type": "binary",
        "entries": {"1": {"color": color, "label": label}},
        "zero_transparent": True,
    }


def zone_colormap():
    return {
        "type": "categorical",
        "entries": {str(code): {"color": color, "label": label} for code, (color, label) in ZONE_STYLES.items()},
    }


def continuous_colormap(slug, vmin, vmax, ramp=None):
    ramp = ramp or _ramp_for_slug(slug)
    if vmax <= vmin:
        vmax = vmin + 1.0
    stops = [
        {"value": vmin + (vmax - vmin) * i / (len(ramp) - 1), "color": color}
        for i, color in enumerate(ramp)
    ]
    return {"type": "continuous", "stops": stops, "min": vmin, "max": vmax}


def _ramp_for_slug(slug):
    if "ndvi" in slug:
        return RAMP_RDYLGN
    if "density" in slug:
        return RAMP_GREENS
    return RAMP_YLORRD


def build_colormap(slug, data_type, classes=None, vmin=None, vmax=None):
    if "lulc" in slug:
        return lulc_colormap(classes)
    if slug in BINARY_STYLES or data_type == "binary":
        return binary_colormap(slug)
    if "management-zones" in slug:
        return zone_colormap()
    if data_type == "continuous":
        return continuous_colormap(slug, vmin or 0.0, vmax if vmax is not None else 1.0)
    return lulc_colormap(classes)


def legend_entries(colormap):
    if colormap.get("type") in ("categorical", "binary"):
        return [
            {"value": value, "color": entry["color"], "label": entry["label"]}
            for value, entry in colormap.get("entries", {}).items()
        ]
    return [
        {"value": stop["value"], "color": stop["color"], "label": f"{stop['value']:.2f}"}
        for stop in colormap.get("stops", [])
    ]


def apply_colormap(array, colormap):
    """Return an RGBA uint8 array for a single-band raster array."""
    rgba = np.zeros(array.shape + (4,), dtype=np.uint8)
    if colormap.get("type") in ("categorical", "binary"):
        entries = colormap.get("entries", {})
        for value, entry in entries.items():
            mask = array == float(value)
            rgba[mask] = _hex_to_rgba(entry["color"])
        return rgba
    stops = colormap.get("stops", [])
    if not stops:
        return rgba
    values = np.array([stop["value"] for stop in stops], dtype=float)
    colors = np.array([_hex_to_rgba(stop["color"])[:3] for stop in stops], dtype=float)
    valid = np.isfinite(array)
    clipped = np.clip(array[valid], values[0], values[-1])
    red = np.interp(clipped, values, colors[:, 0])
    green = np.interp(clipped, values, colors[:, 1])
    blue = np.interp(clipped, values, colors[:, 2])
    rgba[valid, 0] = red.astype(np.uint8)
    rgba[valid, 1] = green.astype(np.uint8)
    rgba[valid, 2] = blue.astype(np.uint8)
    rgba[valid, 3] = 255
    return rgba


def render_raster_png(raster_layer, max_dimension=2048):
    """Render the registered GeoTIFF to a colour-mapped PNG (bytes)."""
    with rasterio.open(raster_layer.file_path) as src:
        array = src.read(1)
        if max(array.shape) > max_dimension:
            factors = (
                max(1, int(np.ceil(array.shape[0] / max_dimension))),
                max(1, int(np.ceil(array.shape[1] / max_dimension))),
            )
            array = array[:: factors[0], :: factors[1]]
    if raster_layer.nodata is not None:
        array = np.where(array == raster_layer.nodata, np.nan, array)
    rgba = apply_colormap(array.astype(float), raster_layer.colormap or {})
    image = Image.fromarray(rgba, "RGBA")
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def sample_raster_value(raster_layer, lon, lat):
    """Sample the raster at a WGS84 coordinate; returns (value, label) or None."""
    with rasterio.open(raster_layer.file_path) as src:
        xs, ys = warp_transform("EPSG:4326", src.crs, [lon], [lat])
        point = (xs[0], ys[0])
        if not (src.bounds.left <= point[0] <= src.bounds.right and src.bounds.bottom <= point[1] <= src.bounds.top):
            return None
        value = float(next(src.sample([point]))[0])
    if not np.isfinite(value):
        return None, "No data"
    label = None
    colormap = raster_layer.colormap or {}
    if colormap.get("type") in ("categorical", "binary"):
        entry = colormap.get("entries", {}).get(str(int(round(value))))
        label = entry["label"] if entry else None
    return value, label
