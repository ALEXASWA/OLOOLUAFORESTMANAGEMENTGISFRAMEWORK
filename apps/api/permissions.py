from rest_framework.permissions import BasePermission, SAFE_METHODS


WRITE_ROLES = {"ADMINISTRATOR", "GIS ANALYST"}


class ForestApiPermission(BasePermission):
    """Allow public reads; restrict API mutations to administrator/analyst roles."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or user.is_staff:
            return True
        return user.groups.filter(name__in=WRITE_ROLES).exists()