from django.core.management.base import BaseCommand, CommandError
from django.contrib.gis.geos import MultiPolygon

from apps.forests.models import Forest


class Command(BaseCommand):
    help = "Generate or refresh a forest's external analytical buffer."

    def add_arguments(self, parser):
        parser.add_argument("forest_code")
        parser.add_argument("--distance", type=int, help="Override the forest buffer distance in metres.")

    def handle(self, *args, **options):
        forest = Forest.objects.filter(code=options["forest_code"]).first()
        if not forest:
            raise CommandError(f"Forest code not found: {options['forest_code']}")
        if not forest.geometry:
            raise CommandError("Cannot generate an analytical buffer until the original boundary exists.")

        if options["distance"] is not None:
            if options["distance"] <= 0:
                raise CommandError("Buffer distance must be greater than zero.")
            forest.buffer_distance_m = options["distance"]

        buffer_geometry = forest.geometry.buffer(forest.buffer_distance_m)
        if buffer_geometry.geom_type == "Polygon":
            buffer_geometry = MultiPolygon(buffer_geometry)
        forest.analytical_buffer = buffer_geometry
        forest.save(update_fields=["buffer_distance_m", "analytical_buffer", "updated_at"])
        self.stdout.write(
            self.style.SUCCESS(
                f"Generated {forest.buffer_distance_m} m external analytical buffer for {forest.name}."
            )
        )
