import { state, saveSettingsToLocal, getTaskById, updateTaskHistory, ALL_ACHIEVEMENTS } from './state.js';
import * as ui from './ui.js';
import * as api from './api.js';

export async function saveTask() {
    const id = state.editingTaskId;
    const name = document.getElementById('task-name').value.trim();
    if (!name) return ui.showToast('Task name is required.');
    
    const type = document.getElementById('task-type').value;
    const recurrenceType = document.getElementById('recurrence-type').value;
    let recurrence = {};
    if (type === 'habit') {
        recurrence = recurrenceType === 'days' 
            ? { type: 'days', days: [...document.querySelectorAll('#habit-days button.active')].map(b => parseInt(b.dataset.day)) }
            : { type: 'weekly', timesPerWeek: parseInt(document.getElementById('task-weekly-goal').value) || 1 };
    }

    const taskData = {
        name, 
        description: document.getElementById('task-desc').value.trim(),
        color: document.getElementById('task-color').value,
        task_type: type,
        trackingType: document.getElementById('task-tracking-type').value,
        recurrence,
        nature: type === 'habit' ? document.getElementById('habit-nature').value : 'positive',
        category: document.getElementById('task-category').value,
        measurableGoal: parseInt(document.getElementById('task-measurable-goal').value) || null,
        timedGoal: parseInt(document.getElementById('task-timed-goal').value) || null,
    };

    try {
        if (id) {
            const task = getTaskById(id);
            const pauseToggle = document.getElementById('pause-toggle');
            task.pause = task.pause || {};
            task.pause.active = pauseToggle.checked;
            task.pause.until = pauseToggle.checked ? document.getElementById('pause-until-input').value : null;
            const updatedTask = {...task, ...taskData};
            await api.updateTask(id, updatedTask);
        } else {
            const newTaskData = { ...taskData, history: {}, streak: 0, longestStreak: 0, archived: false, order: state.tasks.length, pause: { active: false, until: null } };
            await api.createTask(newTaskData);
        }
        ui.showToast(id ? 'Habit Updated' : 'Habit Added');
        state.tasks = await api.getAllTasks();
        ui.render();
        ui.closeModal(document.getElementById('task-modal'));
    } catch (error) {
        console.error('Failed to save task:', error);
        ui.showToast('Error: Could not save habit.');
    }
}

export async function completeTask(id, dateString, isComplete) {
    const task = getTaskById(id);
    if (!task) return;
    const wasCompleted = task.history?.[dateString]?.completed || false;
    
    // 1. OPTIMISTIC UPDATE: Change the state locally first.
    updateTaskHistory(id, dateString, { completed: isComplete });
    if (task.task_type === 'habit' && task.recurrence.type === 'days') {
        recalculateStreaks(task); 
    }
    
    // 2. INSTANT RENDER: Update the UI immediately.
    ui.render(); 
    ui.playSound(isComplete ? 'complete' : 'uncomplete');

    // 3. SYNC: Now, try to save the change to the server.
    try {
        await api.updateTask(task.id, task);
        // Post-completion actions happen only if the save was successful
        if (!wasCompleted && isComplete) { 
            checkAchievements(); 
            ui.openNotePromptModal(id, dateString); 
        }
    } catch (error) {
        console.error("Failed to save task update:", error);
        ui.showToast("Error syncing progress.");
        
        // 4. HANDLE FAILURE: Revert the state and re-render.
        updateTaskHistory(id, dateString, { completed: wasCompleted }); 
        if (task.task_type === 'habit' && task.recurrence.type === 'days') {
            recalculateStreaks(task);
        }
        ui.render(); // Re-render to show the reverted (unchanged) state.
    }
}

export async function failTask(id, dateString, isCurrentlyFailed) {
    const task = getTaskById(id);
    if (!task) return;
    const didFail = !isCurrentlyFailed;

    updateTaskHistory(id, dateString, { failed: didFail });
    if (task.task_type === 'habit') recalculateStreaks(task);
    ui.render(); // Optimistic render

    try {
        await api.updateTask(task.id, task);
    } catch(e) {
        ui.showToast("Error syncing progress");
        updateTaskHistory(id, dateString, { failed: !didFail }); // Revert
        if (task.task_type === 'habit') recalculateStreaks(task);
        ui.render();
    }
    
    ui.playSound(didFail ? 'uncomplete' : 'complete');
    checkAchievements();
}

export async function deleteTask() {
    const id = state.editingTaskId;
    if (!id || !confirm('Are you sure you want to permanently delete this habit?')) return;
    try {
        await api.deleteTask(id);
        ui.showToast('Habit Deleted');
        state.tasks = state.tasks.filter(t => t.id !== id);
        ui.render();
        ui.closeModal(document.getElementById('task-modal'));
    } catch (error) {
        console.error('Failed to delete task:', error);
        ui.showToast('Error: Could not delete habit.');
    }
}

export async function archiveTask() {
    const id = state.editingTaskId;
    const task = getTaskById(id);
    if (task) {
        task.archived = true;
        ui.render(); // Optimistic
        try {
            await api.updateTask(id, task);
            ui.closeModal(document.getElementById('task-modal'));
        } catch(e) {
            ui.showToast("Error archiving task");
            task.archived = false; // Revert
            ui.render();
        }
    }
}

export async function unarchiveTask(id) {
    const task = getTaskById(id);
    if (task) {
        task.archived = false;
        ui.renderArchivedList(); // Optimistic
        ui.render();
        try {
            await api.updateTask(id, task);
        } catch(e) {
            ui.showToast("Error unarchiving task");
            task.archived = true; // Revert
            ui.renderArchivedList();
            ui.render();
        }
    }
}

export async function savePromptNote() {
    const id = parseInt(document.getElementById('prompt-task-id').value);
    const dateString = document.getElementById('prompt-date-string').value;
    const noteText = document.getElementById('prompt-note-input').value.trim();
    const task = getTaskById(id);
    if (!task) return;

    const oldNote = task.history?.[dateString]?.note || '';
    updateTaskHistory(id, dateString, { note: noteText });
    ui.render();
    ui.closeModal(document.getElementById('note-prompt-modal'));
    
    try {
        await api.updateTask(id, task);
    } catch (error) {
        console.error("Failed to save note:", error);
        ui.showToast("Error saving note.");
        updateTaskHistory(id, dateString, { note: oldNote });
        ui.render();
    }
}

export async function onDrop() {
    const newOrderedIds = [...document.getElementById('task-list').querySelectorAll('.task-item')].map(item => parseInt(item.dataset.id));
    const oldTasksState = JSON.parse(JSON.stringify(state.tasks)); // Deep copy for revert
    const idToTaskMap = new Map(state.tasks.map(task => [task.id, task]));
    
    const updatePromises = [];
    newOrderedIds.forEach((id, index) => {
        const task = idToTaskMap.get(id);
        if (task && task.order !== index) { 
            task.order = index;
            updatePromises.push(api.updateTask(id, task));
        }
    });

    try {
        await Promise.all(updatePromises);
    } catch(e) {
        console.error("Failed to save new order", e);
        ui.showToast("Error saving new order");
        state.tasks = oldTasksState; // Revert
    }
    ui.render();
}

export function addCategory() {
    const input = document.getElementById('new-category-name');
    const name = input.value.trim();
    if (name && !state.categories.includes(name)) {
        state.categories.push(name);
        saveSettingsToLocal();
        ui.renderCategories();
        input.value = '';
    }
}

export async function deleteCategory(categoryName) {
    if (state.categories.length <= 1) {
        return ui.showToast("You must have at least one category.");
    }
    const oldCategories = [...state.categories];
    state.categories = state.categories.filter(c => c !== categoryName);
    const tasksToUpdate = state.tasks.filter(task => task.category === categoryName);
    try {
        for (const task of tasksToUpdate) {
            task.category = state.categories[0] || '';
            await api.updateTask(task.id, task);
        }
        saveSettingsToLocal();
        ui.renderCategories();
    } catch (e) {
        ui.showToast("Error updating task categories");
        state.categories = oldCategories;
    }
}

export function changeDay(direction) {
    const d = new Date(state.currentDate);
    d.setDate(d.getDate() + direction);
    state.currentDate = d.toDateString();
    ui.render();
}

export function startTimer(id, minutes) {
    if (state.timer.interval) clearInterval(state.timer.interval);
    const endTime = Date.now() + minutes * 60 * 1000;
    state.timer = { taskId: id, endTime, interval: setInterval(() => updateTimerDisplay(), 1000) };
    const task = getTaskById(id);
    document.getElementById('timer-modal').querySelector('#timer-task-name').textContent = task.name;
    ui.openModal(document.getElementById('timer-modal'));
}

function updateTimerDisplay() {
    if(!state.timer.endTime) return;
    const remaining = state.timer.endTime - Date.now();
    if (remaining <= 0) {
        clearInterval(state.timer.interval);
        completeTask(state.timer.taskId, state.currentDate, true);
        ui.closeModal(document.getElementById('timer-modal'));
        ui.showToast("Timer finished! Task complete.");
        state.timer = { interval: null, taskId: null, endTime: null };
        return;
    }
    const minutes = Math.floor((remaining / 1000) / 60);
    const seconds = Math.floor((remaining / 1000) % 60);
    document.getElementById('timer-modal').querySelector('#timer-display').textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function cancelTimer() {
    if (state.timer.interval) clearInterval(state.timer.interval);
    state.timer = { interval: null, taskId: null, endTime: null };
    ui.closeModal(document.getElementById('timer-modal'));
}

export function exportData() {
    const dataToExport = { tasks: state.tasks, settings: state.settings, categories: state.categories, unlockedAchievements: state.unlockedAchievements };
    const dataStr = JSON.stringify(dataToExport);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    link.download = `stride-backup-${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    ui.showToast("Data exported successfully!");
}

export function importData(event) {
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
                ui.showToast("Importing data with a server backend is not yet supported.");
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

export function recalculateStreaks(task) {
    const isDateInVacation = (date) => {
        const { active, start, end } = state.settings.vacationMode;
        if (!active || !start || !end) return false;
        const checkDate = new Date(date); checkDate.setHours(0, 0, 0, 0);
        const startDate = new Date(start); const endDate = new Date(end);
        return checkDate >= startDate && checkDate <= endDate;
    };
    const isDatePaused = (task, date) => {
        if (!task.pause?.active || !task.pause.until) return false;
        const checkDate = new Date(date); checkDate.setHours(0, 0, 0, 0);
        const pauseUntilDate = new Date(task.pause.until); pauseUntilDate.setHours(0, 0, 0, 0);
        return checkDate <= pauseUntilDate;
    };

    if (task.nature === 'negative' || task.recurrence.type === 'weekly' || !task.recurrence.days) { 
        task.streak = 0; 
        return; 
    }

    const completionDates = [...new Set(Object.keys(task.history || {}).filter(d => task.history[d]?.completed).map(d => new Date(d).toDateString()))].map(d => new Date(d)).sort((a, b) => b - a);
    if (completionDates.length === 0) { 
        task.streak = 0; 
        return; 
    }

    let longestStreak = 0; 
    let runningStreak = 1;
    if (completionDates.length > 0) {
        longestStreak = 1;
        let lastCompletion = completionDates[0];
        for (let i = 1; i < completionDates.length; i++) {
            const currentCompletion = completionDates[i];
            let expectedPrevDay = new Date(lastCompletion);
            do {
                expectedPrevDay.setDate(expectedPrevDay.getDate() - 1);
            } while (isDateInVacation(expectedPrevDay) || isDatePaused(task, expectedPrevDay) || !task.recurrence.days.includes(expectedPrevDay.getDay()));
            
            if (currentCompletion.getTime() === expectedPrevDay.getTime()) {
                runningStreak++;
            } else {
                if (runningStreak > longestStreak) { longestStreak = runningStreak; }
                runningStreak = 1;
            }
            lastCompletion = currentCompletion;
        }
        if (runningStreak > longestStreak) { longestStreak = runningStreak; }
    }
    task.longestStreak = Math.max(task.longestStreak || 0, longestStreak);
    
    let currentStreak = 0;
    let latestPossibleDay = new Date(); latestPossibleDay.setHours(0, 0, 0, 0);
    while (isDateInVacation(latestPossibleDay) || isDatePaused(task, latestPossibleDay) || !task.recurrence.days.includes(latestPossibleDay.getDay())) {
        latestPossibleDay.setDate(latestPossibleDay.getDate() - 1);
    }

    const latestCompletionDate = completionDates[0];
    if (latestCompletionDate && latestCompletionDate.getTime() === latestPossibleDay.getTime()) {
        currentStreak = runningStreak;
    } else {
        let expectedPrevDay = new Date(latestPossibleDay);
        do {
            expectedPrevDay.setDate(expectedPrevDay.getDate() - 1);
        } while (isDateInVacation(expectedPrevDay) || isDatePaused(task, expectedPrevDay) || !task.recurrence.days.includes(expectedPrevDay.getDay()));

        if(latestCompletionDate && latestCompletionDate.getTime() >= expectedPrevDay.getTime()){
             currentStreak = runningStreak;
        } else {
            currentStreak = 0;
        }
    }
    task.streak = currentStreak;
}

export function checkAchievements() {
    const totalCompletions = state.tasks.reduce((sum, task) => sum + Object.values(task.history || {}).filter(h => h.completed).length, 0);
    const longestStreak = Math.max(0, ...state.tasks.filter(t => t.recurrence?.type === 'days').map(t => t.longestStreak || 0));
    const newlyUnlocked = [];
    Object.keys(ALL_ACHIEVEMENTS).forEach(key => {
        if (state.unlockedAchievements.includes(key)) return;
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
        ui.playSound('achievement');
        state.unlockedAchievements.push(...newlyUnlocked);
        saveSettingsToLocal();
        const achievement = ALL_ACHIEVEMENTS[newlyUnlocked[0]];
        ui.showToast(`🏆 Achievement Unlocked: ${achievement.name}`);
    }
}

export function getWeeklyCompletions(task, date) {
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