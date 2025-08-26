import { state, ALL_ACHIEVEMENTS, getTaskById, setEditingTaskId } from './state.js';
import { getWeeklyCompletions, recalculateStreaks } from './actions.js';

let habitChartInstance = null;
let categoryChartInstance = null;

// ===================================================================
// UTILITY UI FUNCTIONS
// ===================================================================

export function showPage(pageId) {
    const pages = {
        'main-page': document.getElementById('main-page'),
        'dashboard-page': document.getElementById('dashboard-page'),
        'journal-page': document.getElementById('journal-page'),
        'calendar-page': document.getElementById('calendar-page'),
        'hub-page': document.querySelector('.hub-grid'),
        'profile-page': document.querySelector('.profile-container'),
    };

    Object.values(pages).forEach(page => {
        if (page) page.style.display = 'none';
    });

    if (pages[pageId]) {
        pages[pageId].style.display = (pageId === 'hub-page' || pageId === 'profile-page') ? 'block' : 'block';
    }

    const quickAddBtn = document.getElementById('quick-add-btn');
    if (quickAddBtn) {
        if (pageId === 'main-page' || window.location.pathname.includes('/stride/')) {
            quickAddBtn.style.display = 'block';
        } else {
            quickAddBtn.style.display = 'none';
        }
    }
    
    if (pageId === 'dashboard-page') {
        renderDashboard();
    } else if (pageId === 'journal-page') {
        renderJournal();
    }
}

export function applyTheme() {
    document.body.classList.toggle('dark-mode', state.settings.theme === 'dark');
}

export function showToast(message) {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;
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

export function playSound(soundFile) {
    if (!state.settings.enableSound) return;
    try { 
        new Audio(`/static/audio/${soundFile}.mp3`).play(); 
    } catch (e) { 
        console.warn("Could not play sound", e); 
    }
}

export function updateNavState() {
    const loggedInNav = document.getElementById('logged-in-nav');
    const loggedOutNav = document.getElementById('logged-out-nav');
    const welcomeMessage = document.getElementById('welcome-message');
    const authToken = localStorage.getItem('authToken');

    if (authToken) {
        if (loggedInNav) loggedInNav.style.display = 'flex';
        if (loggedOutNav) loggedOutNav.style.display = 'none';
        if (welcomeMessage) {
            // In a real app, you would fetch the username from an API endpoint
            // For now, we'll keep it simple.
            welcomeMessage.textContent = `Welcome!`;
        }
    } else {
        if (loggedInNav) loggedInNav.style.display = 'none';
        if (loggedOutNav) loggedOutNav.style.display = 'flex';
    }
}

// ===================================================================
// RENDERING FUNCTIONS
// ===================================================================

export function render() {
    if (document.getElementById('task-list')) {
        renderHeader();
        renderTasks();
        renderSidebar();
    }
    updateNavState(); // Always update nav on any render
}

export function renderHeader() {
    const headerActions = document.getElementById('header-actions');
    if (!headerActions) return;
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
    const headerTitle = document.getElementById('header-title');
    if (headerTitle) {
        headerTitle.textContent = viewDate.toDateString() === today.toDateString() ? 'Today' : viewDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    }
    const nextDayBtn = document.getElementById('next-day-btn');
    if(nextDayBtn) {
        nextDayBtn.disabled = viewDate.toDateString() === today.toDateString();
    }
}

export function renderTasks() {
    const taskList = document.getElementById('task-list');
    if (!taskList) return;
    const viewDate = new Date(state.currentDate);
    const viewDay = viewDate.getDay();
    const { filter } = state.settings;
    const tasksToDisplay = state.tasks
        .filter(task => {
            if (task.archived) return false;
            if (filter.category !== 'all' && task.category !== filter.category) return false;
            if (task.task_type === 'habit') {
                if (!task.recurrence) return false;
                return task.recurrence.type === 'weekly' || task.recurrence.days?.includes(viewDay);
            }
            if (task.task_type === 'task') return new Date(task.createdAt).toDateString() === viewDate.toDateString();
            return false;
        })
        .sort((a, b) => a.order - b.order);
    if (localStorage.getItem('authToken') && state.tasks.length === 0) {
        taskList.innerHTML = `
            <div class="empty-state-onboarding">
                <div class="onboarding-icon">✨</div>
                <h2>Welcome to Stride!</h2>
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
    const dateString = viewDate.toDateString();
    const history = task.history?.[dateString] || {};
    const isNegative = task.nature === 'negative';
    const isPausedToday = task.pause?.active && new Date(task.pause.until) >= new Date(dateString);
    let classes = ['task-item'];
    if (isPausedToday) classes.push('paused');
    let streakDisplay = (task.task_type === 'habit' && task.streak > 0) ? `<div class="streak-display"><img src="/static/Icons/Streak Icon.svg" alt="Streak"><span>${task.streak}</span></div>` : '';
    const noteIndicator = history.note ? `<span class="note-indicator">📝</span>` : '';
    const description = `<p>${task.description || ''}</p>`;
    const title = `<h3 data-action="edit">${task.name}${noteIndicator}</h3>`;
    const editButton = `<button class="edit-task-btn" data-action="edit"><img src="/static/Icons/Edit Icon.svg" alt="Edit"></button>`;
    let trackingUI = '';
    if (isNegative) {
        if (history.failed) classes.push('failed');
        trackingUI = `<div class="task-details">${title}<p>${task.description || 'Goal: Avoid this today.'}</p></div><div class="task-actions">${streakDisplay}<button class="failure-btn" data-action="fail">${history.failed ? 'Undo Slip-up' : 'I Slipped Up'}</button>${editButton}</div>`;
    } else {
        const weeklyProgress = getWeeklyProgressUI(task, viewDate);
        if (weeklyProgress.isComplete) classes.push('week-complete', 'completed');
        else if (history.completed) classes.push('completed');
        switch (task.trackingType) {
            case 'measurable':
                const progress = history.measurableProgress || 0;
                trackingUI = `<div class="task-details-measurable">${title}<div class="measurable-controls"><button class="measurable-btn" data-action="decrement">-</button><span class="measurable-progress">${progress} / ${task.measurableGoal}</span><button class="measurable-btn" data-action="increment">+</button></div>${weeklyProgress.ui}</div>`;
                break;
            case 'timed':
                trackingUI = `<div class="task-details-measurable">${title}<button class="timer-btn" data-action="startTimer">Start ${task.timedGoal} min</button>${weeklyProgress.ui}</div>`;
                break;
            default:
                trackingUI = `<button class="completion-button" data-action="complete"></button><div class="task-details">${title}${description}${weeklyProgress.ui}</div>`;
                break;
        }
        trackingUI += `<div class="task-actions">${streakDisplay}${editButton}</div>`;
    }
    return `<div class="${classes.join(' ')}" draggable="true" style="border-left-color: ${task.color};" data-id="${task.id}">${trackingUI}</div>`;
}

export function renderSidebar() {
    const sidebar = document.getElementById('overview-sidebar');
    if (!sidebar || state.tasks.length === 0) {
        if (sidebar) sidebar.innerHTML = "";
        return;
    }
    const habits = state.tasks.filter(t => t.task_type === 'habit' && !t.archived);
    const totalCompletions = habits.reduce((sum, task) => sum + Object.values(task.history || {}).filter(h => h.completed).length, 0);
    const longestOverallStreak = Math.max(0, ...habits.map(t => t.longestStreak || 0));
    const statsHtml = `<div class="sidebar-widget"><h3>Statistics</h3><ul><li><strong>Active Habits:</strong> <span>${habits.length}</span></li><li><strong>Longest Streak:</strong> <span>${longestOverallStreak} Days 🔥</span></li><li><strong>Total Completions:</strong> <span>${totalCompletions}</span></li></ul></div>`;
    const unlocked = state.unlockedAchievements.slice(-3).reverse();
    const achievementsHtml = `<div class="sidebar-widget"><h3>Recent Achievements</h3>${unlocked.length > 0 ? `<ul>${unlocked.map(key => { const ach = ALL_ACHIEVEMENTS[key]; return `<li>${ach.icon} ${ach.name}</li>`; }).join('')}</ul>` : '<p>No achievements unlocked yet.</p>'}</div>`;
    sidebar.innerHTML = statsHtml + achievementsHtml;
}

export function renderJournal() {
    const timeline = document.getElementById('journal-timeline');
    if (!timeline) return;
    const allNotes = [];
    state.tasks.forEach(task => {
        if(task.history) {
            for (const dateString in task.history) {
                if (task.history[dateString].note) {
                    allNotes.push({
                        taskName: task.name,
                        taskColor: task.color,
                        date: new Date(dateString),
                        note: task.history[dateString].note
                    });
                }
            }
        }
    });
    allNotes.sort((a,b) => b.date - a.date);
    if (allNotes.length > 0) {
        timeline.innerHTML = allNotes.map(entry => `
            <div class="journal-entry" style="border-left-color: ${entry.taskColor};">
                <div class="journal-entry-header">
                    <h4>${entry.taskName}</h4>
                    <span>${entry.date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <p>${entry.note}</p>
            </div>
        `).join('');
    } else {
        timeline.innerHTML = '<p class="empty-state">You haven\'t written any notes yet. Add a note after completing a habit to see it here!</p>';
    }
}

export function renderCategories() {
    const categoryList = document.getElementById('category-list');
    if (!categoryList) return;
    categoryList.innerHTML = state.categories.map(cat => `
        <li class="setting-item">
            <span>${cat}</span>
            <button data-category="${cat}" class="btn-icon-delete"><img src="/static/Icons/DeleteIcon.svg" alt="Delete"></button>
        </li>
    `).join('');
}

export function renderArchivedList() {
    const archivedList = document.getElementById('archived-list');
    if (!archivedList) return;
    const archivedTasks = state.tasks.filter(t => t.archived);
    if (archivedTasks.length > 0) {
        archivedList.innerHTML = archivedTasks.map(task => `
            <li class="setting-item">
                <span>${task.name}</span>
                <button data-id="${task.id}" class="btn-secondary">Unarchive</button>
            </li>
        `).join('');
    } else {
        archivedList.innerHTML = '<li>No archived tasks.</li>';
    }
}

export function renderDashboard() {
    const dashboardPage = document.getElementById('dashboard-page');
    if (!dashboardPage || dashboardPage.style.display === 'none') return;
    renderOverallStats();
    renderCategoryChart();
    renderDashboardStreaks();
    renderHeatmap();
    renderHabitPerformanceChart();
    renderDashboardAchievements();
}

export function renderOverallStats() {
    const statsWidget = document.getElementById('stats-widget');
    if (!statsWidget) return;
    const habits = state.tasks.filter(t => t.task_type === 'habit' && !t.archived && t.nature !== 'negative');
    const totalCompletions = habits.reduce((sum, task) => sum + Object.values(task.history).filter(h => h.completed).length, 0);
    const longestOverallStreak = Math.max(0, ...habits.map(t => t.longestStreak || 0));
    let possibleCompletions = 0;
    habits.forEach(task => {
        const startDate = new Date(task.createdAt);
        let dayIterator = new Date(startDate);
        const today = new Date();
        while(dayIterator <= today) {
            if (task.recurrence.type === 'days' && task.recurrence.days.includes(dayIterator.getDay())) {
                possibleCompletions++;
            }
            dayIterator.setDate(dayIterator.getDate() + 1);
        }
    });
    const overallRate = possibleCompletions > 0 ? Math.round((totalCompletions / possibleCompletions) * 100) : 0;
    statsWidget.innerHTML = `
        <div class="stats-summary"><span class="stat-value">${overallRate}%</span><span class="stat-label">Overall Rate</span></div>
        <div class="stats-summary"><span class="stat-value">${totalCompletions}</span><span class="stat-label">Total Completions</span></div>
        <div class="stats-summary"><span class="stat-value">${longestOverallStreak}</span><span class="stat-label">Longest Streak</span></div>
    `;
}

export function renderCategoryChart() {
    const ctx = document.getElementById('category-chart')?.getContext('2d');
    if (!ctx) return;
    const categoryCounts = state.categories.reduce((acc, cat) => ({...acc, [cat]: 0}), {});
    state.tasks.forEach(task => {
        if (task.category && categoryCounts.hasOwnProperty(task.category)) {
            categoryCounts[task.category]++;
        }
    });
    const labels = Object.keys(categoryCounts);
    const data = Object.values(categoryCounts);
    const colors = ['#818cf8', '#f87171', '#f59e0b', '#4ade80', '#22d3ee', '#d8b4fe'];
    if (categoryChartInstance) categoryChartInstance.destroy();
    categoryChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: labels.map((_, i) => colors[i % colors.length]),
                borderColor: state.settings.theme === 'dark' ? '#334155' : '#ffffff',
                borderWidth: 4,
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { color: getComputedStyle(document.body).getPropertyValue('--text-color') } }
            }
        }
    });
}

export function renderDashboardStreaks() {
    const container = document.getElementById('dashboard-streaks-list');
    if (!container) return;
    const habitsWithStreaks = state.tasks
        .filter(t => t.task_type === 'habit' && !t.archived && t.streak > 0 && t.nature !== 'negative')
        .sort((a, b) => b.streak - a.streak);
    if (habitsWithStreaks.length > 0) {
        container.innerHTML = habitsWithStreaks.map(task => `
            <div class="streak-list-item">
                <span>${task.name}</span>
                <span class="streak-display">${task.streak} 🔥</span>
            </div>
        `).join('');
    } else {
        container.innerHTML = '<p class="empty-state">No active streaks yet. Keep it up!</p>';
    }
}

export function renderHeatmap() {
    const heatmapContainer = document.getElementById('heatmap-container');
    if (!heatmapContainer) return;
    const completionsByDate = {};
    state.tasks.forEach(task => {
        if (task.history) {
            for (const dateString in task.history) {
                if (task.history[dateString].completed) {
                    const formattedDate = new Date(dateString).toISOString().split('T')[0];
                    completionsByDate[formattedDate] = (completionsByDate[formattedDate] || 0) + 1;
                }
            }
        }
    });
    heatmapContainer.innerHTML = '';
    const today = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);
    let dayIterator = new Date(startDate);
    while (dayIterator.getDay() !== 0) { dayIterator.setDate(dayIterator.getDate() - 1); }
    const getLevelForCount = (count) => {
        if (count === 0) return 0; if (count <= 2) return 1; if (count <= 5) return 2; if (count <= 8) return 3; return 4;
    };
    for (let i = 0; i < 371; i++) {
        const currentDate = new Date(dayIterator);
        currentDate.setDate(dayIterator.getDate() + i);
        const dayCell = document.createElement('div');
        if (currentDate > today || currentDate < startDate) {
            dayCell.style.visibility = 'hidden';
        } else {
            const dateString = currentDate.toISOString().split('T')[0];
            const count = completionsByDate[dateString] || 0;
            const level = getLevelForCount(count);
            dayCell.className = `heatmap-day level-${level}`;
            dayCell.dataset.tooltip = `${currentDate.toLocaleDateString()}: ${count} completions`;
        }
        heatmapContainer.appendChild(dayCell);
    }
}

export function renderHabitPerformanceChart(taskId = null) {
    const habitSelect = document.getElementById('habit-select');
    if (!habitSelect) return;
    const habits = state.tasks.filter(t => t.task_type === 'habit' && !t.archived && t.nature !== 'negative');
    const currentSelectedValue = habitSelect.value;
    habitSelect.innerHTML = '<option value="">-- Select a Habit --</option>';
    habits.forEach(habit => {
        habitSelect.innerHTML += `<option value="${habit.id}">${habit.name}</option>`;
    });
    habitSelect.value = currentSelectedValue;
    const canvas = document.getElementById('habit-performance-chart');
    if (habitChartInstance) habitChartInstance.destroy();
    if (!taskId) return;
    const task = habits.find(h => h.id === parseInt(taskId));
    if (!task) return;
    const labels = [];
    const data = [];
    const goalData = [];
    for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        labels.push(date);
        const historyEntry = task.history ? task.history[date.toDateString()] : null;
        if (task.trackingType === 'measurable') {
            data.push(historyEntry ? historyEntry.measurableProgress || 0 : 0);
            goalData.push(task.measurableGoal);
        } else {
            data.push(historyEntry && historyEntry.completed ? 1 : 0);
        }
    }
    const ctx = canvas.getContext('2d');
    const textColor = getComputedStyle(document.body).getPropertyValue('--text-color');
    habitChartInstance = new Chart(ctx, {
        type: task.trackingType === 'measurable' ? 'line' : 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: task.name, data: data, borderColor: task.color, backgroundColor: `${task.color}80`, tension: 0.1
            },
            ...(task.trackingType === 'measurable' ? [{
                label: 'Goal', data: goalData, borderColor: '#94a3b8', backgroundColor: '#94a3b8', borderDash: [5, 5], pointRadius: 0
            }] : [])]
        },
        options: {
            scales: {
                x: { type: 'time', time: { unit: 'day' }, ticks: { color: textColor } },
                y: { beginAtZero: true, max: task.trackingType === 'completion' ? 1 : undefined, ticks: { color: textColor } }
            },
            plugins: { legend: { labels: { color: textColor } } }
        }
    });
}

export function renderDashboardAchievements() {
    const container = document.getElementById('dashboard-achievements-list');
    if (!container) return;
    const unlocked = state.unlockedAchievements.slice(-5).reverse();
    if (unlocked.length > 0) {
        container.innerHTML = unlocked.map(key => {
            const ach = ALL_ACHIEVEMENTS[key];
            return `<div class="achievement-item unlocked"><div class="icon">${ach.icon}</div><div><h4>${ach.name}</h4><p>${ach.desc}</p></div></div>`;
        }).join('');
    } else {
        container.innerHTML = '<p class="empty-state">Unlock your first achievement by completing a task!</p>';
    }
}

export function renderAchievements() {
    const achievementsList = document.getElementById('achievements-list');
    if (!achievementsList) return;
    achievementsList.innerHTML = Object.entries(ALL_ACHIEVEMENTS).map(([key, ach]) => {
        const isUnlocked = state.unlockedAchievements.includes(key);
        return `<div class="achievement-item ${isUnlocked ? 'unlocked' : ''}"><div class="icon">${ach.icon}</div><h4>${ach.name}</h4><p>${ach.desc}</p></div>`;
    }).join('');
}

export function renderStatistics() {
    const statsList = document.getElementById('stats-list');
    if (!statsList) return;
    const habits = state.tasks.filter(t => t.task_type === 'habit' && !t.archived && t.nature !== 'negative');
    const totalCompletions = habits.reduce((sum, task) => sum + Object.values(task.history).filter(h => h.completed).length, 0);
    
    let possibleCompletions30Days = 0; let actualCompletions30Days = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dayOfWeek = date.getDay();
        habits.forEach(task => {
            if (task.recurrence.type === 'days' && task.recurrence.days.includes(dayOfWeek)) {
                possibleCompletions30Days++;
                if (task.history[date.toDateString()]?.completed) actualCompletions30Days++;
            }
        });
    }
    const completionRate = possibleCompletions30Days > 0 ? Math.round((actualCompletions30Days / possibleCompletions30Days) * 100) : 0;
    
    document.getElementById('stats-total-habits').textContent = habits.length;
    document.getElementById('stats-total-completions').textContent = totalCompletions;
    document.getElementById('stats-completion-rate').textContent = `${completionRate}%`;
    
    statsList.innerHTML = habits.length > 0 ? habits.map(task => {
        const taskCompletions = Object.values(task.history).filter(h => h.completed).length;
        if (task.recurrence.type === 'days') recalculateStreaks(task);
        return `
            <div class="stats-habit-card">
                <div class="stats-card-header"><h4>${task.name}</h4><button class="edit-task-btn" data-action="edit" data-id="${task.id}"><img src="/static/Icons/Edit Icon.svg" alt="Edit"></button></div>
                <div class="stats-habit-card-grid">
                    <div class="card-stat"><span>🔥 Current Streak</span><b>${task.recurrence.type === 'weekly' ? 'N/A' : task.streak}</b></div>
                    <div class="card-stat"><span>🏆 Longest Streak</span><b>${task.recurrence.type === 'weekly' ? 'N/A' : task.longestStreak || 0}</b></div>
                    <div class="card-stat"><span>✅ Total Completions</span><b>${taskCompletions}</b></div>
                </div>
            </div>`;
    }).join('') : '<p class="empty-state">No habits to show stats for.</p>';
}

export function openTaskModal(id = null) {
    setEditingTaskId(id);
    const task = id ? getTaskById(id) : { recurrence: { type: 'days', days: [] }, color: '#5e72e4' };
    
    document.getElementById('modal-title').innerText = id ? 'Edit Habit' : 'New Habit';
    document.getElementById('task-name').value = task.name || '';
    document.getElementById('task-desc').value = task.description || '';
    
    const taskTypeSelect = document.getElementById('task-type');
    taskTypeSelect.value = task.task_type || 'habit';
    
    document.getElementById('task-color').value = task.color;
    
    const taskCategorySelect = document.getElementById('task-category');
    taskCategorySelect.innerHTML = state.categories.map(c => `<option value="${c}">${c}</option>`).join('');
    taskCategorySelect.value = task.category || state.categories[0] || '';
    
    const trackingTypeSelect = document.getElementById('task-tracking-type');
    trackingTypeSelect.value = task.trackingType || 'completion';
    
    document.getElementById('measurable-options').style.display = trackingTypeSelect.value === 'measurable' ? 'flex' : 'none';
    document.getElementById('timed-options').style.display = trackingTypeSelect.value === 'timed' ? 'flex' : 'none';
    document.getElementById('task-measurable-goal').value = task.measurableGoal || '';
    document.getElementById('task-timed-goal').value = task.timedGoal || '';
    
    const isHabit = taskTypeSelect.value === 'habit';
    document.getElementById('habit-nature-options').style.display = isHabit ? 'block' : 'none';
    document.getElementById('habit-nature').value = task.nature || 'positive';
    
    const pauseOptions = document.getElementById('pause-options');
    if (id && isHabit) {
        pauseOptions.style.display = 'block';
        const isPaused = task.pause?.active || false;
        document.getElementById('pause-toggle').checked = isPaused;
        document.getElementById('pause-until-container').style.display = isPaused ? 'flex' : 'none';
        if (isPaused) document.getElementById('pause-until-input').value = task.pause.until;
    } else {
        pauseOptions.style.display = 'none';
    }
    
    document.getElementById('recurrence-options').style.display = isHabit ? 'block' : 'none';
    const recurrenceTypeSelect = document.getElementById('recurrence-type');
    const daysOptions = document.getElementById('habit-days-options');
    const weeklyOptions = document.getElementById('weekly-options');

    if (task.recurrence?.type === 'weekly') {
        recurrenceTypeSelect.value = 'weekly';
        daysOptions.style.display = 'none';
        weeklyOptions.style.display = 'block';
        document.getElementById('task-weekly-goal').value = task.recurrence.timesPerWeek || '';
    } else {
        recurrenceTypeSelect.value = 'days';
        daysOptions.style.display = 'block';
        weeklyOptions.style.display = 'none';
        document.querySelectorAll('#habit-days button').forEach(btn => {
            btn.classList.toggle('active', !!task.recurrence?.days?.includes(parseInt(btn.dataset.day)));
        });
    }
    
    document.getElementById('delete-task-btn').style.display = id ? 'inline-block' : 'none';
    document.getElementById('archive-task-btn').style.display = id ? 'inline-block' : 'none';
    
    openModal(document.getElementById('task-modal'));
}

export function openNotePromptModal(id, dateString) {
    const task = getTaskById(id);
    if (!task) return;
    document.getElementById('prompt-task-id').value = id;
    document.getElementById('prompt-date-string').value = dateString;
    document.getElementById('prompt-note-input').value = task.history?.[dateString]?.note || '';
    openModal(document.getElementById('note-prompt-modal'));
}

export function openSettingsModal() {
    document.getElementById('theme-toggle').checked = state.settings.theme === 'dark';
    document.getElementById('sound-toggle').checked = state.settings.enableSound;
    document.getElementById('vacation-toggle').checked = state.settings.vacationMode.active;
    document.getElementById('vacation-dates').style.display = state.settings.vacationMode.active ? 'flex' : 'none';
    document.getElementById('vacation-start').value = state.settings.vacationMode.start || '';
    document.getElementById('vacation-end').value = state.settings.vacationMode.end || '';
    renderCategories();
    renderArchivedList();
    openModal(document.getElementById('settings-modal'));
}

export function openFilterModal() {
    const filterCategorySelect = document.getElementById('filter-category');
    const categories = ['all', ...state.categories];
    filterCategorySelect.innerHTML = categories.map(cat => `<option value="${cat}">${cat === 'all' ? 'All Categories' : cat}</option>`).join('');
    filterCategorySelect.value = state.settings.filter.category;
    openModal(document.getElementById('filter-modal'));
}

export function openDeveloperModal() {
    document.getElementById('developer-state-view').textContent = JSON.stringify(state, null, 2);
    openModal(document.getElementById('developer-modal'));
}

// ===================================================================
// UI HELPER FUNCTIONS
// ===================================================================

function getWeeklyProgressUI(task, viewDate) {
    if (task.recurrence?.type !== 'weekly' || !task.recurrence.timesPerWeek) return { ui: '', isComplete: false };
    const weeklyCompletions = getWeeklyCompletions(task, viewDate);
    const weeklyGoal = task.recurrence.timesPerWeek;
    const isComplete = weeklyCompletions >= weeklyGoal;
    const ui = `<div class="weekly-progress">[ ${weeklyCompletions} / ${weeklyGoal} ]</div>`;
    return { ui, isComplete };
}