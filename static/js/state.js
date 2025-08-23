// This file manages the application's data state.

export const ALL_ACHIEVEMENTS = {
    FIRST_STEP: { name: 'First Step', desc: 'Complete your very first task.', icon: '👟' },
    STREAK_STARTER: { name: 'Streak Starter', desc: 'Achieve a 3-day streak.', icon: '🔥' },
    WEEKLY_WARRIOR: { name: 'Weekly Warrior', desc: 'Achieve a 7-day streak.', icon: '🗓️' },
    MONTHLY_MASTER: { name: 'Monthly Master', desc: 'Achieve a 30-day streak.', icon: '📅' },
    DEDICATED: { name: 'Dedicated', desc: 'Log 50 total completions.', icon: '🎯' },
    COMMITTED: { name: 'Committed', desc: 'Log 100 total completions.', icon: '💯' },
};

export let state = {
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

export function saveSettingsToLocal() {
    localStorage.setItem('strideSettings', JSON.stringify(state.settings));
}

export function loadSettingsFromLocal() {
    const savedSettings = localStorage.getItem('strideSettings');
    if (savedSettings) {
        try {
            const loaded = JSON.parse(savedSettings);
            state.settings = { ...state.settings, ...loaded };
        } catch (e) {
            console.error("Failed to parse settings from localStorage.");
        }
    }
}

export function setEditingTaskId(id) {
    state.editingTaskId = id;
}

export function getTaskById(id) {
    return state.tasks.find(t => t.id === id);
}

export function updateTaskHistory(id, dateString, newHistoryData) {
    const task = getTaskById(id);
    if (!task) return;
    if (!task.history) task.history = {};
    task.history[dateString] = { ...(task.history[dateString] || {}), ...newHistoryData };
}