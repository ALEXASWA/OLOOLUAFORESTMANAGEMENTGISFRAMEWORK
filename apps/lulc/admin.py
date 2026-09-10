from django.contrib import admin
from .models import LULCClass,LULCMap,LULCStatistic,LULCTransition,ClassificationAccuracy
admin.site.register([LULCClass,LULCMap,LULCStatistic,LULCTransition,ClassificationAccuracy])
