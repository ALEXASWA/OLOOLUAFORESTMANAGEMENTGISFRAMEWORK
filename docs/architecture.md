# Architecture

```mermaid
flowchart LR
  GEE[Google Earth Engine exports] --> INGEST[Data ingestion]
  FIELD[Field observations] --> DB
  INGEST --> DB[(PostgreSQL/PostGIS)]
  DB --> API[Django REST API]
  DB --> WEB[GeoDjango/Django]
  API --> MAP[OpenLayers Web GIS]
  WEB --> MAP
  DB --> ANALYTICS[Statistics & decision rules]
  ANALYTICS --> DASH[Dashboard]
  ANALYTICS --> MGMT[Management zones/actions]
  MGMT --> MON[Monitoring]
  DB <--> QGIS[QGIS]
```

Core principle: Oloolua is a `Forest` record, not a separate application.

Analytical principle: every forest has a `ForestProfile` methodology contract. The Oloolua profile records the supplied GEE workflow, including epochs, sensors, CRS, native and derived scales, class schema, training/validation split, and scientific limitations. Future forest analyses must provide their own profile values rather than inheriting Oloolua assumptions.
