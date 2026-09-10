from django.contrib.gis.db import models
from apps.forests.models import Forest

class RasterLayer(models.Model):
    KIND = [("lulc","LULC"),("change","Change"),("ecology","Ecology"),("threat","Threat"),("management","Management")]
    forest = models.ForeignKey(Forest, on_delete=models.CASCADE, related_name="raster_layers")
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220)
    kind = models.CharField(max_length=30, choices=KIND)
    year = models.PositiveIntegerField(null=True, blank=True)
    file_path = models.CharField(max_length=1000)
    source = models.CharField(max_length=255, blank=True)
    sensor = models.CharField(max_length=100, blank=True)
    resolution_m = models.FloatField(null=True, blank=True)
    crs = models.CharField(max_length=40, blank=True)
    processing_method = models.TextField(blank=True)
    classification_method = models.CharField(max_length=255, blank=True)
    accuracy = models.FloatField(null=True, blank=True)
    processing_date = models.DateField(null=True, blank=True)
    version = models.CharField(max_length=50, default="1")
    analyst = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    limitations = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["forest","slug","version"], name="uniq_raster_layer_version")]
        indexes = [models.Index(fields=["forest","year"]), models.Index(fields=["kind"])]

    def __str__(self):
        return self.name

class VectorLayer(models.Model):
    forest = models.ForeignKey(Forest, on_delete=models.CASCADE, related_name="vector_layers")
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220)
    source = models.CharField(max_length=255, blank=True)
    geometry = models.GeometryField(srid=32737)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["forest"])]
