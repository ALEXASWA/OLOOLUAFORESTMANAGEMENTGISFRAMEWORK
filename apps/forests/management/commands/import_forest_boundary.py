from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.contrib.gis.gdal import DataSource
from django.contrib.gis.geos import GEOSGeometry, MultiPolygon
from apps.forests.models import Forest, ForestBoundary

class Command(BaseCommand):
    help = "Import a real polygon boundary into an existing forest."

    def add_arguments(self, parser):
        parser.add_argument("forest_code")
        parser.add_argument("path")
        parser.add_argument("--source", default="Imported research dataset")

    def handle(self, *args, **opts):
        forest = Forest.objects.filter(code=opts["forest_code"]).first()
        if not forest:
            raise CommandError("Forest code not found. Run seed_oloolua_config first or create the forest in admin.")
        path = Path(opts["path"])
        if not path.exists():
            raise CommandError(f"File not found: {path}")
        ds = DataSource(str(path))
        if len(ds) == 0:
            raise CommandError("No vector layers found.")
        layer = ds[0]
        geoms = [GEOSGeometry(feat.geom.wkt) for feat in layer]
        if not geoms:
            raise CommandError("No features found.")
        geom = geoms[0] if len(geoms) == 1 else geoms[0].union(geoms[1])
        for g in geoms[2:]:
            geom = geom.union(g)
        if geom.geom_type == "Polygon":
            geom = MultiPolygon(geom)
        if layer.srs:
            geom.srid = layer.srs.srid or 4326
            geom.transform(32737)
        else:
            raise CommandError("Input has no CRS. Define the source CRS before importing.")
        forest.geometry = geom
        forest.area_ha = geom.area / 10000.0
        forest.save(update_fields=["geometry","area_ha","updated_at"])
        ForestBoundary.objects.update_or_create(
            forest=forest,
            defaults={"geometry":geom,"source":opts["source"]},
        )
        self.stdout.write(self.style.SUCCESS(f"Imported boundary: {forest.name}, {forest.area_ha:.2f} ha"))
