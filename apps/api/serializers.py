from rest_framework_gis.serializers import GeoFeatureModelSerializer
from rest_framework import serializers
from apps.forests.models import Forest, ForestBoundary
from apps.management.models import ManagementZone
from apps.field_data.models import FieldObservation

class ForestSerializer(GeoFeatureModelSerializer):
    extent = serializers.SerializerMethodField()
    centroid = serializers.SerializerMethodField()

    def _analysis_geometry(self, obj):
        return obj.analytical_buffer or obj.geometry

    def get_extent(self, obj):
        geometry = self._analysis_geometry(obj)
        if not geometry:
            return None
        transformed = geometry.transform(4326, clone=True)
        return list(transformed.extent)

    def get_centroid(self, obj):
        geometry = self._analysis_geometry(obj)
        if not geometry:
            return None
        point = geometry.transform(4326, clone=True).centroid
        return [point.x, point.y]

    class Meta:
        model = Forest
        geo_field = "geometry"
        fields = ["id","name","code","country","county","sub_county","management_authority","description","area_ha","status","geometry","extent","centroid"]

class BoundarySerializer(GeoFeatureModelSerializer):
    class Meta:
        model = ForestBoundary
        geo_field = "geometry"
        fields = ["id","forest","source","geometry"]

class ManagementZoneSerializer(GeoFeatureModelSerializer):
    zone_type_name = serializers.CharField(source="zone_type.name", read_only=True)
    class Meta:
        model = ManagementZone
        geo_field = "geometry"
        fields = ["id","forest","code","zone_type","zone_type_name","priority","area_ha","primary_issue","threat_summary","recommendation","data_status","geometry"]
