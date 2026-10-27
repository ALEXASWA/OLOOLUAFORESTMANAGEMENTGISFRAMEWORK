from pathlib import Path
import os
import sys
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-change-me")
DEBUG = os.getenv("DEBUG", "True").lower() == "true"
ALLOWED_HOSTS = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "127.0.0.1,localhost").split(",") if h.strip()]
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
BASEMAPS = {
    "osm": {
        "label": "OpenStreetMap",
        "url": os.getenv("BASEMAP_OSM_URL", "https://tile.openstreetmap.org/{z}/{x}/{y}.png"),
        "attribution": "© OpenStreetMap contributors",
        "max_zoom": 19,
    },
    "light": {
        "label": "Light neutral",
        "url": os.getenv("BASEMAP_LIGHT_URL", "https://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"),
        "attribution": "© OpenStreetMap contributors © CARTO",
        "max_zoom": 20,
    },
    "satellite": {
        "label": "Satellite",
        "url": os.getenv("BASEMAP_SATELLITE_URL", "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"),
        "attribution": "Tiles © Esri, Maxar, Earthstar Geographics",
        "max_zoom": 19,
    },
    "terrain": {
        "label": "Terrain",
        "url": os.getenv("BASEMAP_TERRAIN_URL", "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"),
        "attribution": "Tiles © Esri — Esri, HERE, Garmin, FAO, NOAA, USGS",
        "max_zoom": 19,
    },
    "dark": {
        "label": "Dark",
        "url": os.getenv("BASEMAP_DARK_URL", "https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"),
        "attribution": "© OpenStreetMap contributors © CARTO",
        "max_zoom": 20,
    },
}

INSTALLED_APPS = [
    "django.contrib.admin", "django.contrib.auth", "django.contrib.contenttypes",
    "django.contrib.sessions", "django.contrib.messages", "django.contrib.staticfiles",
    "django.contrib.gis",
    "rest_framework", "rest_framework_gis",
    "apps.forests", "apps.gis_layers", "apps.lulc", "apps.change_detection",
    "apps.ecology", "apps.threats", "apps.biodiversity", "apps.field_data",
    "apps.management", "apps.monitoring", "apps.dashboard", "apps.api",
    "apps.training_data",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [BASE_DIR / "templates"],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
           "apps.forests.context_processors.active_forest",
    ]},
}]
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.contrib.gis.db.backends.postgis",
        "NAME": os.getenv("DB_NAME", "fgmdss"),
        "USER": os.getenv("DB_USER", "postgres"),
        "PASSWORD": os.getenv("DB_PASSWORD", ""),
        "HOST": os.getenv("DB_HOST", "localhost"),
        "PORT": os.getenv("DB_PORT", "5432"),
    }
}

GIS_DATA_ROOT = Path(os.getenv("GIS_DATA_ROOT", BASE_DIR / "data"))
OLOOLUA_DATA_ROOT = Path(os.getenv("OLOOLUA_DATA_ROOT", GIS_DATA_ROOT / "oloolua"))
RASTER_DATA_ROOT = Path(os.getenv("RASTER_DATA_ROOT", OLOOLUA_DATA_ROOT))
VECTOR_DATA_ROOT = Path(os.getenv("VECTOR_DATA_ROOT", OLOOLUA_DATA_ROOT))

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("TIME_ZONE", "Africa/Nairobi")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LOGIN_URL = "/accounts/login/"
LOGIN_REDIRECT_URL = "/"
LOGOUT_REDIRECT_URL = "/accounts/login/"

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticatedOrReadOnly"],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
}

# GDAL/GEOS can be overridden in .env. The fallback supports the bundled
# Windows wheels used by the project's active virtual environment.
_osgeo_dir = Path(sys.prefix) / "Lib" / "site-packages" / "osgeo"
_pyproj_data_dir = Path(sys.prefix) / "Lib" / "site-packages" / "pyproj" / "proj_dir" / "share" / "proj"
if _pyproj_data_dir.exists():
    os.environ.setdefault("PROJ_LIB", str(_pyproj_data_dir))
GDAL_LIBRARY_PATH = os.getenv("GDAL_LIBRARY_PATH") or (
    str(_osgeo_dir / "gdal.dll") if (_osgeo_dir / "gdal.dll").exists() else None
)
GEOS_LIBRARY_PATH = os.getenv("GEOS_LIBRARY_PATH") or (
    str(_osgeo_dir / "geos_c.dll") if (_osgeo_dir / "geos_c.dll").exists() else None
)
