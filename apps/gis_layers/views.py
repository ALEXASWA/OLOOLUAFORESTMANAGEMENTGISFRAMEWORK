import json
from django.conf import settings
from django.shortcuts import render
from apps.forests.models import Forest
from apps.dashboard.services import get_forest_summary

def map_view(request):
    forests = Forest.objects.filter(status="active")
    forest = forests.filter(code=request.GET.get("forest")).first() if request.GET.get("forest") else forests.first()
    return render(request, "gis_layers/map.html", {"forests": forests, "forest": forest, "summary": get_forest_summary(forest) if forest else {}, "basemaps_json": json.dumps(settings.BASEMAPS)})
