import * as api from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    // This function runs as soon as the profile page's HTML is ready
    async function initializeProfilePage() {
        try {
            const user = await api.getUserProfile();
            const usernameField = document.getElementById('profile-username');
            const emailField = document.getElementById('profile-email');

            if (usernameField) {
                usernameField.value = user.username || '';
            }
            if (emailField) {
                emailField.value = user.email || '';
            }
        } catch (error) {
            console.error("Failed to fetch user profile:", error);
        }
    }

    // Only run this logic if we are on the profile page
    if (document.getElementById('profile-username')) {
        initializeProfilePage();
    }
});