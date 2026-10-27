from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand


ROLES = ["ADMINISTRATOR", "GIS ANALYST", "FOREST MANAGER", "FIELD OFFICER", "VIEWER"]


class Command(BaseCommand):
    help = "Create the controlled FM-GDSS role groups used by administrator-managed users."

    def handle(self, *args, **options):
        for role in ROLES:
            Group.objects.get_or_create(name=role)
        self.stdout.write(self.style.SUCCESS(f"Ensured {len(ROLES)} FM-GDSS role groups exist."))