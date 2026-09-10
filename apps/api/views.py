from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from apps.forests.models import Forest, ForestBoundary
from apps.management.models import ManagementZone
from .serializers import ForestSerializer, BoundarySerializer, ManagementZoneSerializer

class ForestViewSet(viewsets.ModelViewSet):
    queryset = Forest.objects.all()
    serializer_class = ForestSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    lookup_field = "code"

class BoundaryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ForestBoundary.objects.select_related("forest")
    serializer_class = BoundarySerializer

class ManagementZoneViewSet(viewsets.ModelViewSet):
    queryset = ManagementZone.objects.select_related("forest","zone_type")
    serializer_class = ManagementZoneSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
