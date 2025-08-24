from django.contrib import admin
from django.urls import path, include
from tasks.views import hub_view, stride_view

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # API URLs
    path('api/stride/', include('tasks.urls')),

    # Frontend Page URLs
    path('', hub_view, name='hub'),
    path('stride/', stride_view, name='stride-app'),
]