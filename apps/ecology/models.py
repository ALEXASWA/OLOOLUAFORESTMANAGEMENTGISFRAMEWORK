from django.db import models
from apps.forests.models import Forest
from apps.gis_layers.models import RasterLayer

class Indicator(models.Model):
    DATA_STATUS = [("observed","Observed"),("derived","Derived"),("modelled","Modelled"),("proposed","Proposed"),("future","Future")]
    forest = models.ForeignKey(Forest, on_delete=models.CASCADE, related_name="indicators")
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=180)
    status = models.CharField(max_length=20, choices=DATA_STATUS, default="derived")
    unit = models.CharField(max_length=50, blank=True)
    weight = models.FloatField(default=1.0)
    description = models.TextField(blank=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["forest","slug"], name="uniq_indicator")]
    def __str__(self): return self.name

class IndicatorProduct(models.Model):
    indicator = models.ForeignKey(Indicator, on_delete=models.CASCADE, related_name="products")
    raster = models.ForeignKey(RasterLayer, on_delete=models.SET_NULL, null=True, blank=True)
    year = models.PositiveIntegerField(null=True, blank=True)
    value_summary = models.JSONField(default=dict, blank=True)
    version = models.CharField(max_length=50, default="1")
    processing_method = models.TextField(blank=True)
    source = models.CharField(max_length=255, blank=True)
