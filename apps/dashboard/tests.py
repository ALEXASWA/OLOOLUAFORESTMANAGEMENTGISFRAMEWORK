from django.contrib.auth.models import Group, User
from django.test import TestCase


class DashboardRoleTests(TestCase):
    def setUp(self):
        self.client.defaults["HTTP_HOST"] = "localhost"
        for role in ("ADMINISTRATOR", "GIS ANALYST", "FOREST MANAGER", "FIELD OFFICER", "VIEWER"):
            group = Group.objects.create(name=role)
            user = User.objects.create_user(username=role.lower().replace(" ", "-"), password="test-pass-123")
            user.groups.add(group)

    def test_public_pages_have_no_signup_and_controlled_pages_redirect(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, "Sign Up")
        self.assertNotContains(response, "Create account")
        self.assertEqual(self.client.get("/monitoring/").status_code, 302)
        self.assertEqual(self.client.get("/training/").status_code, 302)

    def test_role_route_access(self):
        expected = {
            "administrator": (200, 200),
            "gis-analyst": (302, 200),
            "forest-manager": (200, 302),
            "field-officer": (200, 302),
            "viewer": (302, 302),
        }
        for username, (monitoring_status, training_status) in expected.items():
            self.client.login(username=username, password="test-pass-123")
            self.assertEqual(self.client.get("/monitoring/").status_code, monitoring_status)
            self.assertEqual(self.client.get("/training/").status_code, training_status)
            self.client.logout()