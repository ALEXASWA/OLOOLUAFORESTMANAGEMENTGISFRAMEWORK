import re
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.forests.models import Forest
from apps.gis_layers.models import MapProduct


PRODUCT_SPECS = {
    "lulc1990": {
        "title": "LULC 1990",
        "category": "Land cover",
        "year": 1990,
        "description": "Forest dominates the central and western area, with grassland gaps, a fragmented north-west neck and a broad south-east grassland lobe.",
    },
    "lluc 2000": {
        "title": "LULC 2000",
        "category": "Land cover",
        "year": 2000,
        "description": "Central forest becomes more continuous, with a prominent south-east grassland lobe and narrow built-up strips along the north-west, west and south margins.",
    },
    "lulc 2010": {
        "title": "LULC 2010",
        "category": "Land cover",
        "year": 2010,
        "description": "Central forest remains largely continuous as built-up area grows around the north neck and west/south margins; the south-east lobe is mostly grassland.",
    },
    "lulc 2020": {
        "title": "LULC 2020",
        "category": "Land cover",
        "year": 2020,
        "description": "Built-up area expands and a diagonal linear feature runs central-west to south-east; grassland increases in the north and quarry pixels follow the corridor.",
    },
    "lulc 2025": {
        "title": "LULC 2025",
        "category": "Land cover",
        "year": 2025,
        "description": "Sentinel-2 10 m classification shows dominant forest and more continuous built-up along the perimeter and southward linear features.",
    },
    "densitymap": {
        "title": "Forest Density 2025",
        "category": "Forest structure",
        "year": 2025,
        "description": "Density is highest in the forest interior and declines toward the margins, with a wider low-density ring in the south-east lobe and north-west neck.",
    },
    "fragmentation": {
        "title": "Forest Fragmentation",
        "category": "Forest structure",
        "description": "Fragmentation is lowest in the interior and higher along the margins and narrow sections, including the south-east lobe and north-west neck.",
    },
    "humanpressure": {
        "title": "Human Pressure",
        "category": "Pressure",
        "description": "Pressure is very low in the interior and high to very high along central and south-east corridors and the south-west/south margins; white gaps are no-data.",
    },
    "managementzones": {
        "title": "Management Zones",
        "category": "Management",
        "description": "Five rule-based zones, from core conservation through rehabilitation and human-pressure management to sustainable use, assigned by precedence.",
    },
    "rehabilitation map": {
        "title": "Rehabilitation Priority",
        "category": "Management",
        "description": "Priority is lowest in the intact interior and highest along the perimeter, corridors and south-west/south margins, with moderate blocks to the east, south-east and north.",
    },
    "methodology": {
        "title": "Methodology",
        "category": "Documentation",
        "description": "Workflow and analytical methods used to produce the Oloolua LULC, structure, pressure, priority and management-zone products.",
    },
    "olooluamaps": {
        "title": "Oloolua QGIS Project",
        "category": "QGIS project",
        "description": "QGIS project file for the registered Oloolua map series.",
    },
}


class Command(BaseCommand):
    help = "Register supplied PNG, JPG, PDF, and QGIS map products without treating images as GIS rasters."

    def add_arguments(self, parser):
        parser.add_argument("--forest", default="oloolua")
        parser.add_argument("--root", required=True, help="Directory containing exported map products.")
        parser.add_argument(
            "--prune",
            action="store_true",
            help="Remove registered product records whose source file no longer exists.",
        )

    def handle(self, *args, **options):
        forest = Forest.objects.filter(code=options["forest"]).first()
        if not forest:
            raise CommandError(f"Forest code not found: {options['forest']}")
        root = Path(options["root"])
        if not root.is_dir():
            raise CommandError(f"Map product directory does not exist: {root}")

        allowed = {".jpg", ".jpeg", ".png", ".pdf", ".qgz"}
        registered = 0
        for path in sorted(root.rglob("*")):
            if not path.is_file() or "thumbnails" in path.parts or path.suffix.lower() not in allowed:
                continue
            product_type = "qgis" if path.suffix.lower() == ".qgz" else "pdf" if path.suffix.lower() == ".pdf" else "image"
            spec = self._spec(path.stem)
            year = spec.get("year")
            if year is None and product_type == "image":
                year_match = re.search(r"(?<!\d)(19|20)\d{2}(?!\d)", path.stem)
                year = int(year_match.group(0)) if year_match else None
            MapProduct.objects.update_or_create(
                forest=forest,
                file_path=str(path.resolve()),
                defaults={
                    "title": spec.get("title") or self._title(path.stem),
                    "category": spec.get("category") or ("QGIS project" if product_type == "qgis" else "Research map"),
                    "year": year,
                    "product_type": product_type,
                    "source": "Supplied Oloolua research map product",
                    "description": spec.get("description") or "Exported Oloolua research product; the image is not presented as a georeferenced GIS raster.",
                    "publication_status": "public",
                },
            )
            registered += 1

        pruned = self._prune(forest) if options["prune"] else 0
        message = f"Registered {registered} map products from {root}."
        if options["prune"]:
            message += f" Pruned {pruned} stale catalogue records."
        self.stdout.write(self.style.SUCCESS(message))

    def _prune(self, forest):
        pruned = 0
        for product in MapProduct.objects.filter(forest=forest):
            path = Path(product.file_path)
            if not path.is_file() or "thumbnails" in path.parts:
                product.delete()
                pruned += 1
        return pruned

    def _spec(self, stem):
        key = " ".join(stem.lower().replace("_", " ").split())
        return PRODUCT_SPECS.get(key, {})

    def _title(self, stem):
        return re.sub(r"[_-]+", " ", stem).strip().title()
