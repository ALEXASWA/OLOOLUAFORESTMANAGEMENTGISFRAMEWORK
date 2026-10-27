import json
from pathlib import Path

from django.conf import settings
from django.contrib.auth.views import redirect_to_login
from django.core.exceptions import ObjectDoesNotExist
from django.http import FileResponse, Http404
from django.shortcuts import render
from django.urls import reverse

from apps.forests.models import Forest
from apps.gis_layers.models import MapProduct, RasterLayer
from apps.management.models import ManagementZone
from apps.training_data.models import LULCTrainingSample
from .services import (
    format_area,
    format_number,
    format_percent,
    get_forest_summary,
    indicator_rows,
    ndvi_statistics,
)


def dashboard(request):
    forests = Forest.objects.filter(status="active")
    code = request.GET.get("forest")
    
    selected = None
    if code:
        selected = forests.filter(code=code).first()
    if not selected:
        selected = forests.first()

    summary = get_forest_summary(selected) if selected else {}

    analysis_year = "Not configured"
    period_display = "Awaiting configuration"
    if selected:
        try:
            analysis_year = getattr(selected.profile, "default_year", "Not configured")
            epochs = selected.profile.historical_years or []
            if epochs:
                period_display = f"{min(epochs)} – {max(epochs)}"
        except (ObjectDoesNotExist, AttributeError):
            analysis_year = "Not configured"

    return render(
        request,
        "dashboard/index.html",
        {
            "forests": forests,
            "forest": selected,
            "analysis_year": analysis_year,
            "period_display": period_display,
            "epoch_count": selected.lulc_maps.count() if selected else 0,
            "analytics_url": f"/api/analytics/{selected.code}/" if selected else "",
            "transitions_url": f"/api/lulc/transitions/?forest={selected.code}" if selected else "",
            "data_status": _data_status(selected),
            "lulc_class_display": summary.get("lulc_class_count", 0),
            "forest_change_display": summary.get("forest_change_display", "Awaiting data"),
            "core_forest_display": summary.get("core_forest_display", "Awaiting data"),
            "edge_forest_display": summary.get("edge_forest_display", "Awaiting data"),
            "basemaps_json": json.dumps(getattr(settings, "BASEMAPS", {})),
            "summary": summary,
        },
    )


def _data_status(forest):
    if not forest:
        return []
    return [
        ("Forest configuration", True),
        ("LULC products", forest.lulc_maps.exists()),
        ("LULC statistics", forest.lulc_maps.filter(statistics__isnull=False).exists()),
        (
            "Ecology indicators",
            forest.indicators.filter(
                name__in=["Forest edge and core structure", "NDVI vegetation condition"]
            ).exists(),
        ),
        (
            "Pressure proxy",
            forest.indicators.filter(
                name="Remote-sensing anthropogenic pressure proxy"
            ).exists(),
        ),
        (
            "Management framework",
            ManagementZone.objects.filter(forest=forest).exists()
            or forest.indicators.filter(name="Proposed analytical management zones").exists(),
        ),
        ("Training data", LULCTrainingSample.objects.filter(forest=forest).exists()),
        ("Field observations", forest.field_observations.exists()),
        ("Map products", MapProduct.objects.filter(forest=forest).exists()),
        ("Registered raster layers", RasterLayer.objects.filter(forest=forest).exists()),
    ]


def analysis_page(
    request,
    section,
    title,
    eyebrow,
    description,
    chart_keys=None,
    restricted=False,
    required_roles=None,
):
    is_authenticated = request.user.is_authenticated
    roles = set(request.user.groups.values_list("name", flat=True)) if is_authenticated else set()
    is_staff = is_authenticated and (request.user.is_staff or request.user.is_superuser)

    if restricted:
        if not is_authenticated or (required_roles and not is_staff and not roles.intersection(required_roles)):
            return redirect_to_login(request.get_full_path())

    forests = Forest.objects.filter(status="active")
    forest_code = request.GET.get("forest")
    forest = forests.filter(code=forest_code).first() if forest_code else forests.first()

    products = (
        MapProduct.objects.filter(forest=forest, publication_status="public").order_by("-year", "title")
        if forest
        else MapProduct.objects.none()
    )

    product_cards = [
        {
            "title": product.title,
            "year": product.year or "Research output",
            "description": product.description or "Registered research product.",
            "type_label": (product.product_type or "").upper(),
            "preview_url": reverse("map-product-preview", args=[product.id]) if product.product_type == "image" else "",
            "icon_class": "bi-map" if product.product_type == "qgis" else "bi-file-earmark-pdf",
            "download_url": reverse("map-product-download", args=[product.id]),
        }
        for product in products
    ]

    summary = get_forest_summary(forest) if forest else {}

    section_data = {
        "ecology_rows": [
            {**row, "area_display": format_area(float(row.get("Area_ha", 0)))}
            for row in indicator_rows(forest, "Forest edge and core structure")
        ] if forest else [],
        "ndvi_rows": ndvi_statistics(forest) if forest else [],
        "ecology_layers": RasterLayer.objects.filter(forest=forest, kind="ecology", active=True) if forest else [],
        "pressure_rows": [
            {**row, "area_display": format_area(float(row.get("Area_ha", 0)))}
            for row in indicator_rows(forest, "Remote-sensing anthropogenic pressure proxy")
        ] if forest else [],
        "pressure_layers": RasterLayer.objects.filter(forest=forest, kind="threat", active=True) if forest else [],
        "index_rows": [
            {
                **row,
                "mean_display": format_number(row.get("Mean")),
                "median_display": format_number(row.get("Median")),
                "p25_display": format_number(row.get("P25")),
                "p75_display": format_number(row.get("P75")),
            }
            for row in indicator_rows(forest, "Management indices")
        ] if forest else [],
        "management_zones": [
            {
                **zone,
                "area_display": format_area(zone["area_ha"]),
                "percentage_display": format_percent(zone["percentage"]),
            }
            for zone in list(forest.management_zone_statistics.values("zone_name", "area_ha", "percentage"))
        ] if forest else [],
        "training_datasets": (
            list(forest.training_datasets.values("name", "sample_count", "training_count", "validation_count", "crs", "source_file"))
            if forest
            else []
        ),
        "field_observation_count": forest.field_observations.count() if forest else 0,
    }

    section_api_url = ""
    if forest:
        api_mapping = {
            "ecology": f"/api/ecology/?forest={forest.code}",
            "pressure": f"/api/pressure/?forest={forest.code}",
            "conservation": f"/api/conservation/?forest={forest.code}",
            "management": f"/api/management-zones/summary/?forest={forest.code}",
        }
        section_api_url = api_mapping.get(section, f"/api/analytics/{forest.code}/")

    return render(
        request,
        "dashboard/analysis.html",
        {
            "section_key": section,
            "page_title": title,
            "eyebrow": eyebrow,
            "description": description,
            "forest": forest,
            "forests": forests,
            "products": products,
            "product_cards": product_cards,
            "chart_keys": chart_keys or [],
            "restricted": restricted,
            "section_template": f"dashboard/sections/{section}.html",
            "analytics_url": f"/api/analytics/{forest.code}/" if forest else "",
            "section_api_url": section_api_url,
            "summary": summary,
            "basemaps_json": json.dumps(getattr(settings, "BASEMAPS", {})),
            "area_display": summary.get("area_display", "Awaiting boundary"),
            "analysis_year_display": summary.get("analysis_year", "Not configured"),
            "product_count_display": summary.get("registered_product_count", 0),
            **section_data,
        },
    )


IMPORT_COMMANDS = [
    ("seed_oloolua_config", "Creates the forest record, profile, LULC classes, zone types and pressure weights. No fake boundary or research result is created."),
    ("seed_roles", "Creates the administrator-managed role groups used for authorization."),
    ("import_forest_boundary", "Imports the real forest boundary vector (transformed to EPSG:32737; area derived from geometry)."),
    ("generate_analytical_buffer", "Builds the configurable external analytical buffer used for context analysis. The buffer is never reported as forest area."),
    ("ingest_lulc_outputs", "Imports GEE LULC area tables, transitions, indicator tables and management-zone statistics from the supplied export directory."),
    ("ingest_gee_rasters", "Registers GeoTIFF exports idempotently with checksum, CRS, transform, pixel size, bounds, nodata, class values and display colormaps. Supports --dry-run."),
    ("ingest_training_data", "Imports training/validation reference samples with deduplication, split assignment and provenance."),
    ("register_map_products", "Registers exported map products (JPG/PNG/PDF/QGZ) in the gallery without treating images as georeferenced GIS layers."),
    ("generate_map_thumbnails", "Generates gallery thumbnails for registered image products."),
    ("audit_duplicates", "Audits registered datasets for duplicate representations."),
    ("check_database", "Verifies the PostgreSQL/PostGIS connection and spatial query support."),
]


def field_data_page(request):
    forests = Forest.objects.filter(status="active")
    forest = forests.filter(code=request.GET.get("forest")).first() if request.GET.get("forest") else forests.first()
    observations = forest.field_observations.all() if forest else []
    return render(request, "dashboard/field_data.html", {
        "forest": forest,
        "observations": observations,
        "observation_count": observations.count() if forest else 0,
    })


def imports_page(request):
    forests = Forest.objects.filter(status="active")
    forest = forests.filter(code=request.GET.get("forest")).first() if request.GET.get("forest") else forests.first()
    status_rows = []
    if forest:
        status_rows = [
            ("Forest boundary", forest.geometry is not None, "import_forest_boundary"),
            ("Analytical buffer", forest.analytical_buffer is not None, "generate_analytical_buffer"),
            ("LULC statistics", forest.lulc_maps.filter(statistics__isnull=False).exists(), "ingest_lulc_outputs"),
            ("LULC transitions", forest.lulc_transitions.exists(), "ingest_lulc_outputs"),
            ("Registered rasters", RasterLayer.objects.filter(forest=forest, active=True).exists(), "ingest_gee_rasters"),
            ("Training samples", LULCTrainingSample.objects.filter(forest=forest).exists(), "ingest_training_data"),
            ("Map products", MapProduct.objects.filter(forest=forest).exists(), "register_map_products"),
            ("Field observations", forest.field_observations.exists(), "FieldObservation records (Django Admin)"),
        ]
    return render(request, "dashboard/imports.html", {
        "forest": forest,
        "commands": IMPORT_COMMANDS,
        "status_rows": status_rows,
    })


def map_product_download(request, product_id):
    product = MapProduct.objects.filter(pk=product_id, publication_status="public").first()
    if not product or not product.file_path:
        raise Http404("Approved map product not found")

    path = Path(product.file_path)
    if not path.is_file():
        raise Http404("Map product file is unavailable")

    return FileResponse(path.open("rb"), as_attachment=True, filename=path.name)


def map_product_preview(request, product_id):
    product = MapProduct.objects.filter(pk=product_id, publication_status="public").first()
    if not product or not product.file_path:
        raise Http404("Approved map product not found")

    source = Path(product.file_path)
    preview = source.parent / "previews" / f"{source.stem}.jpg"
    path = preview if preview.is_file() else source
    allowed_extensions = {".jpg", ".jpeg", ".png", ".pdf"}
    if not path.is_file() or path.suffix.lower() not in allowed_extensions:
        raise Http404("Preview is unavailable")

    response = FileResponse(path.open("rb"), as_attachment=False, filename=path.name)
    response["Cache-Control"] = "public, max-age=86400"
    return response


def map_product_thumbnail(request, product_id):
    product = MapProduct.objects.filter(
        pk=product_id, publication_status="public", product_type="image"
    ).first()
    if not product or not product.file_path:
        raise Http404("Thumbnail not found")

    source = Path(product.file_path)
    thumbnail = source.parent / "thumbnails" / f"{source.stem}.jpg"
    if not thumbnail.is_file():
        raise Http404("Thumbnail is unavailable")

    return FileResponse(thumbnail.open("rb"), as_attachment=False, filename=thumbnail.name)