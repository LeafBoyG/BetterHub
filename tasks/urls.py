from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TaskViewSet

# Create a router and register our viewset with it.
router = DefaultRouter()
router.register(r'tasks', TaskViewSet, basename='task')

# The urlpatterns list is now created from the router.
urlpatterns = [
    path('', include(router.urls)),
]