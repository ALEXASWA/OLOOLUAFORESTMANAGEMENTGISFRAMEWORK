from django.shortcuts import render
from apps.forests.models import Forest
from .models import LULCMap, LULCStatistic
from apps.dashboard.services import get_forest_summary

def lulc_page(request):
    forest = Forest.objects.filter(code=request.GET.get("forest"), status="active").first() if request.GET.get("forest") else Forest.objects.filter(status="active").first()
    maps = LULCMap.objects.filter(forest=forest).prefetch_related("statistics","statistics__lulc_class") if forest else []
    return render(request, "lulc/index.html", {
        "forest": forest,
        "maps": maps,
        "forest_name": forest.name if forest else "Forest workspace",
        "class_count": forest.lulc_classes.count() if forest else 0,
        "map_count": maps.count(),
        "data_status": "Available" if maps.exists() else "Not available",
        "analytics_url": f"/api/analytics/{forest.code}/" if forest else "",
        "transitions_url": f"/api/lulc/transitions/?forest={forest.code}" if forest else "",
        "summary": get_forest_summary(forest) if forest else {},
    })
