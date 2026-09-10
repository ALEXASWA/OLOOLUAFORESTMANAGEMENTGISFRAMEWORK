from django.contrib import admin
from .models import RasterLayer, VectorLayer
admin.site.register([RasterLayer, VectorLayer])
