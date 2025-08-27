import * as api from './api.js';
import { loadSettingsFromLocal, setEditingTaskId, getTaskById, state, saveSettingsToLocal, ALL_ACHIEVEMENTS } from './state.js';
import * as ui from './ui.js';
import * as actions from './actions.js';

class StrideApp {
    constructor() {
        this.dom = {
            body: document.body,
            taskList: document.getElementById('task-list'),
            headerTitle: document.getElementById('header-title'),
            hamburgerBtn: document.getElementById('hamburger-btn'),
            mobileNav: document.getElementById('mobile-nav'),
            navOverlay: document.getElementById('nav-overlay'),
            modals: {
                task: document.getElementById('task-modal'),
                settings: document.getElementById('settings-modal'),
                stats: document.getElementById('stats-modal'),
                developer: document.getElementById('developer-modal'),
                achievements: document.getElementById('achievements-modal'),
                notePrompt: document.getElementById('note-prompt-modal'),
                filter: document.getElementById('filter-modal'),
                login: document.getElementById('login-modal'),
                registration: document.getElementById('registration-modal'),
            }
        };
        this.draggedItem = null;
        this.init();
    }

    async init() {
        loadSettingsFromLocal();
        ui.applyTheme();

        const authToken = localStorage.getItem('authToken');
        if (authToken) {
            try {
                state.tasks = await api.getAllTasks();
                console.log("Tasks loaded from server.");
            } catch (error) {
                console.error("Failed to load tasks from server:", error);
                if (error.status === 401 || error.status === 403) {
                    actions.handleLogout();
                } else {
                    ui.showToast("Could not load data from server.");
                }
            }
        }
        
        this.setupEventListeners();
        
        if (window.location.pathname.includes('/stride/')) {
            ui.showPage('main-page');
        } else if (window.location.pathname.includes('/profile/')) {
            ui.showPage('profile-page');
        } else {
            ui.showPage('hub-page');
        }

        ui.render();

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('next')) {
            ui.openModal(this.dom.modals.login);
        }

        this.registerServiceWorker();
    }

    setupEventListeners() {
        this.dom.body.addEventListener('click', this.handleGlobalClick.bind(this));
        
        if (this.dom.taskList) {
            this.dom.taskList.addEventListener('click', this.handleTaskListClick.bind(this));
            this.dom.taskList.addEventListener('dragstart', this.onDragStart.bind(this));
            this.dom.taskList.addEventListener('dragend', this.onDragEnd.bind(this));
            this.dom.taskList.addEventListener('dragover', this.onDragOver.bind(this));
            this.dom.taskList.addEventListener('drop', this.onDrop.bind(this));
        }
        
        if (this.dom.modals.task) {
            this.dom.modals.task.addEventListener('change', this.handleTaskModalChange.bind(this));
        }
        if (this.dom.modals.settings) {
            this.dom.modals.settings.addEventListener('click', this.handleSettingsClick.bind(this));
        }
        if (this.dom.modals.stats) {
            this.dom.modals.stats.addEventListener('click', this.handleStatsModalClick.bind(this));
        }
        if (this.dom.modals.developer) {
            this.dom.modals.developer.addEventListener('click', this.handleDeveloperModalClick.bind(this));
        }
        if (this.dom.hamburgerBtn) {
            this.dom.hamburgerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMobileNav();
            });
        }

        const habitSelect = document.getElementById('habit-select');
        if (habitSelect) {
            habitSelect.addEventListener('change', (e) => ui.renderHabitPerformanceChart(e.target.value));
        }
        const importInput = document.getElementById('import-data-input');
        if (importInput) {
            importInput.addEventListener('change', (e) => actions.importData(e));
        }
        
        if (this.dom.headerTitle) {
            let devClickCount = 0;
            let devClickTimer = null;
            this.dom.headerTitle.addEventListener('click', () => {
                devClickCount++;
                clearTimeout(devClickTimer);
                devClickTimer = setTimeout(() => { devClickCount = 0; }, 2000);
                if (devClickCount >= 5) {
                    state.settings.developerMode = !state.settings.developerMode;
                    saveSettingsToLocal();
                    ui.renderHeader();
                    ui.showToast(`Developer Mode ${state.settings.developerMode ? 'Enabled' : 'Disabled'}`);
                    devClickCount = 0;
                }
            });
        }
    }
    
    handleGlobalClick(e) {
        const target = e.target.closest('[data-action]');
        
        if (this.dom.body.classList.contains('nav-open')) {
            if (!e.target.closest('#mobile-nav')) {
                this.toggleMobileNav();
            }
        }
        
        if (!target) return;
        const action = target.dataset.action;

        if (this.dom.body.classList.contains('nav-open') && target.classList.contains('nav-link')) {
            this.toggleMobileNav();
        }
        
        const actionMap = {
            'show-login-modal': () => ui.openModal(this.dom.modals.login),
            'close-login-modal': () => ui.closeModal(this.dom.modals.login),
            'login-submit': (event) => { event.preventDefault(); actions.handleLogin(); },
            'logout': actions.handleLogout,
            'show-reg-modal': () => ui.openModal(this.dom.modals.registration),
            'close-reg-modal': () => ui.closeModal(this.dom.modals.registration),
            'register-submit': (event) => { event.preventDefault(); actions.handleRegistration(); },
            'change-password-submit': (event) => { event.preventDefault(); actions.handleChangePassword(); },
            'onboard-add': () => ui.openTaskModal(),
            'quick-add': () => ui.openTaskModal(),
            'change-day-prev': () => actions.changeDay(-1),
            'change-day-next': () => actions.changeDay(1),
            'show-journal': () => ui.showPage('journal-page'),
            'show-dashboard': () => ui.showPage('dashboard-page'),
            'show-calendar': () => ui.showPage('calendar-page'),
            'show-main': () => ui.showPage('main-page'),
            'show-achievements': () => { ui.renderAchievements(); ui.openModal(this.dom.modals.achievements); },
            'show-filter': () => ui.openFilterModal(),
            'show-stats': () => { ui.renderStatistics(); ui.openModal(this.dom.modals.stats); },
            'show-settings': () => ui.openSettingsModal(),
            'show-developer': () => ui.openDeveloperModal(),
            'save-task': actions.saveTask,
            'delete-task': actions.deleteTask,
            'archive-task': actions.archiveTask,
            'cancel-task': () => ui.closeModal(this.dom.modals.task),
            'save-prompt-note': actions.savePromptNote,
            'cancel-prompt-note': () => ui.closeModal(this.dom.modals.notePrompt),
            'close-settings': () => ui.closeModal(this.dom.modals.settings),
            'close-achievements': () => ui.closeModal(this.dom.modals.achievements),
            'apply-filter': () => {
                state.settings.filter.category = document.getElementById('filter-category').value;
                saveSettingsToLocal();
                ui.render();
                ui.closeModal(this.dom.modals.filter);
            },
            'close-stats': () => ui.closeModal(this.dom.modals.stats),
            'cancel-timer': actions.cancelTimer,
            'export-data': actions.exportData,
            'add-category': actions.addCategory,
            'close-developer': () => ui.closeModal(this.dom.modals.developer),
            'toggle-day': (e) => e.target.classList.toggle('active'),
        };

        if (actionMap[action]) actionMap[action](e);
    }
    
    handleTaskListClick(e) {
        const actionTarget = e.target.closest('[data-action]');
        if (!actionTarget) return;
        const taskItem = e.target.closest('.task-item');
        if (!taskItem) return;
        if (taskItem.classList.contains('paused') && actionTarget.dataset.action !== 'edit') return;

        const id = parseInt(taskItem.dataset.id);
        const action = actionTarget.dataset.action;
        const task = getTaskById(id);
        if (!task) return;
        let history = task.history?.[state.currentDate] || { completed: false, measurableProgress: 0 };
        
        switch (action) {
            case 'edit': setEditingTaskId(id); ui.openTaskModal(id); break;
            case 'complete': actions.completeTask(id, state.currentDate, !history.completed); break;
            case 'fail': actions.failTask(id, state.currentDate, !history.failed); break;
            case 'increment':
                actions.updateTaskHistory(id, state.currentDate, { measurableProgress: (history.measurableProgress || 0) + 1 });
                if ((history.measurableProgress + 1) >= task.measurableGoal && !history.completed) {
                    actions.completeTask(id, state.currentDate, true);
                } else {
                    api.updateTask(task.id, task);
                    ui.render();
                }
                break;
            case 'decrement':
                actions.updateTaskHistory(id, state.currentDate, { measurableProgress: Math.max(0, (history.measurableProgress || 0) - 1) });
                if ((history.measurableProgress - 1) < task.measurableGoal && history.completed) {
                    actions.completeTask(id, state.currentDate, false);
                } else {
                    api.updateTask(task.id, task);
                    ui.render();
                }
                break;
            case 'startTimer': actions.startTimer(id, task.timedGoal); break;
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
            state.settings.theme = target.checked ? 'dark' : 'light';
            ui.applyTheme();
            saveSettingsToLocal();
        } else if (target.id === 'sound-toggle') {
            state.settings.enableSound = target.checked;
            saveSettingsToLocal();
        } else if (target.id === 'vacation-toggle') {
            state.settings.vacationMode.active = target.checked;
            document.getElementById('vacation-dates').style.display = target.checked ? 'flex' : 'none';
            saveSettingsToLocal();
        } else if (target.id === 'vacation-start' || target.id === 'vacation-end') {
            state.settings.vacationMode[target.id.split('-')[1]] = target.value;
            saveSettingsToLocal();
        } else if (unarchiveButton && unarchiveButton.closest('#archived-list')) {
            actions.unarchiveTask(parseInt(unarchiveButton.dataset.id));
        } else if (deleteCategoryButton) {
            actions.deleteCategory(deleteCategoryButton.dataset.category);
        }
    }
    
    handleStatsModalClick(e) {
        const editButton = e.target.closest('[data-action="edit"]');
        if (editButton) {
            const id = parseInt(editButton.dataset.id);
            ui.closeModal(this.dom.modals.stats);
            setEditingTaskId(id);
            ui.openTaskModal(id);
        }
    }
    
    handleDeveloperModalClick(e) {
        const action = e.target.dataset.action;
        if (!action) return;
        const devActions = {
            'dev-recalculate-streaks': async () => {
                for (const task of state.tasks) {
                    actions.recalculateStreaks(task);
                    await api.updateTask(task.id, task);
                }
                ui.showToast("All streaks recalculated and saved.");
            },
            'dev-check-achievements': () => {
                actions.checkAchievements();
                ui.showToast("Achievement check complete.");
            },
            'dev-unlock-achievements': () => {
                state.unlockedAchievements = Object.keys(ALL_ACHIEVEMENTS);
                saveSettingsToLocal();
                ui.showToast("All achievements unlocked.");
            },
            'dev-reset-app': () => {
                if (confirm("DANGER: This will permanently delete all data. Are you sure?")) {
                    localStorage.clear();
                    // This would need a dedicated API endpoint to wipe all server data
                    location.reload();
                }
            },
        };
        if (devActions[action]) devActions[action]();
        document.getElementById('developer-state-view').textContent = JSON.stringify(state, null, 2);
    }

    onDragStart(e) {
        this.draggedItem = e.target.closest('.task-item');
        if (this.draggedItem) {
            setTimeout(() => { this.draggedItem.classList.add('dragging'); }, 0);
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
        actions.onDrop();
        this.draggedItem = null;
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

    toggleMobileNav() {
        if (this.dom.body) {
            this.dom.body.classList.toggle('nav-open');
        }
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
new StrideApp();