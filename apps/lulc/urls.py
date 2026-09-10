from django.urls import path
from .views import lulc_page
urlpatterns = [path("", lulc_page, name="lulc")]
