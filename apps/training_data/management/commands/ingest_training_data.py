import hashlib
import json
from pathlib import Path

from django.contrib.gis.geos import GEOSGeometry
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.forests.models import Forest
from apps.lulc.models import LULCClass
from apps.training_data.models import LULCTrainingDataset, LULCTrainingSample


CLASS_NAMES = {1: "Forest", 2: "Grassland", 3: "Quarry", 4: "Built-up"}
SUPPORTED_SUFFIXES = {".geojson", ".json"}


class Command(BaseCommand):
    help = "Validate and idempotently import GeoJSON LULC training/reference data."

    def add_arguments(self, parser):
        parser.add_argument("--forest", required=True, help="Forest code, for example oloolua.")
        parser.add_argument("--path", required=True, help="A GeoJSON file or directory containing GeoJSON files.")

    def handle(self, *args, **options):
        forest = Forest.objects.filter(code=options["forest"]).first()
        if not forest:
            raise CommandError(f"Forest code not found: {options['forest']}")

        source = Path(options["path"])
        files = self._discover(source)
        if not files:
            raise CommandError(f"No supported GeoJSON files found under {source}")

        imported = 0
        skipped = 0
        for path in files:
            result = self._ingest_file(forest, path)
            if result == "skipped":
                skipped += 1
            else:
                imported += 1

        self.stdout.write(self.style.SUCCESS(f"Training import complete: {imported} imported, {skipped} already registered."))

    def _discover(self, source):
        if source.is_file():
            return [source] if source.suffix.lower() in SUPPORTED_SUFFIXES else []
        if not source.is_dir():
            raise CommandError(f"Training source does not exist: {source}")
        return sorted(path for path in source.rglob("*") if path.is_file() and path.suffix.lower() in SUPPORTED_SUFFIXES)

    def _ingest_file(self, forest, path):
        raw = path.read_bytes()
        source_hash = hashlib.sha256(raw).hexdigest()
        existing = LULCTrainingDataset.objects.filter(forest=forest, source_hash=source_hash).first()
        if existing:
            self._normalize_existing_dataset(existing)
            self.stdout.write(f"SKIP {path.name}: source hash already registered")
            return "skipped"

        try:
            document = json.loads(raw.decode("utf-8-sig"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise CommandError(f"{path}: unreadable GeoJSON ({exc})") from exc
        if document.get("type") != "FeatureCollection":
            raise CommandError(f"{path}: expected a GeoJSON FeatureCollection")

        features = document.get("features", [])
        if not features:
            raise CommandError(f"{path}: no features found")

        dataset_type = self._dataset_type(features)
        first_properties = features[0].get("properties") or {}
        class_field = "Class" if "Class" in first_properties else "class"
        if class_field not in first_properties:
            raise CommandError(f"{path}: class field 'Class' was not found")

        validation = {"file_readable": True, "crs_detected": True, "geometry_valid": True,
                      "class_field_detected": True, "recognized_classes": True,
                      "duplicate_geometries": False, "empty_geometries": False,
                      "samples_intersect_forest": None, "errors": []}
        prepared = []
        geometry_hashes = set()
        counts = {"REFERENCE": 0, "TRAINING": 0, "VALIDATION": 0}

        for index, feature in enumerate(features, start=1):
            properties = feature.get("properties") or {}
            value = properties.get(class_field)
            try:
                class_id = int(value)
            except (TypeError, ValueError):
                validation["errors"].append(f"feature {index}: null or non-numeric class")
                continue
            if class_id not in CLASS_NAMES:
                validation["recognized_classes"] = False
                validation["errors"].append(f"feature {index}: unsupported class {class_id}")
                continue
            geometry_data = feature.get("geometry")
            if not geometry_data:
                validation["empty_geometries"] = True
                validation["errors"].append(f"feature {index}: empty geometry")
                continue
            try:
                geometry = GEOSGeometry(json.dumps(geometry_data), srid=4326)
                if geometry.empty:
                    validation["empty_geometries"] = True
                    validation["errors"].append(f"feature {index}: empty geometry")
                    continue
                if not geometry.valid:
                    validation["geometry_valid"] = False
                    validation["errors"].append(f"feature {index}: invalid geometry")
                    continue
                geometry.transform(32737)
            except Exception as exc:
                validation["geometry_valid"] = False
                validation["errors"].append(f"feature {index}: geometry conversion failed ({exc})")
                continue

            geometry_hash = geometry.wkb.hex()
            if geometry_hash in geometry_hashes:
                validation["duplicate_geometries"] = True
                validation["errors"].append(f"feature {index}: duplicate geometry")
            else:
                geometry_hashes.add(geometry_hash)
            if forest.geometry:
                intersects = geometry.intersects(forest.geometry)
                validation["samples_intersect_forest"] = True if validation["samples_intersect_forest"] is not False and intersects else False
            split = dataset_type
            counts[split] += 1
            prepared.append((feature, properties, class_id, split, geometry))

        blocking_errors = [error for error in validation["errors"] if "duplicate geometry" not in error]
        if blocking_errors:
            validation["status"] = "REQUIRES REVIEW"
            raise CommandError(f"{path}: validation failed: " + "; ".join(blocking_errors[:8]))
        validation["status"] = "READY"

        dataset_name = first_properties.get("dataset_name", path.stem)
        version = first_properties.get("dataset_version", "v1")
        epochs = sorted({year for feature, _, _, _, _ in prepared for year in [
            feature.get("properties", {}).get("analysis_start"),
            feature.get("properties", {}).get("analysis_end")
        ] if year})
        random_seed = first_properties.get("random_seed")
        split_ratio = first_properties.get("split_ratio", "")
        fractions = self._fractions(split_ratio, dataset_type)

        with transaction.atomic():
            dataset = LULCTrainingDataset.objects.create(
                forest=forest, name=dataset_name, version=version, source_file=str(path),
                source_hash=source_hash, source_type="GeoJSON", reference_year=first_properties.get("analysis_end"),
                classification_epochs=epochs, crs="EPSG:4326", class_field=class_field,
                class_schema=CLASS_NAMES, sample_count=len(prepared), training_count=counts["TRAINING"],
                validation_count=counts["VALIDATION"], random_seed=random_seed,
                training_fraction=fractions[0], validation_fraction=fractions[1],
                methodology="Polygon-level split preserved from source metadata.", dataset_type=dataset_type,
                status="ready", validation_report=validation,
            )
            for feature, properties, class_id, split, geometry in prepared:
                LULCTrainingSample.objects.create(
                    forest=forest, dataset=dataset, sample_id=str(feature.get("id", "")),
                    class_id=class_id, class_name=CLASS_NAMES[class_id], split=split,
                    source=str(path), metadata=properties, geometry=geometry,
                )
                LULCClass.objects.get_or_create(
                    forest=forest, code=class_id,
                    defaults={"name": CLASS_NAMES[class_id], "display_order": class_id},
                )

        self.stdout.write(self.style.SUCCESS(f"READY {path.name}: {len(prepared)} samples, {dataset_type}"))
        return "imported"

    def _normalize_existing_dataset(self, dataset):
        if dataset.dataset_type == "REFERENCE" and "training" in dataset.source_file.lower():
            updated = dataset.samples.update(split="TRAINING")
            dataset.dataset_type = "TRAINING"
            dataset.training_count = updated
            dataset.validation_count = 0
            dataset.save(update_fields=["dataset_type", "training_count", "validation_count"])

    def _dataset_type(self, features):
        values = {str((feature.get("properties") or {}).get("dataset_type", "REFERENCE")).upper() for feature in features}
        dataset_type = next(iter(values), "REFERENCE")
        if len(values) != 1 or dataset_type not in {"REFERENCE", "TRAINING", "VALIDATION"}:
            raise CommandError("Dataset type must consistently be REFERENCE, TRAINING, or VALIDATION")
        return dataset_type

    def _fractions(self, split_ratio, dataset_type):
        if split_ratio == "70/30":
            return (0.7, 0.3)
        return (1.0, 0.0) if dataset_type != "VALIDATION" else (0.0, 1.0)
