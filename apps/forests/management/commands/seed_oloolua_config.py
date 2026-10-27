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
                "methodology_version": "oloolua-gee-v1.0",
                "methodology_source": "Google Earth Engine Oloolua Sustainable Forest Ecosystem Analysis",
                "historical_sensor": "Landsat historical composites",
                "current_sensor": "Sentinel-2 SR Harmonized",
                "historical_scale_m": 30,
                "current_scale_m": 10,
                "derived_scale_m": 30,
                "training_fraction": 0.70,
                "validation_fraction": 0.30,
                "validation_method": "Polygon-level random split; reference polygons, not historical field observations",
                "random_seed": 42,
                "class_schema": {"1": "Forest", "2": "Grassland", "3": "Quarry", "4": "Built-up"},
                "methodology": {
                    "buffer_distance_m": 100,
                    "water_class": "excluded",
                    "ndvi_interpretation": "vegetation condition indicator, not a direct health measure",
                    "human_pressure_interpretation": "remotely detectable spatial proxy, not proof of causation",
                    "management_zone_status": "proposed analytical decision-support zones",
                    "epochs": [1990, 2000, 2010, 2020, 2025],
                    "derived_products": [
                        "LULC transitions", "forest loss/gain", "built-up/quarry expansion",
                        "NDVI condition and change", "forest density", "fragmentation", "edge/core",
                        "human pressure", "conservation priority", "rehabilitation priority", "management zones",
                    ],
                },
            },
        )
        classes = [(1,"Forest"),(2,"Grassland"),(3,"Quarry"),(4,"Built-up")]
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
