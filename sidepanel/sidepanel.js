// Utility: Convert full-width numbers to half-width
function toHalfWidth(str) {
  return str.replace(/[０-９]/g, function(s) {
    return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
  });
}

// Utility: Parse user input to total seconds
function parseTimeToSeconds(input) {
  let s = toHalfWidth(input).replace(/[^0-9]/g, '');
  if (!s) return 0;
  
  let h = 0, m = 0, sec = 0;
  if (s.length <= 2) {
    sec = parseInt(s, 10);
  } else if (s.length === 3) {
    m = parseInt(s.slice(0, 1), 10);
    sec = parseInt(s.slice(1, 3), 10);
  } else if (s.length === 4) {
    m = parseInt(s.slice(0, 2), 10);
    sec = parseInt(s.slice(2, 4), 10);
  } else if (s.length === 5) {
    h = parseInt(s.slice(0, 1), 10);
    m = parseInt(s.slice(1, 3), 10);
    sec = parseInt(s.slice(3, 5), 10);
  } else {
    h = parseInt(s.slice(0, s.length - 4), 10);
    m = parseInt(s.slice(-4, -2), 10);
    sec = parseInt(s.slice(-2), 10);
  }
  return h * 3600 + m * 60 + sec;
}

// Utility: Format seconds to MM:SS or HH:MM:SS
function formatSeconds(totalSeconds) {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  
  const mStr = m.toString().padStart(2, '0');
  const sStr = s.toString().padStart(2, '0');
  
  if (h > 0) {
    const hStr = h.toString().padStart(2, '0');
    return `${hStr}:${mStr}:${sStr}`;
  }
  return `${mStr}:${sStr}`;
}

// Utility: Parse Alarm Time input to HH:MM
function parseAlarmTime(input) {
  let s = toHalfWidth(input).replace(/[^0-9]/g, '');
  if (!s) return "00:00";
  let h = 0, m = 0;
  if (s.length <= 2) {
    h = parseInt(s, 10);
  } else if (s.length === 3) {
    h = parseInt(s.slice(0, 1), 10);
    m = parseInt(s.slice(1, 3), 10);
  } else {
    h = parseInt(s.slice(0, s.length - 2), 10);
    m = parseInt(s.slice(-2), 10);
  }
  h = Math.min(23, h);
  m = Math.min(59, m);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Utility: Calculate next alarm time
function calculateNextAlarmTime(timeStr, days) {
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);

  if (days && days.length > 0) {
    for (let i = 0; i <= 7; i++) {
      const checkDate = new Date(target.getTime() + i * 24 * 60 * 60 * 1000);
      if (i === 0 && checkDate.getTime() <= now.getTime()) {
        continue;
      }
      if (days.includes(checkDate.getDay())) {
        return checkDate.getTime();
      }
    }
  } else {
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    return target.getTime();
  }
  return null;
}

// UUID Generator
function generateId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}

document.addEventListener('DOMContentLoaded', async () => {
  const tabs = document.querySelectorAll('.tab-button');
  const addBtn = document.getElementById('add-btn');
  const cardList = document.getElementById('card-list');

  // --- i18n Data & Functions ---
  const i18n = {
    ja: {
      tabTimer: "タイマー",
      tabAlarm: "アラーム",
      emptyMessage: "右下の＋ボタンから追加してください",
      settingsTitle: "設定",
      settingLanguage: "言語 (Language)",
      optSystem: "システムデフォルト (System Default)",
      settingTheme: "テーマ",
      optLight: "ライトモード",
      optDark: "ダークモード",
      settingVolume: "通知音の音量",
      settingSound: "通知音",
      optCustom: "オリジナル音源 (アップロード)",
      settingUpload: "オリジナル音源をアップロード (5MB以下)",
      settingAutoEnable: "アラーム時刻変更時に自動でONにする",
      days: ['日', '月', '火', '水', '木', '金', '土']
    },
    en: {
      tabTimer: "Timer",
      tabAlarm: "Alarm",
      emptyMessage: "Add from the + button on the bottom right",
      settingsTitle: "Settings",
      settingLanguage: "Language",
      optSystem: "System Default",
      settingTheme: "Theme",
      optLight: "Light Mode",
      optDark: "Dark Mode",
      settingVolume: "Alarm Volume",
      settingSound: "Alarm Sound",
      optCustom: "Custom Audio (Upload)",
      settingUpload: "Upload Custom Audio (Max 5MB)",
      settingAutoEnable: "Auto-enable alarm on time change",
      days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    }
  };

  function applyLanguage(langPref) {
    let lang = langPref;
    if (lang === 'system' || !lang) {
      lang = navigator.language.startsWith('ja') ? 'ja' : 'en';
    }
    const dict = i18n[lang] || i18n.en;
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (dict[key]) {
        el.textContent = dict[key];
      }
    });
    
    if (cardList && cardList.children.length > 0 && !cardList.querySelector('.empty-message')) {
      renderCards();
    } else if (cardList && cardList.querySelector('.empty-message')) {
      cardList.innerHTML = `<p class="empty-message" data-i18n="emptyMessage">${dict.emptyMessage}</p>`;
    }
  }

  function applyTheme(themePref) {
    document.body.classList.remove('theme-light', 'theme-dark');
    if (themePref === 'light') {
      document.body.classList.add('theme-light');
    } else if (themePref === 'dark') {
      document.body.classList.add('theme-dark');
    }
  }
  // -----------------------------
  
  let currentTab = 'timer';
  let appState = { timers: [], alarms: [], settings: {} };
  let timerInterval = null;

  const defaultSettings = {
    language: 'system',
    theme: 'system',
    volume: 50,
    sound: 'sounds/Clock-Alarm01-1(Low-Loop).mp3',
    autoEnableAlarm: true
  };

  // Load initial state
  const data = await chrome.storage.sync.get(['timers', 'alarms', 'settings']);
  if (data.timers) {
    appState.timers = data.timers.map(t => {
      if (t.initialSeconds === undefined) {
        t.initialSeconds = t.originalSeconds;
      }
      return t;
    });
  }
  if (data.alarms) appState.alarms = data.alarms;
  appState.settings = { ...defaultSettings, ...(data.settings || {}) };
  
  applyTheme(appState.settings.theme);
  applyLanguage(appState.settings.language);
  
  renderCards();
  startUITimer();

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
      if (changes.timers) appState.timers = changes.timers.newValue || [];
      if (changes.alarms) appState.alarms = changes.alarms.newValue || [];
      if (changes.settings) {
        appState.settings = { ...defaultSettings, ...(changes.settings.newValue || {}) };
        applyTheme(appState.settings.theme);
        applyLanguage(appState.settings.language);
      }
      renderCards();
    }
  });

  // Tab Switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      renderCards();
    });
  });

  // Add Button
  addBtn.addEventListener('click', () => {
    const lang = appState.settings.language === 'system' || !appState.settings.language 
      ? (navigator.language.startsWith('ja') ? 'ja' : 'en') 
      : appState.settings.language;
    const dict = i18n[lang] || i18n.en;

    if (currentTab === 'timer') {
      const maxNum = appState.timers.reduce((max, t) => {
        const match = t.title.match(/^(?:タイマー|Timer)(\d+)$/);
        return match ? Math.max(max, parseInt(match[1], 10)) : max;
      }, 0);
      
      const newTimer = {
        id: generateId('timer'),
        title: `${dict.tabTimer}${maxNum + 1}`,
        originalSeconds: 0,
        initialSeconds: 0,
        state: 'idle',
        endTime: null
      };
      
      appState.timers.unshift(newTimer);
    } else {
      const maxNum = appState.alarms.reduce((max, a) => {
        const match = a.title.match(/^(?:アラーム|Alarm)(\d+)$/);
        return match ? Math.max(max, parseInt(match[1], 10)) : max;
      }, 0);
      
      const newAlarm = {
        id: generateId('alarm'),
        title: `${dict.tabAlarm}${maxNum + 1}`,
        time: "00:00",
        enabled: false,
        days: [],
        expanded: false
      };
      
      appState.alarms.unshift(newAlarm);
    }
    saveState();
  });

  function saveState() {
    chrome.storage.sync.set({ 
      timers: appState.timers, 
      alarms: appState.alarms,
      settings: appState.settings 
    });
  }

  function startUITimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (currentTab === 'timer') {
        const timeDisplays = document.querySelectorAll('.timer-card .time-display[data-running="true"]');
        timeDisplays.forEach(display => {
          const endTime = parseInt(display.dataset.endtime, 10);
          const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
          if (remaining > 0) {
            display.value = formatSeconds(remaining);
          } else {
            display.value = '00:00';
          }
        });
      }
    }, 100);
  }

  function renderCards() {
    cardList.innerHTML = '';
    const currentList = currentTab === 'timer' ? appState.timers : appState.alarms;
    
    if (currentList.length === 0) {
      cardList.innerHTML = `<p class="empty-message" data-i18n="emptyMessage"></p>`;
      applyLanguage(appState.settings.language);
      return;
    }

    currentList.forEach((item) => {
      const card = currentTab === 'timer' ? createTimerCard(item) : createAlarmCard(item);
      setupCardCommonEvents(card, item, currentTab);
      cardList.appendChild(card);
    });
  }

  // D&D state
  let draggedCardId = null;

  function setupCardCommonEvents(card, item, tab) {
    // Title editing (Single Click)
    const titleInput = card.querySelector('.card-title');
    titleInput.addEventListener('click', () => {
      titleInput.readOnly = false;
      titleInput.focus();
      card.draggable = false; // 編集中はドラッグ無効
    });
    titleInput.addEventListener('blur', () => {
      titleInput.readOnly = true;
      card.draggable = true; // 編集終了でドラッグ有効に戻す
      const newTitle = titleInput.value.trim() || '名称未設定';
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

  function createTimerCard(timer) {
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

    card.innerHTML = `
      <div class="card-header">
        <input type="text" class="card-title" value="${timer.title}" readonly>
        <button class="delete-btn" title="削除">×</button>
      </div>
      <div class="card-body">
        <input type="text" class="time-display" 
          value="${displayTime}" 
          data-running="${isRunning}" 
          data-endtime="${timer.endTime || ''}"
          ${isRunning ? 'readonly' : ''}
        >
        <div class="timer-controls" style="display: flex; gap: 8px;">
          <button class="reset-btn play-stop-btn play" title="リセット" style="display: ${showReset ? 'flex' : 'none'};">
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
    timeDisplay.addEventListener('blur', () => {
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

  function createAlarmCard(alarm) {
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

    card.innerHTML = `
      <div class="card-header">
        <input type="text" class="card-title" value="${alarm.title}" readonly>
        <button class="delete-btn" title="削除">×</button>
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
      ${(!isExpanded && (activeDaysText || alarm.memo)) ? `
      <div class="alarm-summary">
        ${activeDaysText ? `<span class="summary-days">${activeDaysText}</span>` : ''}
        ${alarm.memo ? `<span class="summary-memo" title="${alarm.memo}">${alarm.memo}</span>` : ''}
      </div>` : ''}
      <button class="expand-btn ${isExpanded ? 'expanded' : ''}">${isExpanded ? '▲ 詳細設定' : '▼ 詳細設定'}</button>
      <div class="days-container ${isExpanded ? 'show' : ''}">
        <div class="days-row">
          ${daysOrder.map(d => `
            <button class="day-btn ${alarm.days.includes(d) ? 'selected' : ''}" data-day="${d}">
              ${daysLabels[d]}
            </button>
          `).join('')}
        </div>
        <input type="text" class="memo-input" placeholder="メモを追加..." value="${alarm.memo || ''}">
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
        a.time = parsed;
        timeDisplay.value = parsed;
        
        // 時刻が変更されたら設定に基づいて自動でONにする処理 (ただし入力が空の場合は除く)
        if (appState.settings.autoEnableAlarm && inputVal !== "") {
          a.enabled = true;
          card.querySelector('.alarm-toggle').checked = true;
          const nextTime = calculateNextAlarmTime(a.time, a.days);
          if (nextTime) {
            await chrome.alarms.create(a.id, { when: nextTime });
          } else {
            a.enabled = false;
            card.querySelector('.alarm-toggle').checked = false;
          }
        } else {
          // ONにしない場合でも時刻変更に伴い現在のアラームを再設定または解除する
          if (a.enabled) {
            const nextTime = calculateNextAlarmTime(a.time, a.days);
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

    // Expand button
    const expandBtn = card.querySelector('.expand-btn');
    const daysContainer = card.querySelector('.days-container');

    // Memo input
    const memoInput = card.querySelector('.memo-input');
    if (memoInput) {
      memoInput.addEventListener('change', () => {
        const a = appState.alarms.find(a => a.id === alarm.id);
        if (a) {
          a.memo = memoInput.value;
          saveState();
          renderCards();
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
          expandBtn.textContent = '▲ 詳細設定';
        } else {
          expandBtn.classList.remove('expanded');
          daysContainer.classList.remove('show');
          expandBtn.textContent = '▼ 詳細設定';
        }
        saveState();
      }
    });

    // Days selection
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
            const nextTime = calculateNextAlarmTime(a.time, a.days);
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

    // Toggle logic
    const toggle = card.querySelector('.alarm-toggle');
    toggle.addEventListener('change', async (e) => {
      const a = appState.alarms.find(a => a.id === alarm.id);
      if (!a) return;
      a.enabled = e.target.checked;
      
      if (a.enabled) {
        const nextTime = calculateNextAlarmTime(a.time, a.days);
        if (nextTime) {
          await chrome.alarms.create(a.id, { when: nextTime });
        } else {
          a.enabled = false;
          e.target.checked = false;
        }
      } else {
        await chrome.alarms.clear(a.id);
        chrome.runtime.sendMessage({ action: "stopAudio" }).catch(() => {});
      }
      saveState();
    });

    return card;
  }

  // --- Settings Link Logic ---

  const settingsBtn = document.getElementById('settings-btn');
  settingsBtn.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('settings/settings.html'));
    }
  });

});
