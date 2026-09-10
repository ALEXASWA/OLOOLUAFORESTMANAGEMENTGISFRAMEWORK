# Database schema

Spatial primary keys use Django BigAutoField. Forest, boundary, threats, zones and actions use PostGIS geometry fields. RasterLayer stores references and metadata rather than embedding large GeoTIFFs in PostgreSQL.
