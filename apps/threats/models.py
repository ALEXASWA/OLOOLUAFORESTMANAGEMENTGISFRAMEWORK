from django.contrib.gis.db import models
from apps.forests.models import Forest

class Threat(models.Model):
    forest = models.ForeignKey(Forest, on_delete=models.CASCADE, related_name="threats")
    name = models.CharField(max_length=150)
    threat_type = models.CharField(max_length=80)
    status = models.CharField(max_length=30, default="active")
    severity = models.CharField(max_length=30, blank=True)
    geometry = models.GeometryField(srid=32737, null=True, blank=True)
    description = models.TextField(blank=True)
    source = models.CharField(max_length=255, blank=True)
    class Meta:
        indexes = [models.Index(fields=["forest","threat_type"])]

class PressureConfiguration(models.Model):
    forest = models.OneToOneField(Forest, on_delete=models.CASCADE, related_name="pressure_config")
    weights = models.JSONField(default=dict)
    thresholds = models.JSONField(default=dict)
    normalization_method = models.CharField(max_length=100, default="minmax_0_1")
    notes = models.TextField(blank=True)
