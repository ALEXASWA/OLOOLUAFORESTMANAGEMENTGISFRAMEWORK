from .models import Forest


def active_forest(request):
    forests = Forest.objects.filter(status="active").select_related("profile")
    selected = None
    code = request.GET.get("forest")
    if code:
        selected = forests.filter(code=code).first()
    if selected is None:
        selected = forests.first()
    roles = set(request.user.groups.values_list("name", flat=True)) if request.user.is_authenticated else set()
    is_admin = request.user.is_superuser or request.user.is_staff or "ADMINISTRATOR" in roles
    return {
        "active_forest": selected,
        "active_forests": forests,
        "active_forest_name": selected.name if selected else "Forest workspace",
        "can_view_operations": bool(roles & {"ADMINISTRATOR", "GIS ANALYST", "FOREST MANAGER", "FIELD OFFICER"}) or is_admin,
        "can_view_training": bool(roles & {"ADMINISTRATOR", "GIS ANALYST"}) or is_admin,
        "can_view_admin": is_admin,
    }
