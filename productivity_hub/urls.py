from django.contrib import admin
from django.urls import path, include
from tasks.views import hub_view, stride_view
from tasks.views import hub_view, stride_view, profile_view

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # API URLs
    path('api/stride/', include('tasks.urls')),
    
    # Djoser Authentication URLs
    path('api/auth/', include('djoser.urls')),
    path('api/auth/', include('djoser.urls.authtoken')),

    # Frontend Page URLs
    path('', hub_view, name='hub'),
    path('stride/', stride_view, name='stride-app'),

    # Profile Page URLs
     path('stride/', stride_view, name='stride-app'),
    path('profile/', profile_view, name='profile')
]