from django.shortcuts import render
from rest_framework import viewsets
from .models import Task
from .serializers import TaskSerializer

# This is the API View that was missing
class TaskViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows tasks to be viewed or edited.
    """
    queryset = Task.objects.all().order_by('order')
    serializer_class = TaskSerializer

# This view renders our new hub page
def hub_view(request):
    return render(request, 'hub.html')

# This view renders the Stride habit tracker page
def stride_view(request):
    return render(request, 'stride.html')