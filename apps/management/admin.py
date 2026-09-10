from django.contrib import admin
from .models import ManagementZoneType,ManagementZone,ManagementAction
admin.site.register([ManagementZoneType,ManagementZone,ManagementAction])
