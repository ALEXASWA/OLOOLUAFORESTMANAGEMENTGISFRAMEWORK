from django.db import models
from apps.forests.models import Forest
from apps.gis_layers.models import RasterLayer

class LULCClass(models.Model):
    forest = models.ForeignKey(Forest, on_delete=models.CASCADE, related_name="lulc_classes")
    code = models.PositiveIntegerField()
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    display_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["forest","code"], name="uniq_lulc_class_code")]
        ordering = ["display_order","code"]
    def __str__(self):
        return f"{self.code} - {self.name}"

class LULCMap(models.Model):
    forest = models.ForeignKey(Forest, on_delete=models.CASCADE, related_name="lulc_maps")
    year = models.PositiveIntegerField()
    raster = models.ForeignKey(RasterLayer, on_delete=models.SET_NULL, null=True, blank=True, related_name="lulc_maps")
    source = models.CharField(max_length=255, blank=True)
    acquisition_period = models.CharField(max_length=100, blank=True)
    processing_date = models.DateField(null=True, blank=True)
    resolution_m = models.FloatField(null=True, blank=True)
    classification_method = models.CharField(max_length=255, blank=True)
    accuracy = models.FloatField(null=True, blank=True)
    notes = models.TextField(blank=True)
    version = models.CharField(max_length=50, default="1")
    class Meta:
        constraints = [models.UniqueConstraint(fields=["forest","year","version"], name="uniq_lulc_map_version")]
        indexes = [models.Index(fields=["forest","year"])]

class LULCStatistic(models.Model):
    lulc_map = models.ForeignKey(LULCMap, on_delete=models.CASCADE, related_name="statistics")
    lulc_class = models.ForeignKey(LULCClass, on_delete=models.CASCADE, related_name="statistics")
    area_ha = models.FloatField()
    percentage = models.FloatField()
    pixel_count = models.BigIntegerField(null=True, blank=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["lulc_map","lulc_class"], name="uniq_lulc_stat")]
        indexes = [models.Index(fields=["lulc_map","lulc_class"])]

class LULCTransition(models.Model):
    forest = models.ForeignKey(Forest, on_delete=models.CASCADE, related_name="lulc_transitions")
    from_year = models.PositiveIntegerField()
    to_year = models.PositiveIntegerField()
    from_class = models.ForeignKey(LULCClass, on_delete=models.CASCADE, related_name="+")
    to_class = models.ForeignKey(LULCClass, on_delete=models.CASCADE, related_name="+")
    area_ha = models.FloatField()
    percentage = models.FloatField()
    class Meta:
        indexes = [models.Index(fields=["forest","from_year","to_year"])]

class ClassificationAccuracy(models.Model):
    forest = models.ForeignKey(Forest, on_delete=models.CASCADE, related_name="classification_accuracies")
    year = models.PositiveIntegerField()
    overall_accuracy = models.FloatField(null=True, blank=True)
    kappa = models.FloatField(null=True, blank=True)
    method = models.CharField(max_length=255, blank=True)
    sample_size = models.PositiveIntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)
