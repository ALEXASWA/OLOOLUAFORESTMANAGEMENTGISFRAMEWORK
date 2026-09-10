from django.contrib import admin
from .models import Forest, ForestProfile, ForestBoundary
@admin.register(Forest)
class ForestAdmin(admin.ModelAdmin):
    list_display = ("name","code","country","county","area_ha","status")
    search_fields = ("name","code","county")
@admin.register(ForestProfile)
class ForestProfileAdmin(admin.ModelAdmin): list_display = ("forest","default_year","crs","analysis_resolution")
@admin.register(ForestBoundary)
class ForestBoundaryAdmin(admin.ModelAdmin): list_display = ("forest","source","created_at")
