from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import BoundaryViewSet, ForestViewSet, ManagementZoneViewSet, analytics, conservation_data, ecology_data, forest_workspace, health, lulc_statistics, lulc_transitions, management_zone_data, map_products, metadata, pressure_data, raster_catalogue, raster_identify, raster_overlay
router = DefaultRouter()
router.register("forests", ForestViewSet, basename="forest")
router.register("boundaries", BoundaryViewSet, basename="boundary")
router.register("management-zones", ManagementZoneViewSet, basename="management-zone")
urlpatterns = [
	path("forests/<slug:code>/workspace/", forest_workspace, name="forest-workspace"),
	path("analytics/<slug:code>/", analytics, name="analytics"),
	path("lulc/statistics/", lulc_statistics, name="lulc-statistics"),
	path("lulc/transitions/", lulc_transitions, name="lulc-transitions"),
	path("metadata/", metadata, name="metadata"),
	path("ecology/", ecology_data, name="ecology-data"),
	path("pressure/", pressure_data, name="pressure-data"),
	path("conservation/", conservation_data, name="conservation-data"),
	path("management-zones/summary/", management_zone_data, name="management-zone-summary"),
	path("map-products/", map_products, name="map-products-api"),
	path("rasters/", raster_catalogue, name="raster-catalogue"),
	path("rasters/<int:pk>/overlay/", raster_overlay, name="raster-overlay"),
	path("rasters/<int:pk>/identify/", raster_identify, name="raster-identify"),
	path("health/", health, name="api-health"),
] + router.urls
