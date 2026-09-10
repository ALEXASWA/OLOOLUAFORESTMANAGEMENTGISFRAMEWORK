from django.test import TestCase
from .models import Forest, ForestProfile

class ForestModelTests(TestCase):
    def test_forest_can_be_created_without_geometry(self):
        forest = Forest.objects.create(name="Test Forest", code="test-forest")
        ForestProfile.objects.create(forest=forest)
        self.assertEqual(forest.code, "test-forest")
        self.assertEqual(forest.profile.default_year, 2025)
