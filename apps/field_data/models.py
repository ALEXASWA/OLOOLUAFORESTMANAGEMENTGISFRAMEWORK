from django.contrib.gis.db import models
from django.contrib.auth.models import User
from apps.forests.models import Forest

class FieldObservation(models.Model):
    forest = models.ForeignKey(Forest, on_delete=models.CASCADE, related_name="field_observations")
    observation_type = models.CharField(max_length=100)
    observed_at = models.DateTimeField()
    observer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    description = models.TextField(blank=True)
    severity = models.CharField(max_length=30, blank=True)
    photo = models.ImageField(upload_to="field_observations/", blank=True, null=True)
    geometry = models.PointField(srid=4326)
    source = models.CharField(max_length=255, blank=True)
    class Meta:
        indexes = [models.Index(fields=["forest","observed_at"])]
