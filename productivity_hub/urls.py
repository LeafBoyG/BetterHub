# productivity_hub/urls.py
from django.contrib import admin
from django.urls import path, include
from tasks.views import home_view

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('tasks.urls')),  # This line connects our app's API URLs
    path('', home_view, name='home'), # This serves the main HTML page
]