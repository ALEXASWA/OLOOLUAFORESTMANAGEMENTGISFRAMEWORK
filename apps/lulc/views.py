from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from apps.forests.models import Forest
from .models import LULCMap, LULCStatistic

@login_required
def lulc_page(request):
    forest = Forest.objects.filter(code=request.GET.get("forest")).first() if request.GET.get("forest") else Forest.objects.first()
    maps = LULCMap.objects.filter(forest=forest).prefetch_related("statistics","statistics__lulc_class") if forest else []
    return render(request, "lulc/index.html", {"forest": forest, "maps": maps})
