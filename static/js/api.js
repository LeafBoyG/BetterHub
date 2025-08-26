// This file handles all communication with the Django backend API.

const API_URL = '/api/stride/tasks/';

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

// --- Task API Functions ---

export async function getAllTasks() {
    const response = await fetch(API_URL, {
        headers: {
            'Content-Type': 'application/json',
            // ADD THIS LINE: Include the auth token
            'Authorization': `Token ${localStorage.getItem('authToken')}`
        }
    });
    if (!response.ok) {
        // Pass the status code for better error handling in app.js
        const error = new Error('Network response was not ok');
        error.status = response.status;
        throw error;
    }
    return await response.json();
}

export async function createTask(taskData) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken,
            // ADD THIS LINE: Include the auth token
            'Authorization': `Token ${localStorage.getItem('authToken')}`
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
            'X-CSRFToken': csrftoken,
            // ADD THIS LINE: Include the auth token
            'Authorization': `Token ${localStorage.getItem('authToken')}`
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
            'X-CSRFToken': csrftoken,
            // ADD THIS LINE: Include the auth token
            'Authorization': `Token ${localStorage.getItem('authToken')}`
        }
    });
    if (!response.ok) {
        throw new Error('Failed to delete task');
    }
}

// --- Auth API Functions ---

export async function loginUser(username, password) {
    const response = await fetch('/api/auth/token/login/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        },
        body: JSON.stringify({ username, password })
    });
    if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = Object.values(errorData).flat().join(' ');
        throw new Error(errorMessage || 'Login failed.');
    }
    return await response.json();
}

export async function logoutUser() {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    await fetch('/api/auth/token/logout/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${token}`,
            'X-CSRFToken': csrftoken
        }
    });
    // Remove the token regardless of server response
    localStorage.removeItem('authToken');
}

export async function registerUser(username, email, password) {
    const response = await fetch('/api/auth/users/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        },
        body: JSON.stringify({ username, email, password })
    });
    if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = Object.entries(errorData).map(([key, value]) => `${key}: ${value.join(' ')}`).join('\n');
        throw new Error(errorMessage || 'Registration failed.');
    }
    return await response.json();
}
// In static/js/api.js
export async function changePassword(current_password, new_password, re_new_password) {
    const response = await fetch('/api/auth/users/set_password/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken,
            'Authorization': `Token ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ current_password, new_password, re_new_password })
    });
    if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = Object.values(errorData).flat().join(' ');
        throw new Error(errorMessage || 'Password change failed.');
    }
}
// In static/js/api.js

export async function getUserProfile() {
    const response = await fetch('/api/auth/users/me/', {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${localStorage.getItem('authToken')}`
        }
    });
    if (!response.ok) {
        throw new Error('Could not fetch user profile.');
    }
    return await response.json();
}