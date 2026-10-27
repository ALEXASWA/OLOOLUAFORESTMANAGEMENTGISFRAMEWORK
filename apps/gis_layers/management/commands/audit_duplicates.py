from django.core.management.base import BaseCommand
from django.db.models import Count

from apps.gis_layers.models import MapProduct, RasterLayer
from apps.training_data.models import LULCTrainingDataset


class Command(BaseCommand):
    help = "Report duplicate catalogue inputs without deleting data."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Reserved for a reviewed merge policy; never deletes by default.")

    def handle(self, *args, **options):
        groups = {
            "map_products": MapProduct.objects.values("forest_id", "file_path").annotate(total=Count("id")).filter(total__gt=1),
            "raster_layers": RasterLayer.objects.values("forest_id", "slug", "version").annotate(total=Count("id")).filter(total__gt=1),
            "training_datasets": LULCTrainingDataset.objects.values("forest_id", "source_hash").annotate(total=Count("id")).filter(total__gt=1),
        }
        found = 0
        for name, queryset in groups.items():
            rows = list(queryset)
            found += len(rows)
            self.stdout.write(f"{name}: {len(rows)} duplicate groups")
        if options["apply"]:
            self.stdout.write(self.style.WARNING("No records changed. Review groups and implement an explicit merge policy first."))
        elif found:
            self.stdout.write(self.style.WARNING("Dry run only: no records changed."))