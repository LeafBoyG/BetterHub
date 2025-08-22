from rest_framework import serializers
from .models import Task

class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
    
        fields = [
            'id', 'name', 'description', 'color', 'task_type', 
            'history', 'recurrence', 'archived', 'order', 'created_at'
        ]