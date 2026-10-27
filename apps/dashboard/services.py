from apps.ecology.models import Indicator
from apps.gis_layers.models import MapProduct, RasterLayer
from apps.management.models import ManagementZoneStatistic


def format_number(value):
    if value is None:
        return "Awaiting data"
    return f"{float(value):,.2f}"


def format_area(value):
    return f"{format_number(value)} ha" if value is not None else "Awaiting boundary"


def format_percent(value):
    return f"{float(value):,.1f}%" if value is not None else "Awaiting data"


def indicator_rows(forest, name):
    indicator = Indicator.objects.filter(forest=forest, name=name).prefetch_related("products").first()
    if not indicator:
        return []
    rows = []
    for product in indicator.products.all():
        rows.extend(product.value_summary.get("rows", []))
    return rows


def get_forest_summary(forest):
    raster_count = RasterLayer.objects.filter(forest=forest, active=True).count()
    map_product_count = MapProduct.objects.filter(forest=forest, publication_status="public").count()
    change_rows = indicator_rows(forest, "Forest change")
    structure_rows = indicator_rows(forest, "Forest edge and core structure")
    by_indicator = {row.get("Indicator"): row.get("Area_ha") for row in change_rows}
    by_structure = {row.get("Structure"): row.get("Area_ha") for row in structure_rows}
    return {
        "area_display": format_area(forest.area_ha),
        "analysis_year": getattr(getattr(forest, "profile", None), "default_year", "Not configured"),
        "registered_product_count": raster_count + map_product_count,
        "raster_count": raster_count,
        "map_product_count": map_product_count,
        "management_zone_count": ManagementZoneStatistic.objects.filter(forest=forest).count(),
        "lulc_class_count": forest.lulc_classes.count(),
        "forest_change_display": format_area(float(by_indicator["Forest loss"])) if by_indicator.get("Forest loss") else "Awaiting data",
        "core_forest_display": format_area(float(by_structure["Forest core"])) if by_structure.get("Forest core") else "Awaiting data",
        "edge_forest_display": format_area(float(by_structure["Forest edge"])) if by_structure.get("Forest edge") else "Awaiting data",
    }


def ndvi_statistics(forest):
    values = []
    for row in indicator_rows(forest, "NDVI vegetation condition"):
        name = row.get("")
        value = row.get("0")
        if name and value is not None:
            values.append({"name": name, "value_display": format_number(value), "value": float(value)})
    return values