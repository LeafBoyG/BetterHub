// state.js
let tasks = [];
let settings = {
  theme: "light",
  vacationMode: false,
  categories: [],
  archivedTasks: [],
};
let journalEntries = [];
let achievements = [];
let editingTaskId = null;

// =============== State Management ===============

// Tasks
export function getTasks() {
  return tasks;
}
export function setTasks(newTasks) {
  tasks = newTasks;
}

// Settings
export function getSettings() {
  return settings;
}
export function setSettings(newSettings) {
  settings = newSettings;
}

// Journal
export function getJournalEntries() {
  return journalEntries;
}
export function setJournalEntries(newEntries) {
  journalEntries = newEntries;
}

// Achievements
export function getAchievements() {
  return achievements;
}
export function setAchievements(newAchievements) {
  achievements = newAchievements;
}

// Editing Task ID
export function setEditingTaskId(id) {
  editingTaskId = id;
}
export function getEditingTaskId() {
  return editingTaskId;
}
