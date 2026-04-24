import { appState, defaultSettings, saveState, applyLanguage, applyTheme, i18n } from './state.js';
import { formatSeconds, calculateNextAlarmTime, generateId } from './utils.js';
import { createTimerCard, createAlarmCard, setupCardCommonEvents } from './components.js';

let currentTab = 'timer';
let timerInterval = null;
let activeItemToStop = null;

let tabs, addBtn, cardList, activeHeaderContainer, activeHeaderTitle, activeHeaderTime, activeHeaderStopBtn;

document.addEventListener('DOMContentLoaded', async () => {
  tabs = document.querySelectorAll('.tab-button');
  addBtn = document.getElementById('add-btn');
  cardList = document.getElementById('card-list');
  activeHeaderContainer = document.getElementById('active-header-container');
  activeHeaderTitle = document.getElementById('active-header-title');
  activeHeaderTime = document.getElementById('active-header-time');
  activeHeaderStopBtn = document.getElementById('active-header-stop-btn');

  activeHeaderStopBtn.addEventListener('click', async () => {
    if (!activeItemToStop) return;
    if (currentTab === 'timer') {
      const t = appState.timers.find(timer => timer.id === activeItemToStop.id);
      if (t) {
        t.state = 'idle';
        const remaining = Math.max(0, Math.ceil((t.endTime - Date.now()) / 1000));
        t.originalSeconds = remaining;
        t.endTime = null;
        await chrome.alarms.clear(t.id);
        saveState();
        chrome.runtime.sendMessage({ action: "stopAudio" }).catch(() => {});
        renderCards();
      }
    } else if (currentTab === 'alarm') {
      const a = appState.alarms.find(alarm => alarm.id === activeItemToStop.id);
      if (a) {
        a.enabled = false;
        await chrome.alarms.clear(a.id);
        saveState();
        chrome.runtime.sendMessage({ action: "stopAudio" }).catch(() => {});
        renderCards();
      }
    }
  });

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
  
  currentTab = appState.settings.lastTab || 'timer';
  tabs.forEach(t => {
    if (t.dataset.tab === currentTab) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });

  applyTheme(appState.settings.theme);
  applyLanguage(appState.settings.language, cardList, renderCards);
  
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
        applyLanguage(appState.settings.language, cardList, renderCards);
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
      appState.settings.lastTab = currentTab;
      saveState();
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

  const settingsBtn = document.getElementById('settings-btn');
  settingsBtn.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('settings/settings.html'));
    }
  });
});

function updateActiveHeader() {
  if (currentTab === 'timer') {
    const runningTimers = appState.timers.filter(t => t.state === 'running');
    if (runningTimers.length > 0) {
      const shortestTimer = runningTimers.reduce((prev, curr) => (prev.endTime < curr.endTime ? prev : curr));
      const remaining = Math.max(0, Math.ceil((shortestTimer.endTime - Date.now()) / 1000));
      activeHeaderContainer.style.display = 'flex';
      activeHeaderTitle.textContent = shortestTimer.title;
      activeHeaderTime.textContent = formatSeconds(remaining);
      activeItemToStop = shortestTimer;
    } else {
      activeHeaderContainer.style.display = 'none';
      activeItemToStop = null;
    }
  } else if (currentTab === 'alarm') {
    const activeAlarms = appState.alarms.filter(a => a.enabled);
    let nextAlarm = null;
    let minNextTime = Infinity;

    activeAlarms.forEach(a => {
      const nextTime = calculateNextAlarmTime(a.time, a.days);
      if (nextTime && nextTime < minNextTime) {
        minNextTime = nextTime;
        nextAlarm = a;
      }
    });

    if (nextAlarm && minNextTime !== Infinity) {
      const remaining = Math.max(0, Math.ceil((minNextTime - Date.now()) / 1000));
      activeHeaderContainer.style.display = 'flex';
      activeHeaderTitle.textContent = nextAlarm.title;
      activeHeaderTime.textContent = formatSeconds(remaining);
      activeItemToStop = nextAlarm;
    } else {
      activeHeaderContainer.style.display = 'none';
      activeItemToStop = null;
    }
  }
}

function startUITimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    updateActiveHeader();
    
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

export function renderCards() {
  if (!cardList) return;
  cardList.innerHTML = '';
  const currentList = currentTab === 'timer' ? appState.timers : appState.alarms;
  
  if (currentList.length === 0) {
    cardList.innerHTML = `<p class="empty-message" data-i18n="emptyMessage"></p>`;
    applyLanguage(appState.settings.language, cardList, renderCards);
    return;
  }

  currentList.forEach((item) => {
    let card;
    if (currentTab === 'timer') {
      card = createTimerCard(item);
    } else {
      card = createAlarmCard(item, { renderCards });
    }
    setupCardCommonEvents(card, item, currentTab);
    cardList.appendChild(card);
  });
}
