# FGMDSS — Forest Geospatial Management and Decision-Support System

A reusable Django/GeoDjango/PostGIS forest management framework, demonstrated first with Oloolua Forest.

## Architecture

Remote Sensing / GEE exports → Data ingestion → PostGIS metadata & vectors → Analytical products → REST API → OpenLayers Web GIS → Dashboard → Management & Monitoring.

The application does **not** require Google Earth Engine to run locally. It is designed to consume exported research products.

## 1. Prerequisites

- Windows
- Python 3.12+
- PostgreSQL with PostGIS
- Your existing virtual environment activated

If your venv already has the required libraries, do not recreate it unnecessarily.

## 2. Install project dependencies

```powershell
python -m pip install -r requirements.txt
```

If GDAL is already correctly installed in your environment, keep that working installation. On Windows, the GDAL version must be compatible with your Python/GeoPandas/Rasterio stack.

## 3. Database creation

In pgAdmin or psql, create a database and enable PostGIS:

```sql
CREATE DATABASE fgmdss;
```

Connect to `fgmdss`, then:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
```

## 4. Configure environment

Copy:

```text
.env.example
```

to:

```text
.env
```

Fill in the PostgreSQL password. Never commit `.env`.

## 5. Migrations

```powershell
python manage.py makemigrations
python manage.py migrate
```

## 6. Create admin user

```powershell
python manage.py createsuperuser
```

## 7. Create initial Oloolua configuration

This creates the forest record, configurable profile, LULC classes, proposed zone types and pressure weights. It creates **no fake boundary or research result**.

```powershell
python manage.py seed_oloolua_config
```

Create the administrator-managed role groups before assigning users:

```powershell
python manage.py seed_roles
```

Assign users to `ADMINISTRATOR`, `GIS ANALYST`, `FOREST MANAGER`, `FIELD OFFICER`, or `VIEWER` through Django Admin. Public pages are read-only; API mutations are restricted to staff/superusers and administrator or GIS analyst groups.

## 8. Import the real Oloolua boundary

Example:

```powershell
python manage.py import_forest_boundary oloolua "C:\path\to\Oloolua_Forest.shp"
```

The input vector must contain a valid CRS. The command transforms it to EPSG:32737 for storage and calculates area from the geometry.

## 9. Run the server

```powershell
python manage.py runserver
```

Open:

```text
http://127.0.0.1:8000/
```

Login using your superuser.

## 10. Admin

```text
http://127.0.0.1:8000/admin/
```

Use Admin for forests, profiles, LULC classes/maps/statistics, raster metadata, threats, management zones/actions, field observations, biodiversity and monitoring.

## 11. API

```text
/api/forests/
/api/boundaries/
/api/management-zones/
```

Spatial endpoints return GeoJSON.

## 12. QGIS connection

In QGIS:

1. Browser → PostgreSQL → New Connection.
2. Name: FGMDSS
3. Host: localhost
4. Port: 5432
5. Database: fgmdss
6. Authentication: use your PostgreSQL credentials.
7. Test Connection.
8. Add the PostGIS layers from the `public` schema.

The database uses EPSG:32737 for primary projected forest geometries. Field observation points are stored in EPSG:4326.

## 13. Research data import strategy

Place actual outputs under:

```text
data/oloolua/
  boundary/
  lulc/
  change/
  ecology/
  threats/
  management/
```

Do not put fabricated or placeholder research results here.

The architecture expects products such as:

- LULC 1990/2000/2010/2020/2025
- forest loss/gain/persistence
- NDVI / vegetation condition
- fragmentation/core/edge
- built-up/quarry expansion
- anthropogenic pressure proxy
- conservation priority
- proposed management zones

## 14. Scientific status

The application distinguishes:

- Observed
- Derived
- Modelled
- Proposed
- Future

This prevents proposed/modelled outputs from being represented as field truth.

## 15. Development sequence

1. Project
2. Database
3. Models
4. Migrations
5. Admin
6. API
7. GIS map
8. Dashboard
9. LULC analytics
10. Ecology/threat analytics
11. Management
12. Monitoring

## 16. Important implementation note

This first scaffold is deliberately conservative: it establishes the connected executable foundation without inventing your Oloolua GIS outputs. The next implementation layer can add robust raster metadata/import workflows, LULC statistics ingestion, analytical APIs, ECharts, layer-specific OpenLayers styling, role permissions and report generation.

## Tests

```powershell
python manage.py check
python manage.py test
```

For a PostGIS-backed test environment, use the same database engine and ensure PostGIS is enabled.
