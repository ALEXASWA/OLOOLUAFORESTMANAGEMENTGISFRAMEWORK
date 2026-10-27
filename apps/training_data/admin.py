from django.contrib import admin

from .models import LULCTrainingDataset, LULCTrainingSample


@admin.register(LULCTrainingDataset)
class LULCTrainingDatasetAdmin(admin.ModelAdmin):
    list_display = ("name", "forest", "version", "dataset_type", "sample_count", "status", "imported_at")
    list_filter = ("dataset_type", "status", "forest")
    search_fields = ("name", "source_file", "source_hash")


@admin.register(LULCTrainingSample)
class LULCTrainingSampleAdmin(admin.ModelAdmin):
    list_display = ("sample_id", "forest", "dataset", "class_id", "class_name", "split")
    list_filter = ("split", "class_id", "forest")
    search_fields = ("sample_id", "class_name", "source")
