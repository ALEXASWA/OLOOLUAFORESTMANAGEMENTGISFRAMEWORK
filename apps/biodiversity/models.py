from django.contrib.gis.db import models
from apps.forests.models import Forest

class TreeSpeciesObservation(models.Model):
    forest = models.ForeignKey(Forest, on_delete=models.CASCADE, related_name="tree_species_observations")
    species_name = models.CharField(max_length=150)
    scientific_name = models.CharField(max_length=180, blank=True)
    stand_type = models.CharField(max_length=100, blank=True)
    natural_or_planted = models.CharField(max_length=30, blank=True)
    observed_at = models.DateField(null=True, blank=True)
    observer = models.CharField(max_length=200, blank=True)
    confidence = models.FloatField(null=True, blank=True)
    photo = models.ImageField(upload_to="species/", blank=True, null=True)
    geometry = models.PointField(srid=4326)
    source = models.CharField(max_length=255, blank=True)

class InvasiveSpeciesObservation(models.Model):
    forest = models.ForeignKey(Forest, on_delete=models.CASCADE, related_name="invasive_observations")
    species = models.CharField(max_length=150)
    observed_at = models.DateField(null=True, blank=True)
    abundance = models.FloatField(null=True, blank=True)
    severity = models.CharField(max_length=30, blank=True)
    observer = models.CharField(max_length=200, blank=True)
    source = models.CharField(max_length=255, blank=True)
    photo = models.ImageField(upload_to="invasive_species/", blank=True, null=True)
    geometry = models.PointField(srid=4326)
