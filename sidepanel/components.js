import { parseTimeToSeconds, formatSeconds, parseAlarmTime, calculateNextAlarmTime } from './utils.js';
import { appState, saveState, i18n } from './state.js';

let draggedCardId = null;

export function setupCardCommonEvents(card, item, tab) {
  const lang = appState.settings.language === 'system' || !appState.settings.language 
    ? (navigator.language.startsWith('ja') ? 'ja' : 'en') 
    : appState.settings.language;
  const dict = i18n[lang] || i18n.en;

  // Title editing (Single Click)
  const titleInput = card.querySelector('.card-title');
  titleInput.addEventListener('click', () => {
    titleInput.readOnly = false;
    titleInput.focus();
    card.draggable = false;
  });
  titleInput.addEventListener('blur', () => {
    titleInput.readOnly = true;
    card.draggable = true;
    const newTitle = titleInput.value.trim() || dict.untitled;
    titleInput.value = newTitle;
    const list = tab === 'timer' ? appState.timers : appState.alarms;
    const t = list.find(t => t.id === item.id);
    if (t && t.title !== newTitle) {
      t.title = newTitle;
      saveState();
    }
  });
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') titleInput.blur();
  });

  // Delete
  const deleteBtn = card.querySelector('.delete-btn');
  deleteBtn.addEventListener('click', async () => {
    if (tab === 'timer') {
      appState.timers = appState.timers.filter(t => t.id !== item.id);
    } else {
      appState.alarms = appState.alarms.filter(a => a.id !== item.id);
    }
    await chrome.alarms.clear(item.id);
    saveState();
  });

  // Drag and Drop Events
  card.addEventListener('dragstart', (e) => {
    draggedCardId = item.id;
    e.dataTransfer.effectAllowed = 'move';
    card.style.opacity = '0.5';
  });

  card.addEventListener('dragend', () => {
    draggedCardId = null;
    card.style.opacity = '1';
    document.querySelectorAll('.card').forEach(c => {
      c.style.borderTop = '';
      c.style.borderBottom = '';
    });
  });

  card.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!draggedCardId || draggedCardId === item.id) return;
    
    const bounding = card.getBoundingClientRect();
    const offset = bounding.y + (bounding.height / 2);
    if (e.clientY - offset > 0) {
      card.style.borderBottom = '2px solid var(--accent-color)';
      card.style.borderTop = '';
    } else {
      card.style.borderTop = '2px solid var(--accent-color)';
      card.style.borderBottom = '';
    }
  });

  card.addEventListener('dragleave', () => {
    card.style.borderTop = '';
    card.style.borderBottom = '';
  });

  card.addEventListener('drop', (e) => {
    e.preventDefault();
    card.style.borderTop = '';
    card.style.borderBottom = '';
    
    if (!draggedCardId || draggedCardId === item.id) return;

    const currentList = tab === 'timer' ? appState.timers : appState.alarms;
    const draggedIndex = currentList.findIndex(t => t.id === draggedCardId);
    const targetIndex = currentList.findIndex(t => t.id === item.id);

    if (draggedIndex > -1 && targetIndex > -1) {
      const bounding = card.getBoundingClientRect();
      const offset = bounding.y + (bounding.height / 2);
      const insertAfter = (e.clientY - offset > 0);

      const [draggedItem] = currentList.splice(draggedIndex, 1);
      const newTargetIndex = currentList.findIndex(t => t.id === item.id);
      
      if (insertAfter) {
        currentList.splice(newTargetIndex + 1, 0, draggedItem);
      } else {
        currentList.splice(newTargetIndex, 0, draggedItem);
      }
      
      saveState();
    }
  });
}

export function createTimerCard(timer) {
  const card = document.createElement('div');
  card.className = 'card timer-card';
  card.dataset.id = timer.id;
  card.draggable = true;
  
  const isRunning = timer.state === 'running';
  let displayTime = formatSeconds(timer.originalSeconds);
  if (isRunning) {
    const remaining = Math.max(0, Math.ceil((timer.endTime - Date.now()) / 1000));
    displayTime = formatSeconds(remaining);
  }

  const isChanged = timer.initialSeconds !== undefined && timer.originalSeconds !== timer.initialSeconds;
  const showReset = isRunning || isChanged;

  const lang = appState.settings.language === 'system' || !appState.settings.language 
    ? (navigator.language.startsWith('ja') ? 'ja' : 'en') 
    : appState.settings.language;
  const dict = i18n[lang] || i18n.en;

  card.innerHTML = `
    <div class="card-header">
      <input type="text" class="card-title" value="${timer.title}" readonly>
      <button class="delete-btn" title="${dict.delete}">×</button>
    </div>
    <div class="card-body">
      <input type="text" class="time-display" 
        value="${displayTime}" 
        data-running="${isRunning}" 
        data-endtime="${timer.endTime || ''}"
        ${isRunning ? 'readonly' : ''}
      >
      <div class="timer-controls" style="display: flex; gap: 8px;">
        <button class="reset-btn play-stop-btn play" title="${dict.reset}" style="display: ${showReset ? 'flex' : 'none'};">
          ↺
        </button>
        <button class="toggle-btn play-stop-btn ${isRunning ? 'stop' : 'play'}">
          ${isRunning ? '⏹' : '▶'}
        </button>
      </div>
    </div>
  `;

  // Time editing
  const timeDisplay = card.querySelector('.time-display');
  timeDisplay.addEventListener('focus', () => {
    if (!isRunning) {
      card.draggable = false;
      timeDisplay.dataset.prevValue = timeDisplay.value;
      if (timer.originalSeconds === 0) timeDisplay.value = '';
    }
  });
  timeDisplay.addEventListener('blur', async () => {
    if (!isRunning) {
      card.draggable = true;
      const input = timeDisplay.value;
      const seconds = parseTimeToSeconds(input);
      const t = appState.timers.find(t => t.id === timer.id);
      if (t) {
        const isUnchanged = (input === timeDisplay.dataset.prevValue) || 
                            (input === '' && timeDisplay.dataset.prevValue === '00:00');
        if (!isUnchanged) {
          t.initialSeconds = seconds;
          t.originalSeconds = seconds;
          timeDisplay.value = formatSeconds(seconds);
          
          if (appState.settings.autoEnableTimer && seconds > 0) {
            t.state = 'running';
            t.endTime = Date.now() + seconds * 1000;
            await chrome.alarms.create(t.id, { when: t.endTime });
          }
          saveState();
        } else {
          timeDisplay.value = formatSeconds(t.originalSeconds);
        }
      }
    }
  });
  timeDisplay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') timeDisplay.blur();
  });

  // Reset toggle
  const resetBtn = card.querySelector('.reset-btn');
  resetBtn.addEventListener('click', async () => {
    const t = appState.timers.find(t => t.id === timer.id);
    if (!t) return;
    
    t.state = 'idle';
    t.endTime = null;
    if (t.initialSeconds !== undefined) {
      t.originalSeconds = t.initialSeconds;
    }
    await chrome.alarms.clear(t.id);
    saveState();
    chrome.runtime.sendMessage({ action: "stopAudio" }).catch(() => {});
  });

  // Play/Stop toggle
  const playStopBtn = card.querySelector('.toggle-btn');
  playStopBtn.addEventListener('click', async () => {
    const t = appState.timers.find(t => t.id === timer.id);
    if (!t) return;

    if (t.state === 'idle') {
      if (t.originalSeconds > 0) {
        t.state = 'running';
        t.endTime = Date.now() + t.originalSeconds * 1000;
        await chrome.alarms.create(t.id, { when: t.endTime });
        saveState();
      }
    } else {
      // Stop (Pause)
      t.state = 'idle';
      const remaining = Math.max(0, Math.ceil((t.endTime - Date.now()) / 1000));
      t.originalSeconds = remaining;
      t.endTime = null;
      await chrome.alarms.clear(t.id);
      saveState();
      chrome.runtime.sendMessage({ action: "stopAudio" }).catch(() => {});
    }
  });

  return card;
}

export function createAlarmCard(alarm, callbacks) {
  const card = document.createElement('div');
  card.className = 'card alarm-card';
  card.dataset.id = alarm.id;
  card.draggable = true;

  const lang = appState.settings.language === 'system' || !appState.settings.language 
    ? (navigator.language.startsWith('ja') ? 'ja' : 'en') 
    : appState.settings.language;
  const dict = i18n[lang] || i18n.en;
  const daysLabels = dict.days;
  const daysOrder = [1, 2, 3, 4, 5, 6, 0]; // 月〜日の順で表示
  const isExpanded = alarm.expanded || false;

  const activeDaysText = daysOrder
    .filter(d => alarm.days.includes(d))
    .map(d => daysLabels[d])
    .join(', ');

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  const [h, m] = alarm.time.split(':').map(Number);
  const targetToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  const isScheduledToday = alarm.days && alarm.days.includes(now.getDay()) && targetToday.getTime() > now.getTime();
  const canSkipToday = alarm.enabled && isScheduledToday && alarm.skippedDate !== todayStr;
  card.innerHTML = `
    <div class="card-header">
      <input type="text" class="card-title" value="${alarm.title}" readonly>
      <button class="delete-btn" title="${dict.delete}">×</button>
    </div>
    <div class="card-body">
      <input type="text" class="time-display alarm-time-input" 
        value="${alarm.time}"
      >
      <label class="toggle-switch">
        <input type="checkbox" class="alarm-toggle" ${alarm.enabled ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    </div>
    ${canSkipToday ? `
    <div class="skip-container" style="text-align: left; padding: 0 4px; margin-top: -4px; margin-bottom: 8px;">
      <span class="skip-btn" style="font-size: 12px; color: var(--accent-color); cursor: pointer; text-decoration: none; font-weight: bold;">${dict.skipToday}</span>
    </div>` : ''}
    ${(!isExpanded && (activeDaysText || alarm.memo)) ? `
    <div class="alarm-summary">
      ${activeDaysText ? `<span class="summary-days">${activeDaysText}</span>` : ''}
      ${alarm.memo ? `<span class="summary-memo" title="${alarm.memo}">${alarm.memo}</span>` : ''}
    </div>` : ''}
    <button class="expand-btn ${isExpanded ? 'expanded' : ''}">${isExpanded ? '▲ ' + dict.advancedSettings : '▼ ' + dict.advancedSettings}</button>
    <div class="days-container ${isExpanded ? 'show' : ''}">
      <div class="days-row">
        ${daysOrder.map(d => `
          <button class="day-btn ${alarm.days.includes(d) ? 'selected' : ''}" data-day="${d}">
            ${daysLabels[d]}
          </button>
        `).join('')}
      </div>
      <input type="text" class="memo-input" placeholder="${dict.addMemo}" value="${alarm.memo || ''}">
    </div>
  `;

  // Time editing
  const timeDisplay = card.querySelector('.time-display');
  timeDisplay.addEventListener('focus', () => {
    card.draggable = false;
    timeDisplay.dataset.prevValue = timeDisplay.value;
    if (alarm.time === "00:00") timeDisplay.value = '';
  });
  timeDisplay.addEventListener('blur', async () => {
    card.draggable = true;
    const inputVal = timeDisplay.value.trim();
    const parsed = parseAlarmTime(timeDisplay.value);
    const a = appState.alarms.find(a => a.id === alarm.id);
    if (a) {
      const isChanged = timeDisplay.dataset.prevValue !== parsed;
      a.time = parsed;
      timeDisplay.value = parsed;
      
      if (appState.settings.autoEnableAlarm && isChanged && inputVal !== "") {
        a.enabled = true;
        card.querySelector('.alarm-toggle').checked = true;
        const nextTime = calculateNextAlarmTime(a.time, a.days, a.skippedDate);
        if (nextTime) {
          await chrome.alarms.create(a.id, { when: nextTime });
        } else {
          a.enabled = false;
          card.querySelector('.alarm-toggle').checked = false;
        }
      } else {
        if (a.enabled) {
          const nextTime = calculateNextAlarmTime(a.time, a.days, a.skippedDate);
          if (nextTime) {
            await chrome.alarms.create(a.id, { when: nextTime });
          } else {
            a.enabled = false;
            card.querySelector('.alarm-toggle').checked = false;
            await chrome.alarms.clear(a.id);
          }
        }
      }
      saveState();
    }
  });
  timeDisplay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') timeDisplay.blur();
  });

  const expandBtn = card.querySelector('.expand-btn');
  const daysContainer = card.querySelector('.days-container');

  const memoInput = card.querySelector('.memo-input');
  if (memoInput) {
    memoInput.addEventListener('mousedown', () => {
      card.draggable = false;
    });
    memoInput.addEventListener('focus', () => {
      card.draggable = false;
    });
    memoInput.addEventListener('blur', () => {
      card.draggable = true;
    });
    memoInput.addEventListener('change', () => {
      const a = appState.alarms.find(a => a.id === alarm.id);
      if (a) {
        a.memo = memoInput.value;
        saveState();
        if (callbacks && callbacks.renderCards) callbacks.renderCards();
      }
    });
  }

  expandBtn.addEventListener('click', () => {
    const a = appState.alarms.find(a => a.id === alarm.id);
    if (a) {
      a.expanded = !a.expanded;
      if (a.expanded) {
        expandBtn.classList.add('expanded');
        daysContainer.classList.add('show');
        expandBtn.textContent = '▲ ' + dict.advancedSettings;
      } else {
        expandBtn.classList.remove('expanded');
        daysContainer.classList.remove('show');
        expandBtn.textContent = '▼ ' + dict.advancedSettings;
      }
      saveState();
    }
  });

  const dayBtns = card.querySelectorAll('.day-btn');
  dayBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const d = parseInt(btn.dataset.day, 10);
      const a = appState.alarms.find(a => a.id === alarm.id);
      if (a) {
        if (a.days.includes(d)) {
          a.days = a.days.filter(day => day !== d);
          btn.classList.remove('selected');
        } else {
          a.days.push(d);
          a.days.sort();
          btn.classList.add('selected');
        }
        if (a.enabled) {
          const nextTime = calculateNextAlarmTime(a.time, a.days, a.skippedDate);
          if (nextTime) {
            await chrome.alarms.create(a.id, { when: nextTime });
          } else {
            a.enabled = false;
            card.querySelector('.alarm-toggle').checked = false;
            await chrome.alarms.clear(a.id);
          }
        }
        saveState();
      }
    });
  });

  const toggle = card.querySelector('.alarm-toggle');
  toggle.addEventListener('change', async (e) => {
    const a = appState.alarms.find(a => a.id === alarm.id);
    if (!a) return;
    a.enabled = e.target.checked;
    
    if (a.enabled) {
      const nextTime = calculateNextAlarmTime(a.time, a.days, a.skippedDate);
      if (nextTime) {
        await chrome.alarms.create(a.id, { when: nextTime });
      } else {
        a.enabled = false;
        e.target.checked = false;
      }
    } else {
      a.skippedDate = null;
      await chrome.alarms.clear(a.id);
      chrome.runtime.sendMessage({ action: "stopAudio" }).catch(() => {});
    }
    saveState();
    if (callbacks && callbacks.renderCards) callbacks.renderCards();
  });

  const skipBtn = card.querySelector('.skip-btn');
  if (skipBtn) {
    skipBtn.addEventListener('click', async () => {
      const a = appState.alarms.find(a => a.id === alarm.id);
      if (a) {
        const now = new Date();
        a.skippedDate = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
        const nextTime = calculateNextAlarmTime(a.time, a.days, a.skippedDate);
        if (nextTime) {
          await chrome.alarms.create(a.id, { when: nextTime });
        } else {
          a.enabled = false;
          card.querySelector('.alarm-toggle').checked = false;
          await chrome.alarms.clear(a.id);
        }
        saveState();
        if (callbacks && callbacks.renderCards) callbacks.renderCards();
      }
    });
  }

  return card;
}
