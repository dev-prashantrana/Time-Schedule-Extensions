function getTodayKey() {
  const today = new Date();
  return `tasks_${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
}

function saveTasks(tasks) {
  const key = getTodayKey();
  chrome.storage.sync.set({ [key]: tasks });
  scheduleAllReminders(tasks);
}

function loadTasks(callback) {
  const key = getTodayKey();
  chrome.storage.sync.get([key], (res) => {
    callback(res[key] || []);
  });
}

function renderTasks(tasks) {
  const list = document.getElementById('task-list');
  list.innerHTML = '';
  if (!tasks.length) {
    list.innerHTML = `<li class="empty">No tasks for today. 🎉</li>`;
    return;
  }

  tasks.forEach((task, idx) => {
    const li = document.createElement('li');
    li.className = task.done ? 'done' : '';
    li.setAttribute('data-idx', idx);

    const priorityColor = {
      Low: '#a0c4ff',
      Medium: '#ffd6a5',
      High: '#ffadad'
    }[task.priority || 'Low'];

    li.innerHTML = `
      <span class="checkmark" data-idx="${idx}" tabindex="0" aria-label="Mark as done">
        ✅
      </span>
      <span class="task-text" contenteditable="false" data-idx="${idx}" spellcheck="false">${task.text}</span>
      ${task.time ? `<span class="task-time">${task.time}</span>` : ''}
      <button class="priority" data-idx="${idx}" title="Priority" style="background:${priorityColor}">${task.priority || 'Low'}</button>
      <button class="delete" data-idx="${idx}" title="Delete Task">🗑️</button>
    `;
    list.appendChild(li);
  });
}

function scheduleAllReminders(tasks) {
  tasks.forEach((task, idx) => {
    if (task.done || !task.time) return;
    const now = new Date();
    const taskTime = new Date(now.toDateString() + " " + task.time);
    const ms = taskTime - now;
    if (ms > 0 && ms < 24 * 3600 * 1000) {
      chrome.runtime.sendMessage({
        type: 'scheduleReminder',
        taskText: task.text,
        taskTime: task.time,
        alarmName: `alarm_${idx}_${Date.now()}`,
        when: Date.now() + ms
      });
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const taskForm = document.getElementById('task-form');
  const taskInput = document.getElementById('task-input');
  const timeInput = document.getElementById('time-input');
  let tasks = [];

  loadTasks((loaded) => {
    tasks = loaded;
    renderTasks(tasks);
  });

  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = taskInput.value.trim();
    const time = timeInput.value;
    if (text) {
      tasks.push({
        text,
        time: time || null,
        done: false,
        priority: 'Low',
        created: Date.now()
      });
      saveTasks(tasks);
      renderTasks(tasks);
      taskInput.value = '';
      timeInput.value = '';
    }
  });

  document.getElementById('task-list').addEventListener('click', (e) => {
    const idx = e.target.dataset.idx;
    if (e.target.classList.contains('checkmark')) {
      tasks[idx].done = !tasks[idx].done;
      saveTasks(tasks);
      renderTasks(tasks);
    } else if (e.target.classList.contains('delete')) {
      tasks.splice(idx, 1);
      saveTasks(tasks);
      renderTasks(tasks);
    } else if (e.target.classList.contains('priority')) {
      const levels = ['Low', 'Medium', 'High'];
      const current = tasks[idx].priority || 'Low';
      const next = levels[(levels.indexOf(current) + 1) % levels.length];
      tasks[idx].priority = next;
      saveTasks(tasks);
      renderTasks(tasks);
    }
  });
});