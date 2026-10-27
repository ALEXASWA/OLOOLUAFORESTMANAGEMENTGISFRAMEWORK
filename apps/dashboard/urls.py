from django.urls import path
from .views import analysis_page, dashboard, field_data_page, imports_page, map_product_download, map_product_preview, map_product_thumbnail

urlpatterns = [
	path("", dashboard, name="dashboard"),
	path("ecology/", lambda request: analysis_page(request, "ecology", "Forest Ecology", "Ecological condition", "Derived indicators describing forest structure and vegetation condition.", ["ecology"]), name="ecology"),
	path("pressure/", lambda request: analysis_page(request, "pressure", "Anthropogenic Pressure", "Remote-sensing-based proxy", "Spatial indicators of built-up and quarry expansion. These are proxies, not direct causal measures of human behaviour.", ["pressure"]), name="pressure"),
	path("conservation/", lambda request: analysis_page(request, "conservation", "Conservation Priority", "Decision support", "Conservation and management index outputs imported from the supplied research workflow.", ["conservation"]), name="conservation"),
	path("management/", lambda request: analysis_page(request, "management", "Management Zones", "Proposed analytical zones", "Analytical priorities for planning and monitoring. These are not legally gazetted zones.", ["management"]), name="management"),
	 path("monitoring/", lambda request: analysis_page(request, "monitoring", "Monitoring", "Operations", "Monitoring workspace for approved maps and future field observations.", ["monitoring"], restricted=True, required_roles={"ADMINISTRATOR", "FOREST MANAGER", "FIELD OFFICER"}), name="monitoring"),
	path("map-products/", lambda request: analysis_page(request, "map-products", "Map Products", "Research outputs", "Approved exported maps and QGIS-compatible products registered for this forest."), name="map-products"),
	path("metadata/", lambda request: analysis_page(request, "metadata", "Data & Metadata", "Provenance", "Source, resolution, CRS, method, status, and update metadata for registered datasets."), name="metadata"),
	path("reports/", lambda request: analysis_page(request, "reports", "Reports", "Research outputs", "Approved reports and downloadable products. No report is generated where no source report exists."), name="reports"),
	 path("training/", lambda request: analysis_page(request, "training", "Training Data", "Classification reference", "Forest-specific training and validation samples used by the supplied classification workflow.", ["training"], restricted=True, required_roles={"ADMINISTRATOR", "GIS ANALYST"}), name="training"),
	path("field-data/", field_data_page, name="field-data"),
	path("imports/", imports_page, name="imports"),
	path("map-products/<int:product_id>/download/", map_product_download, name="map-product-download"),
	path("map-products/<int:product_id>/preview/", map_product_preview, name="map-product-preview"),
	path("map-products/<int:product_id>/thumbnail/", map_product_thumbnail, name="map-product-thumbnail"),
]
