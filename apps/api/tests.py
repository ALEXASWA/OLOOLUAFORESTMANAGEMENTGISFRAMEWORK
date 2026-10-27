from django.test import TestCase
from django.contrib.gis.geos import MultiPolygon, Polygon
from rest_framework.test import APIClient
from apps.forests.models import Forest

class ForestApiTests(TestCase):
    def test_forest_list(self):
        Forest.objects.create(name="Test Forest", code="test-forest")
        response = APIClient().get("/api/forests/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["features"][0]["properties"]["code"], "test-forest")

    def test_public_analytics_endpoint(self):
        Forest.objects.create(name="Test Forest", code="test-forest")
        response = APIClient().get("/api/analytics/test-forest/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["forest"]["code"], "test-forest")

    def test_public_lulc_endpoint_filters_by_forest(self):
        Forest.objects.create(name="Test Forest", code="test-forest")
        response = APIClient().get("/api/lulc/statistics/?forest=test-forest")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_forest_detail_returns_distinct_extent_for_each_forest(self):
        first = Forest.objects.create(name="First Forest", code="first-forest", geometry=MultiPolygon(Polygon(((0, 0), (100, 0), (100, 100), (0, 0)), srid=32737)))
        second = Forest.objects.create(name="Second Forest", code="second-forest", geometry=MultiPolygon(Polygon(((1000, 1000), (1100, 1000), (1100, 1100), (1000, 1000)), srid=32737)))
        first_extent = APIClient().get(f"/api/forests/{first.code}/").data["properties"]["extent"]
        second_extent = APIClient().get(f"/api/forests/{second.code}/").data["properties"]["extent"]
        self.assertNotEqual(first_extent, second_extent)
