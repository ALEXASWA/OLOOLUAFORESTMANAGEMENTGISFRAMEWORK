from django.contrib.gis.db import models

class Forest(models.Model):
    STATUS = [("active", "Active"), ("inactive", "Inactive"), ("draft", "Draft")]
    name = models.CharField(max_length=200)
    code = models.SlugField(max_length=80, unique=True)
    country = models.CharField(max_length=100, blank=True)
    county = models.CharField(max_length=100, blank=True)
    sub_county = models.CharField(max_length=100, blank=True)
    management_authority = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    area_ha = models.FloatField(null=True, blank=True)
    buffer_distance_m = models.PositiveIntegerField(default=100)
    status = models.CharField(max_length=20, choices=STATUS, default="active")
    geometry = models.MultiPolygonField(srid=32737, null=True, blank=True)
    analytical_buffer = models.MultiPolygonField(srid=32737, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["code"]), models.Index(fields=["status"])]

    def __str__(self):
        return f"{self.name} ({self.code})"

    def save(self, *args, **kwargs):
        if self.geometry and self.area_ha is None:
            try:
                self.area_ha = self.geometry.transform(32737, clone=True).area / 10000.0
            except Exception:
                pass
        super().save(*args, **kwargs)

class ForestProfile(models.Model):
    forest = models.OneToOneField(Forest, on_delete=models.CASCADE, related_name="profile")
    classification_scheme = models.CharField(max_length=120, default="Configurable")
    analysis_resolution = models.PositiveIntegerField(default=30)
    default_year = models.PositiveIntegerField(default=2025)
    historical_years = models.JSONField(default=list, blank=True)
    crs = models.CharField(max_length=40, default="EPSG:32737")
    description = models.TextField(blank=True)
    methodology_version = models.CharField(max_length=80, default="configurable-v1")
    methodology_source = models.CharField(max_length=255, blank=True)
    historical_sensor = models.CharField(max_length=120, blank=True)
    current_sensor = models.CharField(max_length=120, blank=True)
    historical_scale_m = models.PositiveIntegerField(null=True, blank=True)
    current_scale_m = models.PositiveIntegerField(null=True, blank=True)
    derived_scale_m = models.PositiveIntegerField(null=True, blank=True)
    training_fraction = models.FloatField(null=True, blank=True)
    validation_fraction = models.FloatField(null=True, blank=True)
    validation_method = models.CharField(max_length=255, blank=True)
    random_seed = models.IntegerField(null=True, blank=True)
    class_schema = models.JSONField(default=dict, blank=True)
    methodology = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"Profile: {self.forest.name}"

class ForestBoundary(models.Model):
    forest = models.OneToOneField(Forest, on_delete=models.CASCADE, related_name="boundary")
    source = models.CharField(max_length=255, blank=True)
    geometry = models.MultiPolygonField(srid=32737)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Boundary: {self.forest.name}"
