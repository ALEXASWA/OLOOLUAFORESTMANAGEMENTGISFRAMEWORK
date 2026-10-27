import hashlib
import warnings
from pathlib import Path

import numpy as np
import rasterio
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.forests.models import Forest
from apps.gis_layers.models import RasterLayer
from apps.gis_layers.raster_service import build_colormap

KIND_RULES = [
    ("lulc", "lulc"),
    ("forest-loss", "change"),
    ("forest-gain", "change"),
    ("persistent-forest", "change"),
    ("builtup-expansion", "change"),
    ("quarry-expansion", "change"),
    ("ndvi", "ecology"),
    ("forest-density", "ecology"),
    ("forest-fragmentation", "ecology"),
    ("forest-core", "ecology"),
    ("forest-edge", "ecology"),
    ("human-pressure", "threat"),
    ("conservation-priority", "management"),
    ("rehabilitation-priority", "management"),
    ("management-zones", "management"),
]


class Command(BaseCommand):
    help = (
        "Idempotently register GeoTIFF exports with full metadata (checksum, CRS, "
        "transform, pixel size, bounds, nodata, class values) and display colormaps. "
        "Source files are opened read-only and never modified."
    )

    def add_arguments(self, parser):
        parser.add_argument("--forest", default="oloolua")
        parser.add_argument("--dir", required=True, dest="directory", help="Directory containing GeoTIFF exports.")
        parser.add_argument("--dry-run", action="store_true", help="Report what would be imported without writing.")
        parser.add_argument("--max-size-mb", type=int, default=256, help="Skip rasters larger than this many MB.")

    def handle(self, *args, **options):
        forest = Forest.objects.filter(code=options["forest"]).first()
        if not forest:
            raise CommandError(f"Forest code not found: {options['forest']}")
        directory = Path(options["directory"])
        if not directory.is_dir():
            raise CommandError(f"Export directory does not exist: {directory}")

        files = sorted(path for path in directory.glob("*.tif") if path.is_file())
        if not files:
            raise CommandError(f"No GeoTIFF files found in {directory}")

        classes = {cls.code: cls.name for cls in forest.lulc_classes.all()}
        reports = []
        skipped = []
        for path in files:
            size_mb = path.stat().st_size / (1024 * 1024)
            if size_mb > options["max_size_mb"]:
                skipped.append(f"{path.name} ({size_mb:.0f} MB exceeds --max-size-mb={options['max_size_mb']})")
                continue
            try:
                reports.append(self._inspect(path, classes))
            except Exception as exc:  # unreadable raster should not abort the rest
                skipped.append(f"{path.name} (unreadable: {exc})")

        for line in skipped:
            self.stdout.write(self.style.WARNING(f"Skipped {line}"))

        if options["dry_run"]:
            self._report_dry_run(reports)
            return

        with transaction.atomic():
            for report in reports:
                self._register(forest, report)

        self.stdout.write(self.style.SUCCESS(
            f"Registered/updated {len(reports)} rasters for {forest.code} "
            f"({'dry-run only' if options['dry_run'] else 'written'})."
        ))

    def _inspect(self, path, classes):
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with rasterio.open(path) as src:
                array = src.read(1)
                meta = {
                    "path": path,
                    "slug": path.stem.lower().replace("_", "-"),
                    "checksum": hashlib.sha256(path.read_bytes()).hexdigest(),
                    "width": src.width,
                    "height": src.height,
                    "band_count": src.count,
                    "dtype": src.dtypes[0],
                    "nodata": src.nodata,
                    "crs": f"EPSG:{src.crs.to_epsg()}" if src.crs and src.crs.to_epsg() else str(src.crs),
                    "bounds": [src.bounds.left, src.bounds.bottom, src.bounds.right, src.bounds.top],
                    "transform": list(src.transform),
                    "pixel_size_x": abs(src.transform.a),
                    "pixel_size_y": abs(src.transform.e),
                }
        if np.issubdtype(array.dtype, np.floating):
            finite = array[np.isfinite(array)]
            meta["data_type"] = "continuous"
            meta["vmin"] = float(finite.min()) if finite.size else 0.0
            meta["vmax"] = float(finite.max()) if finite.size else 1.0
            meta["unique_values"] = []
        else:
            values = sorted(int(v) for v in np.unique(array))
            meta["unique_values"] = values
            meta["data_type"] = "binary" if set(values) <= {0, 1} else "categorical"
            meta["vmin"] = meta["vmax"] = None
        meta["kind"] = self._kind_for(meta["slug"])
        meta["year"] = self._year_for(meta["slug"])
        meta["data_status"] = self._status_for(meta["slug"], meta["kind"])
        meta["colormap"] = build_colormap(
            meta["slug"], meta["data_type"], classes=classes, vmin=meta["vmin"], vmax=meta["vmax"]
        )
        return meta

    def _register(self, forest, meta):
        path = meta["path"]
        RasterLayer.objects.update_or_create(
            forest=forest,
            slug=meta["slug"],
            version="gee-v1",
            defaults={
                "name": path.stem.replace("_", " "),
                "kind": meta["kind"],
                "year": meta["year"],
                "file_path": str(path),
                "source": "Google Earth Engine export",
                "resolution_m": meta["pixel_size_x"],
                "crs": meta["crs"],
                "processing_method": "Supplied Oloolua Sustainable Forest Ecosystem Analysis (GEE export)",
                "description": "Real exported GeoTIFF referenced by FM-GDSS; not recreated or fabricated.",
                "data_type": meta["data_type"],
                "data_status": meta["data_status"],
                "colormap": meta["colormap"],
                "checksum": meta["checksum"],
                "width": meta["width"],
                "height": meta["height"],
                "band_count": meta["band_count"],
                "dtype": meta["dtype"],
                "nodata": meta["nodata"],
                "bounds": meta["bounds"],
                "transform": meta["transform"],
                "pixel_size_x": meta["pixel_size_x"],
                "pixel_size_y": meta["pixel_size_y"],
                "imported_at": timezone.now(),
                "active": True,
            },
        )

    def _report_dry_run(self, reports):
        self.stdout.write("DRY RUN — no records written:")
        for meta in reports:
            self.stdout.write(
                f"  {meta['path'].name}: kind={meta['kind']} type={meta['data_type']} "
                f"year={meta['year']} crs={meta['crs']} {meta['width']}x{meta['height']} "
                f"dtype={meta['dtype']} status={meta['data_status']}"
            )

    @staticmethod
    def _kind_for(slug):
        for marker, kind in KIND_RULES:
            if marker in slug:
                return kind
        return "ecology"

    @staticmethod
    def _year_for(slug):
        tokens = [token for token in slug.split("-") if len(token) == 4 and token.isdigit()]
        return int(tokens[0]) if len(tokens) == 1 else None

    @staticmethod
    def _status_for(slug, kind):
        if "priority" in slug or "management-zones" in slug:
            return "proposed"
        if kind == "lulc":
            return "observed"
        return "derived"
