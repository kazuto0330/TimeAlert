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

// UUID Generator
function generateId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}

document.addEventListener('DOMContentLoaded', async () => {
  const tabs = document.querySelectorAll('.tab-button');
  const addBtn = document.getElementById('add-btn');
  const cardList = document.getElementById('card-list');
  
  let currentTab = 'timer';
  let appState = { timers: [], alarms: [] };
  let timerInterval = null;

  // Load initial state
  const data = await chrome.storage.sync.get(['timers', 'alarms']);
  if (data.timers) appState.timers = data.timers;
  if (data.alarms) appState.alarms = data.alarms;
  
  renderCards();
  startUITimer();

  // Listen for storage changes (e.g. from background.js when alarm fires)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
      if (changes.timers) appState.timers = changes.timers.newValue || [];
      if (changes.alarms) appState.alarms = changes.alarms.newValue || [];
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
    if (currentTab === 'timer') {
      const maxNum = appState.timers.reduce((max, t) => {
        const match = t.title.match(/^タイマー(\d+)$/);
        if (match) return Math.max(max, parseInt(match[1], 10));
        return max;
      }, 0);
      
      const newTimer = {
        id: generateId('timer'),
        title: `タイマー${maxNum + 1}`,
        originalSeconds: 0,
        state: 'idle',
        endTime: null
      };
      
      appState.timers.unshift(newTimer); // Add to top
      saveState();
    } else {
      // TODO: Alarm logic
      console.log('アラーム追加は後で実装');
    }
  });

  function saveState() {
    chrome.storage.sync.set({ timers: appState.timers, alarms: appState.alarms });
  }

  function startUITimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (currentTab === 'timer') {
        const timeDisplays = document.querySelectorAll('.time-display[data-running="true"]');
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
    }, 100); // 100ms for smooth update
  }

  function renderCards() {
    cardList.innerHTML = '';
    const currentList = currentTab === 'timer' ? appState.timers : appState.alarms;
    
    if (currentList.length === 0) {
      cardList.innerHTML = `<p class="empty-message">右下の＋ボタンから追加してください</p>`;
      return;
    }

    currentList.forEach((item, index) => {
      if (currentTab === 'timer') {
        const card = createTimerCard(item);
        cardList.appendChild(card);
      } else {
        // TODO: Alarm card
      }
    });
  }

  // D&D state
  let draggedCardId = null;

  function createTimerCard(timer) {
    const card = document.createElement('div');
    card.className = 'card timer-card';
    card.dataset.id = timer.id;
    card.draggable = true; // For drag&drop
    
    const isRunning = timer.state === 'running';
    let displayTime = formatSeconds(timer.originalSeconds);
    if (isRunning) {
      const remaining = Math.max(0, Math.ceil((timer.endTime - Date.now()) / 1000));
      displayTime = formatSeconds(remaining);
    }

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
        <button class="play-stop-btn ${isRunning ? 'stop' : 'play'}">
          ${isRunning ? '⏹' : '▶'}
        </button>
      </div>
    `;

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
      const t = appState.timers.find(t => t.id === timer.id);
      if (t && t.title !== newTitle) {
        t.title = newTitle;
        saveState();
      }
    });
    titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') titleInput.blur();
    });

    // Time editing
    const timeDisplay = card.querySelector('.time-display');
    timeDisplay.addEventListener('focus', () => {
      if (!isRunning) {
        timeDisplay.dataset.prevValue = timeDisplay.value;
        if (timer.originalSeconds === 0) timeDisplay.value = '';
      }
    });
    timeDisplay.addEventListener('blur', () => {
      if (!isRunning) {
        const input = timeDisplay.value;
        const seconds = parseTimeToSeconds(input);
        const t = appState.timers.find(t => t.id === timer.id);
        if (t) {
          t.originalSeconds = seconds;
          timeDisplay.value = formatSeconds(seconds); // Empty fix
          saveState(); // triggers re-render
        }
      }
    });
    timeDisplay.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') timeDisplay.blur();
    });

    // Play/Stop toggle
    const playStopBtn = card.querySelector('.play-stop-btn');
    playStopBtn.addEventListener('click', async () => {
      const t = appState.timers.find(t => t.id === timer.id);
      if (!t) return;

      if (t.state === 'idle') {
        if (t.originalSeconds > 0) {
          t.state = 'running';
          t.endTime = Date.now() + t.originalSeconds * 1000;
          await chrome.alarms.create(t.id, { when: t.endTime });
          saveState(); // triggers re-render
        }
      } else {
        // Stop (Pause / Keep remaining time)
        t.state = 'idle';
        const remaining = Math.max(0, Math.ceil((t.endTime - Date.now()) / 1000));
        t.originalSeconds = remaining;
        t.endTime = null;
        await chrome.alarms.clear(t.id);
        saveState(); // triggers re-render
        
        // Ensure notification is removed if it was showing
        chrome.runtime.sendMessage({ action: "stopAudio" }).catch(() => {});
      }
    });

    // Delete
    const deleteBtn = card.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', async () => {
      appState.timers = appState.timers.filter(t => t.id !== timer.id);
      await chrome.alarms.clear(timer.id);
      saveState(); // triggers re-render
    });

    // Drag and Drop Events
    card.addEventListener('dragstart', (e) => {
      draggedCardId = timer.id;
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
      if (!draggedCardId || draggedCardId === timer.id) return;
      
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
      
      if (!draggedCardId || draggedCardId === timer.id) return;

      const currentList = currentTab === 'timer' ? appState.timers : appState.alarms;
      const draggedIndex = currentList.findIndex(t => t.id === draggedCardId);
      const targetIndex = currentList.findIndex(t => t.id === timer.id);

      if (draggedIndex > -1 && targetIndex > -1) {
        const bounding = card.getBoundingClientRect();
        const offset = bounding.y + (bounding.height / 2);
        const insertAfter = (e.clientY - offset > 0);

        const [draggedItem] = currentList.splice(draggedIndex, 1);
        const newTargetIndex = currentList.findIndex(t => t.id === timer.id);
        
        if (insertAfter) {
          currentList.splice(newTargetIndex + 1, 0, draggedItem);
        } else {
          currentList.splice(newTargetIndex, 0, draggedItem);
        }
        
        saveState();
        renderCards();
      }
    });

    return card;
  }
});
