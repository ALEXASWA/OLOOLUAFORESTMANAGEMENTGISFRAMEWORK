import json
from pathlib import Path
from collections import defaultdict

from django.db import connection
from django.http import Http404, HttpResponse, JsonResponse
from rest_framework import viewsets
from django.urls import reverse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from pyproj import Transformer

from .permissions import ForestApiPermission
from apps.forests.models import Forest, ForestBoundary
from apps.ecology.models import Indicator
from apps.gis_layers.models import MapProduct, RasterLayer
from apps.gis_layers.raster_service import legend_entries, render_raster_png, sample_raster_value
from apps.lulc.models import LULCMap, LULCStatistic, LULCTransition
from apps.management.models import ManagementZone
from apps.training_data.models import LULCTrainingDataset, LULCTrainingSample
from apps.dashboard.services import indicator_rows
from .serializers import ForestSerializer, BoundarySerializer, ManagementZoneSerializer

class ForestViewSet(viewsets.ModelViewSet):
    queryset = Forest.objects.all()
    serializer_class = ForestSerializer
    permission_classes = [ForestApiPermission]
    lookup_field = "code"

class BoundaryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ForestBoundary.objects.select_related("forest")
    serializer_class = BoundarySerializer

class ManagementZoneViewSet(viewsets.ModelViewSet):
    queryset = ManagementZone.objects.select_related("forest","zone_type")
    serializer_class = ManagementZoneSerializer
    permission_classes = [ForestApiPermission]


@api_view(["GET"])
@permission_classes([IsAuthenticatedOrReadOnly])
def forest_workspace(request, code):
    forest = Forest.objects.filter(code=code, status="active").first()
    if not forest:
        raise Http404("Forest not found")

    analysis_geometry = forest.analytical_buffer or forest.geometry
    extent = centroid = None
    if analysis_geometry:
        transformed = analysis_geometry.transform(4326, clone=True)
        extent = list(transformed.extent)
        point = transformed.centroid
        centroid = [point.x, point.y]
    features = []
    if forest.geometry:
        features.append({
            "type": "Feature",
            "geometry": json.loads(forest.geometry.geojson),
            "properties": {"forest": forest.code, "layer": "original", "label": "Original forest boundary"},
        })
    if forest.analytical_buffer:
        features.append({
            "type": "Feature",
            "geometry": json.loads(forest.analytical_buffer.geojson),
            "properties": {
                "forest": forest.code,
                "layer": "buffer",
                "label": f"{forest.buffer_distance_m} m external analytical buffer",
            },
        })
    for sample in LULCTrainingSample.objects.filter(forest=forest).only("geometry", "split", "class_id", "class_name"):
        if sample.geometry:
            features.append({
                "type": "Feature",
                "geometry": json.loads(sample.geometry.geojson),
                "properties": {
                    "forest": forest.code, "layer": sample.split.lower(),
                    "label": f"{sample.class_name} ({sample.split.lower()})",
                    "class_id": sample.class_id, "class_name": sample.class_name,
                },
            })
    for zone in ManagementZone.objects.filter(forest=forest).select_related("zone_type"):
        features.append({
            "type": "Feature",
            "geometry": json.loads(zone.geometry.geojson),
            "properties": {
                "forest": forest.code, "layer": "management-zone",
                "label": zone.zone_type.name, "code": zone.code,
                "priority": zone.priority, "data_status": zone.data_status,
            },
        })
    return Response({"type": "FeatureCollection", "features": features, "extent": extent, "centroid": centroid})


def _forest_or_404(code):
    forest = Forest.objects.filter(code=code, status="active").first()
    if not forest:
        raise Http404("Forest not found")
    return forest


def _indicator_rows(forest, names):
    indicators = Indicator.objects.filter(forest=forest, name__in=names).prefetch_related("products")
    result = {}
    for indicator in indicators:
        rows = []
        for product in indicator.products.all():
            rows.extend(product.value_summary.get("rows", []))
        result[indicator.name] = rows
    return result


@api_view(["GET"])
def analytics(request, code):
    forest = _forest_or_404(code)
    yearly = defaultdict(dict)
    for statistic in LULCStatistic.objects.filter(lulc_map__forest=forest).select_related("lulc_map", "lulc_class"):
        yearly[statistic.lulc_map.year][statistic.lulc_class.name] = statistic.area_ha

    indicators = _indicator_rows(forest, [
        "Forest change", "Forest edge and core structure",
        "Remote-sensing anthropogenic pressure proxy", "NDVI vegetation condition",
        "Management indices", "Proposed analytical management zones",
    ])
    zones = list(forest.management_zone_statistics.values("zone_code", "zone_name", "area_ha", "percentage"))
    datasets = list(forest.training_datasets.values(
        "name", "dataset_type", "sample_count", "training_count", "validation_count", "crs", "source_file",
    ))
    return Response({
        "forest": {"name": forest.name, "code": forest.code, "area_ha": forest.area_ha},
        "lulc": {
            "years": dict(yearly),
            "maps": LULCMap.objects.filter(forest=forest).count(),
            "classes": forest.lulc_classes.count(),
            "class_names": list(forest.lulc_classes.order_by("display_order", "name").values_list("name", flat=True)),
        },
        "indicators": indicators,
        "management_zones": zones,
        "training": {"datasets": datasets, "samples": LULCTrainingSample.objects.filter(forest=forest).count()},
        "products": list(MapProduct.objects.filter(forest=forest).values(
            "id", "title", "year", "product_type", "category", "description", "publication_status",
        )),
        "rasters": [_raster_payload(raster) for raster in RasterLayer.objects.filter(forest=forest, active=True)],
    })


@api_view(["GET"])
def lulc_statistics(request):
    forest = _forest_or_404(request.GET.get("forest", "oloolua"))
    rows = LULCStatistic.objects.filter(lulc_map__forest=forest).select_related("lulc_map", "lulc_class")
    return Response([{
        "year": row.lulc_map.year, "class": row.lulc_class.name, "class_id": row.lulc_class.code,
        "area_ha": row.area_ha, "percentage": row.percentage,
    } for row in rows.order_by("lulc_map__year", "lulc_class__display_order")])


@api_view(["GET"])
def lulc_transitions(request):
    forest = _forest_or_404(request.GET.get("forest", "oloolua"))
    rows = LULCTransition.objects.filter(forest=forest).select_related("from_class", "to_class")
    return Response([{
        "from_year": row.from_year, "to_year": row.to_year,
        "from_class": row.from_class.name, "to_class": row.to_class.name,
        "area_ha": row.area_ha, "percentage": row.percentage,
    } for row in rows.order_by("from_year", "from_class__code", "to_class__code")])


@api_view(["GET"])
def metadata(request):
    forest = _forest_or_404(request.GET.get("forest", "oloolua"))
    return Response({
        "rasters": list(RasterLayer.objects.filter(forest=forest).values(
            "name", "kind", "year", "source", "resolution_m", "crs", "processing_method", "active", "created_at",
        )),
        "products": list(MapProduct.objects.filter(forest=forest).values(
            "title", "category", "year", "product_type", "source", "description", "publication_status", "created_at",
        )),
        "training": list(LULCTrainingDataset.objects.filter(forest=forest).values(
            "name", "dataset_type", "reference_year", "crs", "sample_count", "status", "source_file", "imported_at",
        )),
    })


@api_view(["GET"])
def ecology_data(request):
    forest = _forest_or_404(request.GET.get("forest", "oloolua"))
    return Response({
        "status": "derived",
        "core_edge": indicator_rows(forest, "Forest edge and core structure"),
        "ndvi": indicator_rows(forest, "NDVI vegetation condition"),
        "layers": list(RasterLayer.objects.filter(forest=forest, kind="ecology", active=True).values("name", "year", "resolution_m", "crs")),
    })


@api_view(["GET"])
def pressure_data(request):
    forest = _forest_or_404(request.GET.get("forest", "oloolua"))
    return Response({
        "status": "derived proxy",
        "interpretation": "Remote-sensing-based anthropogenic pressure proxy; not a direct measure of human behaviour or causal impact.",
        "rows": indicator_rows(forest, "Remote-sensing anthropogenic pressure proxy"),
        "layers": list(RasterLayer.objects.filter(forest=forest, kind="threat", active=True).values("name", "year", "resolution_m", "crs")),
    })


@api_view(["GET"])
def conservation_data(request):
    forest = _forest_or_404(request.GET.get("forest", "oloolua"))
    return Response({"status": "proposed", "rows": indicator_rows(forest, "Management indices"), "methodology": forest.profile.methodology if hasattr(forest, "profile") else {}})


@api_view(["GET"])
def management_zone_data(request):
    forest = _forest_or_404(request.GET.get("forest", "oloolua"))
    return Response({"status": "proposed analytical management zones", "zones": list(forest.management_zone_statistics.values("zone_code", "zone_name", "area_ha", "percentage", "source"))})


GROUP_RULES = [
    ("lulc", "Land use and land cover", 30),
    ("forest-loss", "Change detection", 40),
    ("forest-gain", "Change detection", 40),
    ("persistent-forest", "Change detection", 40),
    ("builtup-expansion", "Change detection", 40),
    ("quarry-expansion", "Change detection", 40),
    ("ndvi", "Vegetation", 50),
    ("forest-density", "Forest structure", 60),
    ("forest-fragmentation", "Forest structure", 60),
    ("forest-core", "Forest structure", 60),
    ("forest-edge", "Forest structure", 60),
    ("human-pressure", "Anthropogenic pressure and conservation", 70),
    ("conservation-priority", "Anthropogenic pressure and conservation", 70),
    ("rehabilitation-priority", "Anthropogenic pressure and conservation", 70),
    ("management-zones", "Management", 80),
]


def _group_for(slug, kind):
    for marker, group, order in GROUP_RULES:
        if marker in slug:
            return group, order
    fallback = {"lulc": ("Land use and land cover", 30), "change": ("Change detection", 40),
                "ecology": ("Forest structure", 60), "threat": ("Anthropogenic pressure and conservation", 70),
                "management": ("Management", 80)}
    return fallback.get(kind, ("Registered layers", 90))


def _bounds_4326(raster):
    if not raster.bounds or not raster.crs:
        return None
    try:
        epsg = int(raster.crs.upper().replace("EPSG:", ""))
        transformer = Transformer.from_crs(f"EPSG:{epsg}", "EPSG:4326", always_xy=True)
        minx, miny, maxx, maxy = raster.bounds
        xs, ys = transformer.transform([minx, maxx], [miny, maxy])
        return [min(xs[0], xs[1]), min(ys[0], ys[1]), max(xs[0], xs[1]), max(ys[0], ys[1])]
    except Exception:
        return None


def _raster_payload(raster):
    group, order = _group_for(raster.slug, raster.kind)
    return {
        "id": raster.id,
        "name": raster.name,
        "slug": raster.slug,
        "group": group,
        "group_order": order,
        "kind": raster.kind,
        "data_type": raster.data_type,
        "data_status": raster.data_status,
        "year": raster.year,
        "resolution_m": raster.resolution_m,
        "crs": raster.crs,
        "source": raster.source,
        "processing_method": raster.processing_method,
        "description": raster.description,
        "width": raster.width,
        "height": raster.height,
        "checksum": raster.checksum[:12] if raster.checksum else "",
        "bounds_4326": _bounds_4326(raster),
        "legend": legend_entries(raster.colormap or {}),
        "overlay_url": reverse("raster-overlay", args=[raster.id]),
        "identify_url": reverse("raster-identify", args=[raster.id]),
    }


@api_view(["GET"])
def raster_catalogue(request):
    forest = _forest_or_404(request.GET.get("forest", "oloolua"))
    rasters = RasterLayer.objects.filter(forest=forest, active=True).order_by("slug")
    return Response([_raster_payload(raster) for raster in rasters])


@api_view(["GET"])
def raster_overlay(request, pk):
    raster = RasterLayer.objects.filter(pk=pk, active=True).select_related("forest").first()
    if not raster:
        return JsonResponse({"detail": "Raster layer not found or inactive."}, status=404)
    path = Path(raster.file_path)
    if not path.is_file():
        return JsonResponse({"detail": "Raster source file is unavailable."}, status=410)
    try:
        png = render_raster_png(raster)
    except Exception as exc:
        return JsonResponse({"detail": f"Raster could not be rendered: {exc}"}, status=500)
    response = HttpResponse(png, content_type="image/png")
    response["Cache-Control"] = "private, max-age=3600"
    return response


@api_view(["GET"])
def raster_identify(request, pk):
    raster = RasterLayer.objects.filter(pk=pk, active=True).first()
    if not raster:
        return JsonResponse({"detail": "Raster layer not found or inactive."}, status=404)
    try:
        lon = float(request.GET.get("lon", ""))
        lat = float(request.GET.get("lat", ""))
    except ValueError:
        return JsonResponse({"detail": "lon and lat query parameters must be numbers."}, status=400)
    path = Path(raster.file_path)
    if not path.is_file():
        return JsonResponse({"detail": "Raster source file is unavailable."}, status=410)
    try:
        result = sample_raster_value(raster, lon, lat)
    except Exception as exc:
        return JsonResponse({"detail": f"Raster could not be sampled: {exc}"}, status=500)
    if result is None:
        return JsonResponse({"detail": "Coordinate is outside the raster extent."}, status=404)
    value, label = result
    return Response({
        "layer": raster.name, "value": value, "label": label,
        "unit": raster.colormap.get("unit") if isinstance(raster.colormap, dict) else None,
    })


@api_view(["GET"])
def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.execute("SELECT PostGIS_Version()")
            postgis = cursor.fetchone()[0].split()[0]
        return Response({"status": "ok", "database": "postgresql", "postgis": postgis})
    except Exception as exc:
        return JsonResponse({"status": "error", "detail": str(exc)}, status=503)


@api_view(["GET"])
def map_products(request):
    forest = _forest_or_404(request.GET.get("forest", "oloolua"))
    products = MapProduct.objects.filter(forest=forest, publication_status="public").order_by("-year", "title")
    payload = []
    for product in products:
        source = Path(product.file_path)
        thumbnail = source.parent / "thumbnails" / f"{source.stem}.jpg"
        is_image = product.product_type == "image"
        payload.append({
            "id": product.id, "title": product.title, "year": product.year,
            "type": product.product_type, "category": product.category,
            "source": product.source, "forest": forest.name,
            "description": product.description, "size": source.stat().st_size if source.is_file() else 0,
            "thumbnail_url": reverse("map-product-thumbnail", args=[product.id]) if thumbnail.is_file() else "",
            "preview_url": reverse("map-product-preview", args=[product.id]) if is_image else "",
            "original_url": reverse("map-product-download", args=[product.id]),
            "georeferenced": False,
        })
    return Response(payload)
