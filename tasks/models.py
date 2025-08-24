
from django.db import models
from django.contrib.auth.models import User # Import the User model

class Task(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    color = models.CharField(max_length=7, default="#5e72e4")
    task_type = models.CharField(max_length=10, default="habit") 
    
    # Using JSONField for nested data
    history = models.JSONField(default=dict) 
    recurrence = models.JSONField(default=dict)
    
  
    archived = models.BooleanField(default=False)
    order = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name