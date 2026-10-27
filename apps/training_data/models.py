from django.contrib.gis.db import models

from apps.forests.models import Forest


class LULCTrainingDataset(models.Model):
    STATUS = [
        ("ready", "Ready"),
        ("requires_review", "Requires review"),
        ("imported", "Imported"),
    ]
    DATASET_TYPES = [("REFERENCE", "Reference"), ("TRAINING", "Training"), ("VALIDATION", "Validation")]

    forest = models.ForeignKey(Forest, on_delete=models.CASCADE, related_name="training_datasets")
    name = models.CharField(max_length=255)
    version = models.CharField(max_length=80, default="v1")
    source_file = models.CharField(max_length=1000)
    source_hash = models.CharField(max_length=64)
    source_type = models.CharField(max_length=40, default="GeoJSON")
    reference_year = models.PositiveIntegerField(null=True, blank=True)
    classification_epochs = models.JSONField(default=list, blank=True)
    crs = models.CharField(max_length=40, default="EPSG:4326")
    class_field = models.CharField(max_length=100, default="Class")
    class_schema = models.JSONField(default=dict, blank=True)
    sample_count = models.PositiveIntegerField(default=0)
    training_count = models.PositiveIntegerField(default=0)
    validation_count = models.PositiveIntegerField(default=0)
    random_seed = models.IntegerField(null=True, blank=True)
    training_fraction = models.FloatField(null=True, blank=True)
    validation_fraction = models.FloatField(null=True, blank=True)
    methodology = models.TextField(blank=True)
    dataset_type = models.CharField(max_length=20, choices=DATASET_TYPES, default="REFERENCE")
    status = models.CharField(max_length=30, choices=STATUS, default="imported")
    validation_report = models.JSONField(default=dict, blank=True)
    imported_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["forest", "source_hash"], name="uniq_training_dataset_source")]
        indexes = [models.Index(fields=["forest", "status"])]


class LULCTrainingSample(models.Model):
    SPLITS = [("REFERENCE", "Reference"), ("TRAINING", "Training"), ("VALIDATION", "Validation")]

    forest = models.ForeignKey(Forest, on_delete=models.CASCADE, related_name="training_samples")
    dataset = models.ForeignKey(LULCTrainingDataset, on_delete=models.CASCADE, related_name="samples")
    sample_id = models.CharField(max_length=255, blank=True)
    class_id = models.PositiveIntegerField()
    class_name = models.CharField(max_length=100)
    split = models.CharField(max_length=20, choices=SPLITS, default="REFERENCE")
    source = models.CharField(max_length=1000)
    metadata = models.JSONField(default=dict, blank=True)
    geometry = models.GeometryField(srid=32737)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["forest", "split"]),
            models.Index(fields=["dataset", "class_id"]),
        ]
