import * as api from './api.js';
document.addEventListener('DOMContentLoaded', () => {

    class HabitTrackerApp {
        constructor() {
            // --- CONSTANTS ---
            this.ALL_ACHIEVEMENTS = {
                FIRST_STEP: { name: 'First Step', desc: 'Complete your very first task.', icon: '👟' },
                STREAK_STARTER: { name: 'Streak Starter', desc: 'Achieve a 3-day streak.', icon: '🔥' },
                WEEKLY_WARRIOR: { name: 'Weekly Warrior', desc: 'Achieve a 7-day streak.', icon: '🗓️' },
                MONTHLY_MASTER: { name: 'Monthly Master', desc: 'Achieve a 30-day streak.', icon: '📅' },
                DEDICATED: { name: 'Dedicated', desc: 'Log 50 total completions.', icon: '🎯' },
                COMMITTED: { name: 'Committed', desc: 'Log 100 total completions.', icon: '💯' },
            };

            // --- STATE & GLOBAL VARS ---
            this.habitChartInstance = null;
            this.categoryChartInstance = null;
            this.draggedItem = null;
            this.state = {
                tasks: [],
                categories: ['Fitness', 'Work', 'Self-Care', 'Home'],
                currentDate: new Date().toDateString(),
                settings: {
                    theme: 'light',
                    enableSound: true,
                    vacationMode: { active: false, start: null, end: null },
                    filter: { category: 'all' },
                    developerMode: false,
                },
                unlockedAchievements: [],
                editingTaskId: null,
                timer: { interval: null, taskId: null, endTime: null },
            };

            // --- CENTRALIZED DOM SELECTORS ---
            this.dom = {
                body: document.body,
                mainPage: document.getElementById('main-page'),
                journalPage: document.getElementById('journal-page'),
                dashboardPage: document.getElementById('dashboard-page'),
                calendarPage: document.getElementById('calendar-page'),
                taskList: document.getElementById('task-list'),
                headerTitle: document.getElementById('header-title'),
                toast: document.getElementById('toast-notification'),
                sidebar: document.getElementById('overview-sidebar'),
                headerActions: document.getElementById('header-actions'),
                quickAddBtn: document.getElementById('quick-add-btn'),
                modals: {
                    task: document.getElementById('task-modal'),
                    settings: document.getElementById('settings-modal'),
                    filter: document.getElementById('filter-modal'),
                    stats: document.getElementById('stats-modal'),
                    notePrompt: document.getElementById('note-prompt-modal'),
                    achievements: document.getElementById('achievements-modal'),
                    timer: document.getElementById('timer-modal'),
                    developer: document.getElementById('developer-modal'),
                }
            };

            this.init();
        }

        // ===================================================================
        // INITIALIZATION & EVENT HANDLING
        // ===================================================================

     
async init() {
    // this.loadState(); // We no longer need to load from localStorage
    this.state.tasks = await api.getAllTasks(); // Fetch tasks from the server
    this.applyTheme();
    this.setupEventListeners();
    this.showPage('main-page');
    this.render();
    this.registerServiceWorker();
}

        setupEventListeners() {
            this.dom.body.addEventListener('click', this.handleGlobalClick.bind(this));
            this.dom.taskList.addEventListener('click', this.handleTaskListClick.bind(this));
            
            this.dom.modals.task.addEventListener('change', this.handleTaskModalChange.bind(this));
            this.dom.modals.settings.addEventListener('click', this.handleSettingsClick.bind(this));
            this.dom.modals.stats.addEventListener('click', this.handleStatsModalClick.bind(this));
            this.dom.modals.developer.addEventListener('click', this.handleDeveloperModalClick.bind(this));
            
            this.dom.taskList.addEventListener('dragstart', this.onDragStart.bind(this));
            this.dom.taskList.addEventListener('dragend', this.onDragEnd.bind(this));
            this.dom.taskList.addEventListener('dragover', this.onDragOver.bind(this));
            this.dom.taskList.addEventListener('drop', this.onDrop.bind(this));

            document.getElementById('habit-select')?.addEventListener('change', (e) => this.renderHabitPerformanceChart(e.target.value));
            document.getElementById('import-data-input').addEventListener('change', this.importData.bind(this));
        }
        
        handleGlobalClick(e) {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            const simpleActions = {
                'onboard-add': () => this.openTaskModal(),
                'quick-add': () => this.openTaskModal(),
                'change-day-prev': () => this.changeDay(-1),
                'change-day-next': () => this.changeDay(1),
                'show-journal': () => this.showPage('journal-page'),
                'show-dashboard': () => this.showPage('dashboard-page'),
                'show-calendar': () => this.showPage('calendar-page'),
                'show-main': () => this.showPage('main-page'),
                'show-achievements': () => { this.renderAchievements(); this.openModal(this.dom.modals.achievements); },
                'show-filter': () => this.openFilterModal(),
                'show-stats': () => { this.renderStatistics(); this.openModal(this.dom.modals.stats); },
                'show-settings': () => this.openSettingsModal(),
                'show-developer': () => this.openDeveloperModal(),
                'save-task': () => this.saveTask(),
                'delete-task': () => this.deleteTask(),
                'archive-task': () => this.archiveTask(),
                'cancel-task': () => this.closeModal(this.dom.modals.task),
                'save-prompt-note': () => this.savePromptNote(),
                'cancel-prompt-note': () => this.closeModal(this.dom.modals.notePrompt),
                'close-settings': () => this.closeModal(this.dom.modals.settings),
                'close-achievements': () => this.closeModal(this.dom.modals.achievements),
                'apply-filter': () => {
                    this.state.settings.filter.category = document.getElementById('filter-category').value;
                    this.saveState();
                    this.render();
                    this.closeModal(this.dom.modals.filter);
                },
                'close-stats': () => this.closeModal(this.dom.modals.stats),
                'cancel-timer': () => this.cancelTimer(),
                'export-data': () => this.exportData(),
                'add-category': () => this.addCategory(),
                'close-developer': () => this.closeModal(this.dom.modals.developer),
                'toggle-day': (e) => e.target.classList.toggle('active'),
            };

            if (simpleActions[action]) {
                simpleActions[action](e);
            }
        }
        
        handleTaskListClick(e) {
            const actionTarget = e.target.closest('[data-action]');
            if (!actionTarget) return;

            const taskItem = e.target.closest('.task-item');
            if (!taskItem) return;
            
            if (taskItem.classList.contains('paused') && actionTarget.dataset.action !== 'edit') return;

            const id = parseInt(taskItem.dataset.id);
            const action = actionTarget.dataset.action;
            const task = this.getTaskById(id);
            if (!task) return;

            let history = task.history?.[this.state.currentDate] || { completed: false, measurableProgress: 0 };
            
            switch (action) {
                case 'edit':
                    this.openTaskModal(id);
                    break;
                case 'complete':
                    this.completeTask(id, this.state.currentDate, !history.completed);
                    break;
                case 'fail':
                    this.failTask(id, this.state.currentDate, history.failed);
                    break;
                case 'increment':
                    history.measurableProgress = (history.measurableProgress || 0) + 1;
                    this.updateTaskHistory(id, this.state.currentDate, history);
                    if (history.measurableProgress >= task.measurableGoal && !history.completed) {
                        this.completeTask(id, this.state.currentDate, true);
                    } else {
                        this.render();
                    }
                    break;
                case 'decrement':
                    history.measurableProgress = Math.max(0, (history.measurableProgress || 0) - 1);
                    this.updateTaskHistory(id, this.state.currentDate, history);
                    if (history.measurableProgress < task.measurableGoal && history.completed) {
                        this.completeTask(id, this.state.currentDate, false);
                    } else {
                        this.render();
                    }
                    break;
                case 'startTimer':
                    this.startTimer(id, task.timedGoal);
                    break;
            }
        }

        handleTaskModalChange(e) {
            const target = e.target;
            const isHabit = document.getElementById('task-type').value === 'habit';
            
            if (target.id === 'task-type') {
                document.getElementById('recurrence-options').style.display = isHabit ? 'block' : 'none';
                document.getElementById('habit-nature-options').style.display = isHabit ? 'block' : 'none';
            }
            if (target.id === 'task-tracking-type') {
                document.getElementById('measurable-options').style.display = target.value === 'measurable' ? 'flex' : 'none';
                document.getElementById('timed-options').style.display = target.value === 'timed' ? 'flex' : 'none';
            }
            if (target.id === 'recurrence-type') {
                document.getElementById('habit-days-options').style.display = target.value === 'days' ? 'block' : 'none';
                document.getElementById('weekly-options').style.display = target.value === 'weekly' ? 'block' : 'none';
            }
            if (target.id === 'pause-toggle') {
                document.getElementById('pause-until-container').style.display = target.checked ? 'flex' : 'none';
                if (!target.checked) document.getElementById('pause-until-input').value = '';
            }
        }
        
        handleSettingsClick(e) {
            const target = e.target;
            const unarchiveButton = target.closest('[data-id][class*="btn"]');
            const deleteCategoryButton = target.closest('.btn-icon-delete');

            if (target.id === 'theme-toggle') {
                this.state.settings.theme = target.checked ? 'dark' : 'light';
                this.applyTheme();
                this.saveState();
            } else if (target.id === 'sound-toggle') {
                this.state.settings.enableSound = target.checked;
                this.saveState();
            } else if (target.id === 'vacation-toggle') {
                this.state.settings.vacationMode.active = target.checked;
                document.getElementById('vacation-dates').style.display = target.checked ? 'flex' : 'none';
                this.saveState();
            } else if (target.id === 'vacation-start' || target.id === 'vacation-end') {
                this.state.settings.vacationMode[target.id.split('-')[1]] = target.value;
                this.saveState();
            } else if (unarchiveButton && unarchiveButton.closest('#archived-list')) {
                this.unarchiveTask(parseInt(unarchiveButton.dataset.id));
            } else if (deleteCategoryButton) {
                this.deleteCategory(deleteCategoryButton.dataset.category);
            }
        }
        
        handleStatsModalClick(e) {
            const editButton = e.target.closest('[data-action="edit"]');
            if (editButton) {
                const id = parseInt(editButton.dataset.id);
                this.closeModal(this.dom.modals.stats);
                this.openTaskModal(id);
            }
        }
        
        handleDeveloperModalClick(e) {
            const action = e.target.dataset.action;
            if (!action) return;

            const actions = {
                'dev-recalculate-streaks': () => {
                    this.state.tasks.forEach(t => this.recalculateStreaks(t));
                    this.saveState();
                    this.showToast("All streaks recalculated.");
                },
                'dev-check-achievements': () => {
                    this.checkAchievements();
                    this.showToast("Achievement check complete.");
                },
                'dev-unlock-achievements': () => {
                    this.state.unlockedAchievements = Object.keys(this.ALL_ACHIEVEMENTS);
                    this.saveState();
                    this.showToast("All achievements unlocked.");
                },
                'dev-reset-app': () => {
                    if (confirm("DANGER: This will permanently delete all data. Are you sure?")) {
                        localStorage.clear();
                        location.reload();
                    }
                },
            };
            if (actions[action]) actions[action]();
            document.getElementById('developer-state-view').textContent = JSON.stringify(this.state, null, 2);
        }

        // ===================================================================
        // STATE & DATA MANAGEMENT
        // ===================================================================

     async completeTask(id, dateString, isComplete) {
    const task = this.getTaskById(id);
    if (!task) return;

    // Update the task's history in the local state first for a snappy UI
    this.updateTaskHistory(id, dateString, { completed: isComplete });

    if (task.type === 'habit' && task.recurrence.type === 'days') {
        this.recalculateStreaks(task);
    }

    // Now, send the updated task object to the server to be saved
    try {
        await apiUpdateTask(task.id, task);
    } catch (error) {
        console.error("Failed to save task update to server:", error);
        // Optionally, you could add logic here to revert the change in the UI
    }

    // The rest of the function remains the same
    this.playSound(isComplete ? 'complete' : 'uncomplete');
    this.render(); // Re-render the UI with the new state

    // Note: We no longer call this.saveState() because the state is saved via the API call.
}
      /**
 * Loads the initial state by fetching all tasks from the server.
 * This method should be called from an async context, like an async init() method.
 */
async loadState() {
    try {
        // Fetch all tasks from the API and place them in the state
        this.state.tasks = await apiGetAllTasks();
        console.log("State loaded from server:", this.state.tasks);
    } catch (error) {
        console.error("Failed to load state from server:", error);
        // Keep the local tasks array empty so the app doesn't crash
        this.state.tasks = [];
    }

    // You can still load settings from localStorage as they are browser-specific
    const savedSettings = localStorage.getItem('habitTrackerSettings');
    if (savedSettings) {
        this.state.settings = { ...this.state.settings, ...JSON.parse(savedSettings) };
    }
}

        // ===================================================================
        // RENDERING METHODS
        // ===================================================================

        render() {
            this.renderHeader();
            this.renderTasks();
            this.renderSidebar();
        }

        renderHeader() {
            this.dom.headerActions.innerHTML = `
                <button data-action="show-journal" class="icon-btn" title="Journal"><img src="/static/Icons/JournalIcon.svg" alt="Journal"></button>
                <button data-action="show-dashboard" class="icon-btn" title="Dashboard"><img src="/static/Icons/DashboardIcon.svg" alt="Dashboard"></button>
                <button data-action="show-achievements" class="icon-btn" title="Achievements"><img src="/static/Icons/AwardIcon.svg" alt="Achievements"></button>
                <button data-action="show-filter" class="icon-btn" title="Filter"><img src="/static/Icons/Search Icon.svg" alt="Filter"></button>
                <button data-action="show-stats" class="icon-btn" title="Statistics"><img src="/static/Icons/Statistics icon.svg" alt="Statistics"></button>
                <button data-action="show-settings" class="icon-btn" title="Settings"><img src="/static/Icons/Settingsicon.svg" alt="Settings"></button>
                <button data-action="show-calendar" class="icon-btn" title="Calendar"><img src="/static/Icons/CalendarIcon.svg" alt="Calendar"></button>
                ${this.state.settings.developerMode ? `<button data-action="show-developer" class="icon-btn" title="Developer Panel">🧑‍💻</button>` : ''}
            `;
            
            const viewDate = new Date(this.state.currentDate);
            const today = new Date();
            this.dom.headerTitle.textContent = viewDate.toDateString() === today.toDateString() ? 'Today' : viewDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
            document.getElementById('next-day-btn').disabled = viewDate.toDateString() === today.toDateString();
        }

        renderTasks() {
            const viewDate = new Date(this.state.currentDate);
            const viewDay = viewDate.getDay();
            const { filter } = this.state.settings;

            const tasksToDisplay = this.state.tasks
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

            if (this.state.tasks.length === 0) {
                this.dom.taskList.innerHTML = `
                    <div class="empty-state-onboarding">
                        <div class="onboarding-icon">✨</div>
                        <h2>Welcome to Stride!</h2>
                        <p>It looks like you don't have any habits or tasks set up yet. Click the '+' button below to get started.</p>
                        <button class="btn-primary" data-action="onboard-add">Add Your First Habit</button>
                    </div>`;
            } else if (tasksToDisplay.length === 0) {
                this.dom.taskList.innerHTML = `<p class="empty-state">No tasks scheduled for today.</p>`;
            } else {
                this.dom.taskList.innerHTML = tasksToDisplay.map(task => this.createTaskElement(task, viewDate)).join('');
            }
        }

        createTaskElement(task, viewDate) {
            const dateString = viewDate.toDateString();
            const history = task.history?.[dateString] || {};
            const isNegative = task.nature === 'negative';
            const isPausedToday = task.pause?.active && new Date(task.pause.until) >= new Date(dateString);

            let classes = ['task-item'];
            if (isPausedToday) classes.push('paused');
            
            let streakDisplay = '';
            if (task.type === 'habit' && task.streak > 0) {
                streakDisplay = `<div class="streak-display"><img src="/static/Icons/Streak Icon.svg" alt="Streak"><span>${task.streak}</span></div>`;
            }

            const noteIndicator = history.note ? `<span class="note-indicator">📝</span>` : '';
            const description = `<p>${task.description || ''}</p>`;
            const title = `<h3 data-action="edit">${task.name}${noteIndicator}</h3>`;
            const editButton = `<button class="edit-task-btn" data-action="edit"><img src="/static/Icons/Edit Icon.svg" alt="Edit"></button>`;

            let trackingUI = '';
            
            if (isNegative) {
                if (history.failed) classes.push('failed');
                trackingUI = `
                    <div class="task-details">
                        ${title}
                        <p>${task.description || 'Goal: Avoid this today.'}</p>
                    </div>
                    <div class="task-actions">
                        ${streakDisplay}
                        <button class="failure-btn" data-action="fail">${history.failed ? 'Undo Slip-up' : 'I Slipped Up'}</button>
                        ${editButton}
                    </div>`;
            } else {
                const weeklyProgress = this.getWeeklyProgressUI(task, viewDate);
                if(weeklyProgress.isComplete) classes.push('week-complete', 'completed');
                else if(history.completed) classes.push('completed');

                switch (task.trackingType) {
                    case 'measurable':
                        const progress = history.measurableProgress || 0;
                        trackingUI = `<div class="task-details-measurable">${title}<div class="measurable-controls"><button class="measurable-btn" data-action="decrement">-</button><span class="measurable-progress">${progress} / ${task.measurableGoal}</span><button class="measurable-btn" data-action="increment">+</button></div>${weeklyProgress.ui}</div>`;
                        break;
                    case 'timed':
                        trackingUI = `<div class="task-details-measurable">${title}<button class="timer-btn" data-action="startTimer">Start ${task.timedGoal} min</button>${weeklyProgress.ui}</div>`;
                        break;
                    default: // completion
                        trackingUI = `<button class="completion-button" data-action="complete"></button><div class="task-details">${title}${description}${weeklyProgress.ui}</div>`;
                        break;
                }
                trackingUI += `<div class="task-actions">${streakDisplay}${editButton}</div>`;
            }

            return `<div class="${classes.join(' ')}" draggable="true" style="border-left-color: ${task.color};" data-id="${task.id}">${trackingUI}</div>`;
        }

        renderSidebar() {
            if (!this.dom.sidebar || this.state.tasks.length === 0) {
                if (this.dom.sidebar) this.dom.sidebar.innerHTML = "";
                return;
            };
            const habits = this.state.tasks.filter(t => t.type === 'habit' && !t.archived);
            const totalCompletions = habits.reduce((sum, task) => sum + Object.values(task.history || {}).filter(h => h.completed).length, 0);
            const longestOverallStreak = Math.max(0, ...habits.map(t => t.longestStreak || 0));
            const statsHtml = `<div class="sidebar-widget"><h3>Statistics</h3><ul><li><strong>Active Habits:</strong> <span>${habits.length}</span></li><li><strong>Longest Streak:</strong> <span>${longestOverallStreak} Days 🔥</span></li><li><strong>Total Completions:</strong> <span>${totalCompletions}</span></li></ul></div>`;
            const unlocked = this.state.unlockedAchievements.slice(-3).reverse();
            const achievementsHtml = `<div class="sidebar-widget"><h3>Recent Achievements</h3>${unlocked.length > 0 ? `<ul>${unlocked.map(key => { const ach = this.ALL_ACHIEVEMENTS[key]; return `<li>${ach.icon} ${ach.name}</li>`; }).join('')}</ul>` : '<p>No achievements unlocked yet.</p>'}</div>`;
            this.dom.sidebar.innerHTML = statsHtml + achievementsHtml;
        }

        renderJournal() {
            const timeline = document.getElementById('journal-timeline');
            if (!timeline) return;

            const allNotes = [];
            this.state.tasks.forEach(task => {
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

        renderCategories() {
            const categoryList = document.getElementById('category-list');
            if (!categoryList) return;
            categoryList.innerHTML = this.state.categories.map(cat => `
                <li class="setting-item">
                    <span>${cat}</span>
                    <button data-category="${cat}" class="btn-icon-delete"><img src="/static/Icons/DeleteIcon.svg" alt="Delete"></button>
                </li>
            `).join('');
        }

        renderArchivedList() {
            const archivedList = document.getElementById('archived-list');
            if (!archivedList) return;
            const archivedTasks = this.state.tasks.filter(t => t.archived);
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
        
        renderDashboard() {
            if (this.dom.dashboardPage.style.display === 'none') return;
            this.renderOverallStats();
            this.renderCategoryChart();
            this.renderDashboardStreaks();
            this.renderHeatmap();
            this.renderHabitPerformanceChart();
            this.renderDashboardAchievements();
        }

        renderOverallStats() {
            const statsWidget = document.getElementById('stats-widget');
            if (!statsWidget) return;
            const habits = this.state.tasks.filter(t => t.type === 'habit' && !t.archived && t.nature !== 'negative');
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

        renderCategoryChart() {
            const ctx = document.getElementById('category-chart')?.getContext('2d');
            if (!ctx) return;
            const categoryCounts = this.state.categories.reduce((acc, cat) => ({...acc, [cat]: 0}), {});
            this.state.tasks.forEach(task => {
                if (task.category && categoryCounts.hasOwnProperty(task.category)) {
                    categoryCounts[task.category]++;
                }
            });
            const labels = Object.keys(categoryCounts);
            const data = Object.values(categoryCounts);
            const colors = ['#818cf8', '#f87171', '#f59e0b', '#4ade80', '#22d3ee', '#d8b4fe'];
            if (this.categoryChartInstance) this.categoryChartInstance.destroy();
            this.categoryChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: labels.map((_, i) => colors[i % colors.length]),
                        borderColor: this.state.settings.theme === 'dark' ? '#334155' : '#ffffff',
                        borderWidth: 4,
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: getComputedStyle(this.dom.body).getPropertyValue('--text-color') } }
                    }
                }
            });
        }
        
        renderDashboardStreaks() {
            const container = document.getElementById('dashboard-streaks-list');
            if (!container) return;
            const habitsWithStreaks = this.state.tasks
                .filter(t => t.type === 'habit' && !t.archived && t.streak > 0 && t.nature !== 'negative')
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

        renderHeatmap() {
            const heatmapContainer = document.getElementById('heatmap-container');
            if (!heatmapContainer) return;
            const completionsByDate = {};
            this.state.tasks.forEach(task => {
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
        
        renderHabitPerformanceChart(taskId = null) {
            const habitSelect = document.getElementById('habit-select');
            const habits = this.state.tasks.filter(t => t.type === 'habit' && !t.archived && t.nature !== 'negative');
            const currentSelectedValue = habitSelect.value;
            habitSelect.innerHTML = '<option value="">-- Select a Habit --</option>';
            habits.forEach(habit => {
                habitSelect.innerHTML += `<option value="${habit.id}">${habit.name}</option>`;
            });
            habitSelect.value = currentSelectedValue;
            const canvas = document.getElementById('habit-performance-chart');
            if (this.habitChartInstance) this.habitChartInstance.destroy();
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
            const textColor = getComputedStyle(this.dom.body).getPropertyValue('--text-color');
            this.habitChartInstance = new Chart(ctx, {
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
        
        renderDashboardAchievements() {
            const container = document.getElementById('dashboard-achievements-list');
            if (!container) return;
            const unlocked = this.state.unlockedAchievements.slice(-5).reverse();
            if (unlocked.length > 0) {
                container.innerHTML = unlocked.map(key => {
                    const ach = this.ALL_ACHIEVEMENTS[key];
                    return `<div class="achievement-item unlocked"><div class="icon">${ach.icon}</div><div><h4>${ach.name}</h4><p>${ach.desc}</p></div></div>`;
                }).join('');
            } else {
                container.innerHTML = '<p class="empty-state">Unlock your first achievement by completing a task!</p>';
            }
        }
        
        renderAchievements() {
            this.dom.modals.achievements.querySelector('#achievements-list').innerHTML = Object.entries(this.ALL_ACHIEVEMENTS).map(([key, ach]) => {
                const isUnlocked = this.state.unlockedAchievements.includes(key);
                return `<div class="achievement-item ${isUnlocked ? 'unlocked' : ''}"><div class="icon">${ach.icon}</div><h4>${ach.name}</h4><p>${ach.desc}</p></div>`;
            }).join('');
        }
        
        renderStatistics() {
            const statsList = document.getElementById('stats-list');
            const habits = this.state.tasks.filter(t => t.type === 'habit' && !t.archived && t.nature !== 'negative');
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
                if (task.recurrence.type === 'days') this.recalculateStreaks(task);
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

        // ===================================================================
        // ACTION METHODS
        // ===================================================================
        
        savePromptNote() {
            const id = parseInt(document.getElementById('prompt-task-id').value);
            const dateString = document.getElementById('prompt-date-string').value;
            const noteText = document.getElementById('prompt-note-input').value.trim();
            this.updateTaskHistory(id, dateString, { note: noteText });
            this.render();
            this.closeModal(this.dom.modals.notePrompt);
        }

      async completeTask(id, dateString, isComplete) {
    const task = this.getTaskById(id);
    if (!task) return;

    const wasCompleted = task.history?.[dateString]?.completed || false;
    
    // 1. Update the local state first for a snappy UI
    this.updateTaskHistory(id, dateString, { completed: isComplete });
    if (task.type === 'habit' && task.recurrence.type === 'days') {
        this.recalculateStreaks(task);
    }

    // 2. Send the entire updated task object to the server
    try {
        await api.updateTask(task.id, task);
    } catch (error) {
        console.error("Failed to save task update to server:", error);
        this.showToast("Error: Could not sync progress.");
        // OPTIONAL: Revert the local change if the save fails
        this.updateTaskHistory(id, dateString, { completed: wasCompleted });
    }

    // 3. The rest of the function proceeds as normal
    this.playSound(isComplete ? 'complete' : 'uncomplete');
    this.render(); // Re-render the UI with the new state

    if (!wasCompleted && isComplete) {
        this.checkAchievements();
        this.openNotePromptModal(id, dateString);
    }
}

        failTask(id, dateString, isCurrentlyFailed) {
            const task = this.getTaskById(id);
            if (!task) return;
            const didFail = !isCurrentlyFailed;
            this.updateTaskHistory(id, dateString, { failed: didFail });
            
            if (task.type === 'habit') {
                this.recalculateStreaks(task);
            }
            
            this.playSound(didFail ? 'uncomplete' : 'complete');
            this.saveState();
            this.render();
            this.checkAchievements();
        }
async deleteTask() {
    const id = this.state.editingTaskId;
    if (!id) return;

    if (confirm('Are you sure you want to permanently delete this task?')) {
        try {
            // 1. Send the delete request to the server
            await api.deleteTask(id);
            this.showToast('Habit Deleted');

            // 2. Refresh the local state with the latest data
            this.state.tasks = await api.getAllTasks();
            this.render();
            this.closeModal(this.dom.modals.task);

        } catch (error) {
            console.error('Failed to delete task:', error);
            this.showToast('Error: Could not delete habit.');
        }
    }
}

        archiveTask() {
            const id = this.state.editingTaskId;
            const task = this.getTaskById(id);
            if (task) {
                task.archived = true;
                this.saveState();
                this.render();
                this.closeModal(this.dom.modals.task);
            }
        }

        unarchiveTask(id) {
            const task = this.getTaskById(id);
            if (task) {
                task.archived = false;
                this.saveState();
                this.renderArchivedList();
                this.render();
            }
        }

        addCategory() {
            const input = document.getElementById('new-category-name');
            const name = input.value.trim();
            if (name && !this.state.categories.includes(name)) {
                this.state.categories.push(name);
                this.saveState();
                this.renderCategories();
                input.value = '';
            }
        }

        deleteCategory(categoryName) {
            if (this.state.categories.length <= 1) {
                return this.showToast("You must have at least one category.");
            }
            this.state.categories = this.state.categories.filter(c => c !== categoryName);
            this.state.tasks.forEach(task => {
                if (task.category === categoryName) task.category = this.state.categories[0] || '';
            });
            this.saveState();
            this.renderCategories();
        }

        changeDay(direction) {
            const d = new Date(this.state.currentDate);
            d.setDate(d.getDate() + direction);
            this.state.currentDate = d.toDateString();
            this.render();
        }
        
        startTimer(id, minutes) {
            if (this.state.timer.interval) clearInterval(this.state.timer.interval);
            const endTime = Date.now() + minutes * 60 * 1000;
            this.state.timer = { taskId: id, endTime, interval: setInterval(this.updateTimerDisplay.bind(this), 1000) };
            const task = this.getTaskById(id);
            this.dom.modals.timer.querySelector('#timer-task-name').textContent = task.name;
            this.openModal(this.dom.modals.timer);
        }

        updateTimerDisplay() {
            const remaining = this.state.timer.endTime - Date.now();
            if (remaining <= 0) {
                clearInterval(this.state.timer.interval);
                this.completeTask(this.state.timer.taskId, this.state.currentDate, true);
                this.closeModal(this.dom.modals.timer);
                this.showToast("Timer finished! Task complete.");
                this.state.timer = { interval: null, taskId: null, endTime: null };
                return;
            }
            const minutes = Math.floor((remaining / 1000) / 60);
            const seconds = Math.floor((remaining / 1000) % 60);
            this.dom.modals.timer.querySelector('#timer-display').textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }

        cancelTimer() {
            if (this.state.timer.interval) clearInterval(this.state.timer.interval);
            this.state.timer = { interval: null, taskId: null, endTime: null };
            this.closeModal(this.dom.modals.timer);
        }

        exportData() {
            const dataStr = JSON.stringify(this.state);
            const dataBlob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            const today = new Date();
            const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            link.download = `Stride-backup-${dateStr}.json`;
            this.dom.body.appendChild(link);
            link.click();
            this.dom.body.removeChild(link);
            URL.revokeObjectURL(url);
            this.showToast("Data exported successfully!");
        }

        importData(event) {
            const file = event.target.files[0];
            if (!file) return;
            if (!confirm("This will overwrite all current data. Are you sure you want to continue?")) {
                event.target.value = ""; return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedState = JSON.parse(e.target.result);
                    if (importedState && importedState.tasks && importedState.settings) {
                        this.state = importedState;
                        this.saveState();
                        this.showToast("Data imported successfully!");
                        location.reload();
                    } else {
                        alert("Invalid or corrupted backup file.");
                    }
                } catch (error) {
                    console.error("Error parsing imported file:", error);
                    alert("Could not import the file. It may be corrupted.");
                }
            };
            reader.readAsText(file);
            event.target.value = "";
        }
        
        onDragStart(e) {
            this.draggedItem = e.target.closest('.task-item');
            if (this.draggedItem) {
                setTimeout(() => {
                    this.draggedItem.classList.add('dragging');
                }, 0);
            }
        }
        
        onDragEnd() {
            if (this.draggedItem) {
                this.draggedItem.classList.remove('dragging');
                this.draggedItem = null;
            }
        }
        
        onDragOver(e) {
            e.preventDefault();
            const afterElement = this.getDragAfterElement(this.dom.taskList, e.clientY);
            const currentlyDragged = document.querySelector('.dragging');
            if (currentlyDragged) {
                if (afterElement == null) {
                    this.dom.taskList.appendChild(currentlyDragged);
                } else {
                    this.dom.taskList.insertBefore(currentlyDragged, afterElement);
                }
            }
        }
        
        onDrop() {
            const newOrderedIds = [...this.dom.taskList.querySelectorAll('.task-item')].map(item => parseInt(item.dataset.id));
            const idToTaskMap = new Map(this.state.tasks.map(task => [task.id, task]));
            newOrderedIds.forEach((id, index) => {
                const task = idToTaskMap.get(id);
                if (task) { task.order = index; }
            });
            this.saveState();
            this.render();
        }

        // ===================================================================
        // HELPER & UTILITY METHODS
        // ===================================================================

        applyTheme() {
            this.dom.body.classList.toggle('dark-mode', this.state.settings.theme === 'dark');
        }

        showPage(pageId) {
            [this.dom.mainPage, this.dom.dashboardPage, this.dom.journalPage, this.dom.calendarPage].forEach(page => {
                if(page) page.style.display = page.id === pageId ? 'block' : 'none';
            });
            this.dom.quickAddBtn.style.display = 'block';
            if (pageId === 'dashboard-page') {
                this.renderDashboard();
                this.dom.quickAddBtn.style.display = 'none';
            } else if (pageId === 'journal-page') {
                this.renderJournal();
                this.dom.quickAddBtn.style.display = 'none';
            } else if (pageId === 'calendar-page') {
                // this.renderCalendar(); 
                this.dom.quickAddBtn.style.display = 'none';
            }
        }
        
        playSound(soundFile) {
            if (!this.state.settings.enableSound) return;
            try { new Audio(`/static/audio/${soundFile}.mp3`).play(); } 
            catch (e) { console.warn("Could not play sound", e); }
        }

        showToast(message) {
            this.dom.toast.textContent = message;
            this.dom.toast.className = "toast show";
            setTimeout(() => { this.dom.toast.className = this.dom.toast.className.replace("show", ""); }, 3000);
        }

        openModal(modal) {
            if (modal) modal.style.display = 'flex';
        }

        closeModal(modal) {
            if (modal) modal.style.display = 'none';
        }
        
        openTaskModal(id = null) {
            this.state.editingTaskId = id;
            const task = id ? this.getTaskById(id) : { recurrence: { type: 'days', days: [] }, color: '#5e72e4' };
            
            document.getElementById('modal-title').innerText = id ? 'Edit Task' : 'New Task';
            document.getElementById('task-name').value = task.name || '';
            document.getElementById('task-desc').value = task.description || '';
            
            const taskTypeSelect = document.getElementById('task-type');
            taskTypeSelect.value = task.type || 'habit';
            
            document.getElementById('task-color').value = task.color;
            
            const taskCategorySelect = document.getElementById('task-category');
            taskCategorySelect.innerHTML = this.state.categories.map(c => `<option value="${c}">${c}</option>`).join('');
            taskCategorySelect.value = task.category || this.state.categories[0] || '';
            
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
            
            this.openModal(this.dom.modals.task);
        }

        openNotePromptModal(id, dateString) {
            const task = this.getTaskById(id);
            if (!task) return;
            document.getElementById('prompt-task-id').value = id;
            document.getElementById('prompt-date-string').value = dateString;
            document.getElementById('prompt-note-input').value = task.history?.[dateString]?.note || '';
            this.openModal(this.dom.modals.notePrompt);
        }

        openSettingsModal() {
            document.getElementById('theme-toggle').checked = this.state.settings.theme === 'dark';
            document.getElementById('sound-toggle').checked = this.state.settings.enableSound;
            document.getElementById('vacation-toggle').checked = this.state.settings.vacationMode.active;
            document.getElementById('vacation-dates').style.display = this.state.settings.vacationMode.active ? 'flex' : 'none';
            document.getElementById('vacation-start').value = this.state.settings.vacationMode.start || '';
            document.getElementById('vacation-end').value = this.state.settings.vacationMode.end || '';
            this.renderCategories();
            this.renderArchivedList();
            this.openModal(this.dom.modals.settings);
        }

        openFilterModal() {
            const filterCategorySelect = document.getElementById('filter-category');
            const categories = ['all', ...this.state.categories];
            filterCategorySelect.innerHTML = categories.map(cat => `<option value="${cat}">${cat === 'all' ? 'All Categories' : cat}</option>`).join('');
            filterCategorySelect.value = this.state.settings.filter.category;
            this.openModal(this.dom.modals.filter);
        }
        
        openDeveloperModal() {
            document.getElementById('developer-state-view').textContent = JSON.stringify(this.state, null, 2);
            this.openModal(this.dom.modals.developer);
        }

        getWeeklyProgressUI(task, viewDate) {
            if (task.recurrence?.type !== 'weekly') return { ui: '', isComplete: false };
            const weeklyCompletions = this.getWeeklyCompletions(task, viewDate);
            const weeklyGoal = task.recurrence.timesPerWeek;
            const isComplete = weeklyCompletions >= weeklyGoal;
            const ui = `<div class="weekly-progress">[ ${weeklyCompletions} / ${weeklyGoal} ]</div>`;
            return { ui, isComplete };
        }

        getWeeklyCompletions(task, date) {
            const firstDayOfWeek = new Date(date);
            firstDayOfWeek.setDate(date.getDate() - date.getDay());
            firstDayOfWeek.setHours(0, 0, 0, 0);
            let completions = 0;
            for (let i = 0; i < 7; i++) {
                const day = new Date(firstDayOfWeek);
                day.setDate(firstDayOfWeek.getDate() + i);
                if (task.history[day.toDateString()]?.completed) {
                    completions++;
                }
            }
            return completions;
        }

        recalculateStreaks(task) {
            // ... (Full streak logic goes here)
        }

        checkAchievements() {
            const totalCompletions = this.state.tasks.reduce((sum, task) => sum + Object.values(task.history || {}).filter(h => h.completed).length, 0);
            const longestStreak = Math.max(0, ...this.state.tasks.filter(t => t.recurrence?.type === 'days').map(t => t.longestStreak || 0));
            const newlyUnlocked = [];
            Object.keys(this.ALL_ACHIEVEMENTS).forEach(key => {
                if (this.state.unlockedAchievements.includes(key)) return;
                let unlocked = false;
                switch(key) {
                    case 'FIRST_STEP': if(totalCompletions >= 1) unlocked = true; break;
                    case 'DEDICATED': if(totalCompletions >= 50) unlocked = true; break;
                    case 'COMMITTED': if(totalCompletions >= 100) unlocked = true; break;
                    case 'STREAK_STARTER': if(longestStreak >= 3) unlocked = true; break;
                    case 'WEEKLY_WARRIOR': if(longestStreak >= 7) unlocked = true; break;
                    case 'MONTHLY_MASTER': if(longestStreak >= 30) unlocked = true; break;
                }
                if(unlocked) newlyUnlocked.push(key);
            });
            if(newlyUnlocked.length > 0) {
                this.playSound('achievement');
                this.state.unlockedAchievements.push(...newlyUnlocked);
                this.saveState();
                const achievement = this.ALL_ACHIEVEMENTS[newlyUnlocked[0]];
                this.showToast(`🏆 Achievement Unlocked: ${achievement.name}`);
            }
        }

        getDragAfterElement(container, y) {
            const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];
            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }
        
        registerServiceWorker() {
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/static/service-worker.js')
                        .then(reg => console.log('ServiceWorker registration successful'))
                        .catch(err => console.log('ServiceWorker registration failed: ', err));
                });
            }
        }
    }

    // --- Start the App ---
    new HabitTrackerApp();
});