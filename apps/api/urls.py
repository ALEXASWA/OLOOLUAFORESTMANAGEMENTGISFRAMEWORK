from rest_framework.routers import DefaultRouter
from .views import ForestViewSet, BoundaryViewSet, ManagementZoneViewSet
router = DefaultRouter()
router.register("forests", ForestViewSet, basename="forest")
router.register("boundaries", BoundaryViewSet, basename="boundary")
router.register("management-zones", ManagementZoneViewSet, basename="management-zone")
urlpatterns = router.urls
