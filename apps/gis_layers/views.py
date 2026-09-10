from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from apps.forests.models import Forest

@login_required
def map_view(request):
    forests = Forest.objects.filter(status="active")
    forest = forests.filter(code=request.GET.get("forest")).first() if request.GET.get("forest") else forests.first()
    return render(request, "gis_layers/map.html", {"forests": forests, "forest": forest})
