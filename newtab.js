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

    const timeDisplay = task.time
      ? `<span class="task-time" title="Scheduled time">${task.time}</span>`
      : '';

    li.innerHTML = `
      <span class="checkmark" data-idx="${idx}" tabindex="0" aria-label="Mark as done">
        <svg width="22" height="22" viewBox="0 0 22 22">
          <circle cx="11" cy="11" r="10" fill="none" stroke="#e7eaff" stroke-width="3"/>
          <polyline class="tick" points="5.5,12.5 10,16.5 16.5,7.5"
            fill="none" stroke="#657ced" stroke-width="3.5"
            stroke-linecap="round" stroke-linejoin="round"
            stroke-dasharray="20" stroke-dashoffset="${task.done ? "0" : "20"}"/>
        </svg>
      </span>
      <span class="task-text" contenteditable="false" data-idx="${idx}" spellcheck="false">${task.text}</span>
      ${timeDisplay}
      <button class="edit" data-idx="${idx}" aria-label="Edit Task" title="Edit Task">&#9998;</button>
      <button class="delete" data-idx="${idx}" aria-label="Delete Task" title="Delete Task">&times;</button>
    `;
    list.appendChild(li);

    // Animate entry
    li.style.opacity = 0;
    setTimeout(() => {
      li.style.opacity = 1;
    }, 30 * idx);
  });
}

// Show confetti when completing a task (simple effect)
function showConfetti() {
  // Minimalistic confetti (can be replaced with a library for more effect)
  const body = document.body;
  for (let i = 0; i < 18; i++) {
    const conf = document.createElement('div');
    conf.className = 'confetti';
    conf.style.left = `${Math.random() * 100}%`;
    conf.style.background = `hsl(${Math.random() * 360},90%,65%)`;
    conf.style.animationDelay = `${Math.random()}s`;
    body.appendChild(conf);
    setTimeout(() => conf.remove(), 1200);
  }
}

// Reminders (web notifications)
function scheduleAllReminders(tasks) {
  // Clear existing timers
  if (window._reminderTimers) window._reminderTimers.forEach(clearTimeout);
  window._reminderTimers = [];
  tasks.forEach((task, idx) => {
    if (task.done || !task.time) return;
    const now = new Date();
    const taskTime = new Date(now.toDateString() + " " + task.time);
    const ms = taskTime - now;
    if (ms > 0 && ms < 24 * 3600 * 1000) {
      const t = setTimeout(() => {
        chrome.notifications && chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'Task Reminder',
          message: `⏰ ${task.text} (${task.time})`
        });
      }, ms);
      window._reminderTimers.push(t);
    }
  });
}

function openEditMode(idx, tasks) {
  const li = document.querySelector(`li[data-idx="${idx}"]`);
  if (!li) return;
  const task = tasks[idx];
  li.innerHTML = `
    <span class="checkmark" style="opacity:0.3"><svg width="22" height="22"></svg></span>
    <input type="text" class="edit-text" value="${task.text.replace(/"/g, "&quot;")}" maxlength="120" />
    <input type="time" class="edit-time" value="${task.time || ''}" />
    <button class="save-edit" data-idx="${idx}" title="Save">&#10003;</button>
    <button class="cancel-edit" data-idx="${idx}" title="Cancel">&#10005;</button>
  `;
  li.querySelector('.edit-text').focus();
}

document.addEventListener('DOMContentLoaded', () => {
  const taskForm = document.getElementById('task-form');
  const taskInput = document.getElementById('task-input');
  const timeInput = document.getElementById('time-input');
  let tasks = [];

  // Load and render on open
  loadTasks((loaded) => {
    tasks = loaded;
    renderTasks(tasks);
  });

  // Add task
  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = taskInput.value.trim();
    const time = timeInput.value;
    if (text) {
      tasks.push({ text, done: false, created: Date.now(), time: time || null });
      saveTasks(tasks);
      renderTasks(tasks);
      taskInput.value = '';
      timeInput.value = '';
    }
  });

  // Delegated actions: delete, toggle, edit, save/cancel edit
  document.getElementById('task-list').addEventListener('click', (e) => {
    const idx = e.target.dataset.idx || e.target.closest('.checkmark')?.dataset.idx;
    if (e.target.classList.contains('delete') && idx !== undefined) {
      const li = e.target.closest('li');
      li.style.opacity = 0;
      setTimeout(() => {
        tasks.splice(idx, 1);
        saveTasks(tasks);
        renderTasks(tasks);
      }, 250);
    } else if (
      (e.target.classList.contains('checkmark') || e.target.closest('.checkmark')) && idx !== undefined
    ) {
      tasks[idx].done = !tasks[idx].done;
      saveTasks(tasks);
      renderTasks(tasks);
      if (tasks[idx].done) showConfetti();
    } else if (e.target.classList.contains('edit') && idx !== undefined) {
      openEditMode(idx, tasks);
    } else if (e.target.classList.contains('save-edit') && idx !== undefined) {
      const li = e.target.closest('li');
      const newText = li.querySelector('.edit-text').value.trim();
      const newTime = li.querySelector('.edit-time').value;
      if (newText) {
        tasks[idx].text = newText;
        tasks[idx].time = newTime || null;
        saveTasks(tasks);
        renderTasks(tasks);
      }
    } else if (e.target.classList.contains('cancel-edit') && idx !== undefined) {
      renderTasks(tasks);
    }
  });

  // Edit task (blur to save)
  document.getElementById('task-list').addEventListener('dblclick', (e) => {
    if (e.target.classList.contains('task-text')) {
      const idx = e.target.dataset.idx;
      openEditMode(idx, tasks);
    }
  });

  // Keyboard access for checkmark (space/enter)
  document.getElementById('task-list').addEventListener('keydown', (e) => {
    if (e.target.classList.contains('checkmark') && (e.key === " " || e.key === "Enter")) {
      const idx = e.target.dataset.idx;
      if (idx !== undefined) {
        tasks[idx].done = !tasks[idx].done;
        saveTasks(tasks);
        renderTasks(tasks);
        if (tasks[idx].done) showConfetti();
      }
    }
  });

  // Enter on .edit-text: blur to save
  document.getElementById('task-list').addEventListener('keydown', (e) => {
    if (e.target.classList.contains('edit-text') && e.key === "Enter") {
      e.preventDefault();
      e.target.closest('li').querySelector('.save-edit').click();
    }
  });

  // Request notifications permission if not already granted
  if (window.Notification) {
    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }
});