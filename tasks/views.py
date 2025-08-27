from django.shortcuts import render
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Task
from .serializers import TaskSerializer
from django.contrib.auth.decorators import login_required

# This is the API View for handling your data
class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.request.user.tasks.all().order_by('order')

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

# This view renders your main Hub page
def hub_view(request):
    return render(request, 'hub.html')

# This view renders your Stride app page
def stride_view(request):
    return render(request, 'stride.html')

@login_required
def profile_view(request):
    return render(request, 'profile.html')