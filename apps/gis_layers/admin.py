from django.contrib import admin

from .models import RasterLayer, VectorLayer, MapProduct


@admin.register(RasterLayer)
class RasterLayerAdmin(admin.ModelAdmin):
    list_display = ("name", "forest", "kind", "data_type", "year", "resolution_m", "data_status", "active")
    list_filter = ("kind", "data_type", "data_status", "active", "forest")
    search_fields = ("name", "slug")


admin.site.register([VectorLayer, MapProduct])
