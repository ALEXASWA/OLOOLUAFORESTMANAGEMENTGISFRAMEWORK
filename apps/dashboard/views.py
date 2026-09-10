from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from apps.forests.models import Forest

@login_required
def dashboard(request):
    forests = Forest.objects.filter(status="active")
    selected = forests.first()
    code = request.GET.get("forest")
    if code:
        selected = forests.filter(code=code).first() or selected
    return render(request, "dashboard/index.html", {"forests": forests, "forest": selected})
