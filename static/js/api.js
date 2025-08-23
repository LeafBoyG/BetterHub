// This file handles all communication with the Django backend API.

const API_URL = '/api/tasks/';

// Helper to get the CSRF token from cookies for secure requests
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
const csrftoken = getCookie('csrftoken');

// --- API Functions ---

export async function getAllTasks() {
    const response = await fetch(API_URL);
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return await response.json();
}

export async function createTask(taskData) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        },
        body: JSON.stringify(taskData)
    });
    if (!response.ok) {
        throw new Error('Failed to create task');
    }
    return await response.json();
}

export async function updateTask(taskId, taskData) {
    const response = await fetch(`${API_URL}${taskId}/`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        },
        body: JSON.stringify(taskData)
    });
    if (!response.ok) {
        throw new Error('Failed to update task');
    }
    return await response.json();
}

export async function deleteTask(taskId) {
    const response = await fetch(`${API_URL}${taskId}/`, {
        method: 'DELETE',
        headers: {
            'X-CSRFToken': csrftoken
        }
    });
    if (!response.ok) {
        throw new Error('Failed to delete task');
    }
}