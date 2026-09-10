from django.core.management.base import BaseCommand
from apps.forests.models import Forest, ForestProfile
from apps.lulc.models import LULCClass
from apps.management.models import ManagementZoneType
from apps.threats.models import PressureConfiguration

class Command(BaseCommand):
    help = "Create the Oloolua Forest configuration only. Does not create a boundary or research results."

    def handle(self, *args, **kwargs):
        forest, created = Forest.objects.get_or_create(
            code="oloolua",
            defaults={
                "name": "Oloolua Forest",
                "country": "Kenya",
                "county": "Nairobi Metropolitan Area",
                "description": "Initial FGMDSS case-study configuration. Boundary and analytical products must be imported from supplied research outputs.",
            },
        )
        ForestProfile.objects.update_or_create(
            forest=forest,
            defaults={
                "classification_scheme": "Oloolua configurable LULC scheme",
                "analysis_resolution": 30,
                "default_year": 2025,
                "historical_years": [1990,2000,2010,2020,2025],
                "crs": "EPSG:32737",
            },
        )
        classes = [(1,"Forest"),(2,"Grassland"),(3,"Quarry"),(4,"Built-up"),(5,"Water")]
        for code,name in classes:
            LULCClass.objects.get_or_create(forest=forest, code=code, defaults={"name":name,"display_order":code})
        zones = [
            ("core-conservation","Core Conservation Priority"),
            ("buffer-conservation","Conservation / Buffer Priority"),
            ("ecological-recovery","Ecological Recovery / Rehabilitation Priority"),
            ("human-pressure","Human-Pressure Management Priority"),
            ("sustainable-use","Sustainable Use / Monitoring Priority"),
        ]
        for code,name in zones:
            ManagementZoneType.objects.get_or_create(forest=forest, code=code, defaults={"name":name})
        PressureConfiguration.objects.get_or_create(
            forest=forest,
            defaults={
                "weights":{"forest_loss":0.30,"built_up_proximity":0.25,"quarry_proximity":0.20,"fragmentation":0.15,"vegetation_decline":0.10},
                "thresholds":{"low":0.25,"moderate":0.50,"high":0.75},
            },
        )
        self.stdout.write(self.style.SUCCESS(
            f"Oloolua configuration {'created' if created else 'already existed'}. No fake spatial/research data were created."
        ))
