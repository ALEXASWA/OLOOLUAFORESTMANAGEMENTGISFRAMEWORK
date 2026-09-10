from django.contrib.gis.db import models
from apps.forests.models import Forest
from apps.management.models import ManagementZone

class MonitoringRecord(models.Model):
    forest = models.ForeignKey(Forest, on_delete=models.CASCADE, related_name="monitoring_records")
    zone = models.ForeignKey(ManagementZone, on_delete=models.SET_NULL, null=True, blank=True, related_name="monitoring_records")
    indicator_name = models.CharField(max_length=150)
    observation_date = models.DateField()
    value = models.FloatField(null=True, blank=True)
    unit = models.CharField(max_length=50, blank=True)
    trend = models.CharField(max_length=50, blank=True)
    management_effectiveness = models.CharField(max_length=50, blank=True)
    source = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    class Meta:
        indexes = [models.Index(fields=["forest","observation_date"])]
