// This file manages all DOM rendering and UI interactions.

import { state, ALL_ACHIEVEMENTS } from './state.js';

let habitChartInstance = null;
let categoryChartInstance = null;

// --- UTILITY UI FUNCTIONS ---

export function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = page.id === pageId ? 'block' : 'none';
    });
    const quickAddBtn = document.getElementById('quick-add-btn');
    quickAddBtn.style.display = 'block';

    if (pageId === 'dashboard-page') {
        renderDashboard();
        quickAddBtn.style.display = 'none';
    } else if (pageId === 'journal-page') {
        renderJournal();
        quickAddBtn.style.display = 'none';
    } else if (pageId === 'calendar-page') {
        // renderCalendar();
        quickAddBtn.style.display = 'none';
    }
}

export function applyTheme() {
    document.body.classList.toggle('dark-mode', state.settings.theme === 'dark');
}

export function showToast(message) {
    const toast = document.getElementById('toast-notification');
    toast.textContent = message;
    toast.className = "toast show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}

export function openModal(modal) {
    if (modal) modal.style.display = 'flex';
}

export function closeModal(modal) {
    if (modal) modal.style.display = 'none';
}

// --- MAIN RENDER FUNCTIONS ---

export function render() {
    renderHeader();
    renderTasks();
    renderSidebar();
}

export function renderHeader() {
    const headerActions = document.getElementById('header-actions');
    headerActions.innerHTML = `
        <button data-action="show-journal" class="icon-btn" title="Journal"><img src="/static/Icons/JournalIcon.svg" alt="Journal"></button>
        <button data-action="show-dashboard" class="icon-btn" title="Dashboard"><img src="/static/Icons/DashboardIcon.svg" alt="Dashboard"></button>
        <button data-action="show-achievements" class="icon-btn" title="Achievements"><img src="/static/Icons/AwardIcon.svg" alt="Achievements"></button>
        <button data-action="show-filter" class="icon-btn" title="Filter"><img src="/static/Icons/Search Icon.svg" alt="Filter"></button>
        <button data-action="show-stats" class="icon-btn" title="Statistics"><img src="/static/Icons/Statistics icon.svg" alt="Statistics"></button>
        <button data-action="show-settings" class="icon-btn" title="Settings"><img src="/static/Icons/Settingsicon.svg" alt="Settings"></button>
        <button data-action="show-calendar" class="icon-btn" title="Calendar"><img src="/static/Icons/CalendarIcon.svg" alt="Calendar"></button>
        ${state.settings.developerMode ? `<button data-action="show-developer" class="icon-btn" title="Developer Panel">🧑‍💻</button>` : ''}
    `;

    const viewDate = new Date(state.currentDate);
    const today = new Date();
    document.getElementById('header-title').textContent = viewDate.toDateString() === today.toDateString() ? 'Today' : viewDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    document.getElementById('next-day-btn').disabled = viewDate.toDateString() === today.toDateString();
}

export function renderTasks() {
    const taskList = document.getElementById('task-list');
    const viewDate = new Date(state.currentDate);
    const viewDay = viewDate.getDay();
    const { filter } = state.settings;

    const tasksToDisplay = state.tasks
        .filter(task => {
            if (task.archived) return false;
            if (filter.category !== 'all' && task.category !== filter.category) return false;
            if (task.type === 'habit') {
                return task.recurrence.type === 'weekly' || task.recurrence?.days?.includes(viewDay);
            }
            if (task.type === 'task') return new Date(task.createdAt).toDateString() === viewDate.toDateString();
            return false;
        })
        .sort((a, b) => a.order - b.order);

    if (state.tasks.length === 0) {
        taskList.innerHTML = `
            <div class="empty-state-onboarding">
                <div class="onboarding-icon">✨</div>
                <h2>Welcome to BetterHub!</h2>
                <p>It looks like you don't have any habits or tasks set up yet. Click the '+' button below to get started.</p>
                <button class="btn-primary" data-action="onboard-add">Add Your First Habit</button>
            </div>`;
    } else if (tasksToDisplay.length === 0) {
        taskList.innerHTML = `<p class="empty-state">No tasks scheduled for today.</p>`;
    } else {
        taskList.innerHTML = tasksToDisplay.map(task => createTaskElement(task, viewDate)).join('');
    }
}

function createTaskElement(task, viewDate) {
    // ... (This function remains the same, but now uses getWeeklyProgressUI)
    // For brevity, it's omitted, but you would copy the full function here.
    const weeklyProgress = getWeeklyProgressUI(task, viewDate);
    // ... rest of the function
    return `<div>...</div>`; // Placeholder for the actual complex HTML string
}


export function renderSidebar() {
    const sidebar = document.getElementById('overview-sidebar');
    if (!sidebar || state.tasks.length === 0) {
        if (sidebar) sidebar.innerHTML = "";
        return;
    }
    const habits = state.tasks.filter(t => t.type === 'habit' && !t.archived);
    const totalCompletions = habits.reduce((sum, task) => sum + Object.values(task.history || {}).filter(h => h.completed).length, 0);
    const longestOverallStreak = Math.max(0, ...habits.map(t => t.longestStreak || 0));
    const statsHtml = `<div class="sidebar-widget"><h3>Statistics</h3><ul><li><strong>Active Habits:</strong> <span>${habits.length}</span></li><li><strong>Longest Streak:</strong> <span>${longestOverallStreak} Days 🔥</span></li><li><strong>Total Completions:</strong> <span>${totalCompletions}</span></li></ul></div>`;
    const unlocked = state.unlockedAchievements.slice(-3).reverse();
    const achievementsHtml = `<div class="sidebar-widget"><h3>Recent Achievements</h3>${unlocked.length > 0 ? `<ul>${unlocked.map(key => { const ach = ALL_ACHIEVEMENTS[key]; return `<li>${ach.icon} ${ach.name}</li>`; }).join('')}</ul>` : '<p>No achievements unlocked yet.</p>'}</div>`;
    sidebar.innerHTML = statsHtml + achievementsHtml;
}

// ... Add ALL other render... functions here (renderJournal, renderDashboard, charts, etc.)
// ... from your original file.