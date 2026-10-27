from django.contrib.gis.db import models
from apps.forests.models import Forest

class ManagementZoneType(models.Model):
    forest = models.ForeignKey(Forest, on_delete=models.CASCADE, related_name="zone_types")
    code = models.SlugField(max_length=80)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    display_order = models.PositiveIntegerField(default=0)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["forest","code"], name="uniq_zone_type")]

class ManagementZone(models.Model):
    PRIORITIES = [("very_low","Very Low"),("low","Low"),("moderate","Moderate"),("high","High"),("very_high","Very High")]
    DATA_STATUS = [("proposed","Proposed"),("derived","Derived")]
    forest = models.ForeignKey(Forest, on_delete=models.CASCADE, related_name="management_zones")
    code = models.CharField(max_length=80)
    zone_type = models.ForeignKey(ManagementZoneType, on_delete=models.PROTECT, related_name="zones")
    priority = models.CharField(max_length=20, choices=PRIORITIES, default="moderate")
    area_ha = models.FloatField(null=True, blank=True)
    primary_issue = models.CharField(max_length=255, blank=True)
    threat_summary = models.TextField(blank=True)
    recommendation = models.TextField(blank=True)
    data_status = models.CharField(max_length=20, choices=DATA_STATUS, default="proposed")
    geometry = models.MultiPolygonField(srid=32737)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["forest","code"], name="uniq_zone_code")]
        indexes = [models.Index(fields=["forest","priority"])]

class ManagementAction(models.Model):
    STATUS = [("planned","Planned"),("active","Active"),("completed","Completed"),("suspended","Suspended"),("cancelled","Cancelled")]
    forest = models.ForeignKey(Forest, on_delete=models.CASCADE, related_name="management_actions")
    zone = models.ForeignKey(ManagementZone, on_delete=models.SET_NULL, null=True, blank=True, related_name="actions")
    action_type = models.CharField(max_length=150)
    priority = models.CharField(max_length=30, default="Medium")
    description = models.TextField(blank=True)
    responsible_organization = models.CharField(max_length=255, blank=True)
    start_date = models.DateField(null=True, blank=True)
    target_date = models.DateField(null=True, blank=True)
    target_area_ha = models.FloatField(null=True, blank=True)
    estimated_cost = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS, default="planned")
    indicator = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    geometry = models.GeometryField(srid=32737, null=True, blank=True)


class ManagementZoneStatistic(models.Model):
    forest = models.ForeignKey(Forest, on_delete=models.CASCADE, related_name="management_zone_statistics")
    zone_code = models.CharField(max_length=80)
    zone_name = models.CharField(max_length=180)
    area_ha = models.FloatField()
    percentage = models.FloatField()
    source = models.CharField(max_length=1000)
    version = models.CharField(max_length=50, default="gee-v1")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["forest", "zone_code", "version"], name="uniq_zone_stat_version")]
