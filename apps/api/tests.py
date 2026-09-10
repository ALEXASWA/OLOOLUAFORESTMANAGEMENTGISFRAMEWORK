from django.test import TestCase
from rest_framework.test import APIClient
from apps.forests.models import Forest

class ForestApiTests(TestCase):
    def test_forest_list(self):
        Forest.objects.create(name="Test Forest", code="test-forest")
        response = APIClient().get("/api/forests/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["features"][0]["properties"]["code"], "test-forest")
