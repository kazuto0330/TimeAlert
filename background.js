// Service Worker: アラームの監視や通知の制御を行う

let pendingToasts = []; // OS通知を出して、まだ画面上にポップアップを出せていないアラームのリスト

// Utility: Calculate next alarm time
function calculateNextAlarmTime(timeStr, days, skippedDate = null) {
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);

  if (days && days.length > 0) {
    for (let i = 0; i <= 7; i++) {
      const checkDate = new Date(target.getTime() + i * 24 * 60 * 60 * 1000);
      if (i === 0 && checkDate.getTime() <= now.getTime()) {
        continue;
      }
      
      const checkDateStr = `${checkDate.getFullYear()}-${(checkDate.getMonth()+1).toString().padStart(2, '0')}-${checkDate.getDate().toString().padStart(2, '0')}`;
      if (skippedDate === checkDateStr) {
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

// 拡張機能インストール時の処理
chrome.runtime.onInstalled.addListener(() => {
  console.log("Time Alert 拡張機能がインストールされました");
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));
});

// ブラウザのウィンドウがアクティブになったときの処理
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    checkAndShowPendingToasts();
  }
});

// タブが切り替わったときの処理
chrome.tabs.onActivated.addListener(() => {
  checkAndShowPendingToasts();
});

// pendingToastsが存在する場合、現在のアクティブタブにポップアップを表示する
function checkAndShowPendingToasts() {
  if (pendingToasts.length === 0) return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const activeTab = tabs[0];
      if (activeTab.url && !activeTab.url.startsWith('chrome://') && !activeTab.url.startsWith('chrome-extension://')) {
        pendingToasts.forEach(toast => {
          chrome.tabs.sendMessage(activeTab.id, { 
            action: "showNotification", 
            alarmId: toast.title 
          }).then(() => {
            chrome.notifications.clear(toast.alarmId);
            pendingToasts = pendingToasts.filter(t => t.alarmId !== toast.alarmId);
          }).catch(err => {
            console.warn("Pending toast send failed:", err);
          });
        });
      }
    }
  });
}

function addPendingToast(alarmId, title) {
  if (!pendingToasts.find(t => t.alarmId === alarmId)) {
    pendingToasts.push({ alarmId, title });
  }
}

// アラーム発火時の処理
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log("Alarm triggered:", alarm.name);

  await playAudio();

  let notificationTitle = "時間になりました！";

  if (alarm.name.startsWith('timer_')) {
    const data = await chrome.storage.sync.get('timers');
    if (data.timers) {
      const timer = data.timers.find(t => t.id === alarm.name);
      if (timer) notificationTitle = timer.title;

      const updatedTimers = data.timers.map(t => 
        t.id === alarm.name ? { ...t, state: 'idle', endTime: null } : t
      );
      await chrome.storage.sync.set({ timers: updatedTimers });
    }
  } else if (alarm.name.startsWith('alarm_')) {
    const data = await chrome.storage.sync.get('alarms');
    if (data.alarms) {
      const a = data.alarms.find(a => a.id === alarm.name);
      if (a) notificationTitle = a.title;

      let nextTime = null;
      const updatedAlarms = data.alarms.map(al => {
        if (al.id === alarm.name) {
          if (al.days && al.days.length > 0) {
            nextTime = calculateNextAlarmTime(al.time, al.days, al.skippedDate);
            return al; // 状態は維持（繰り返し）
          } else {
            return { ...al, enabled: false }; // 1回きりなので無効化
          }
        }
        return al;
      });
      await chrome.storage.sync.set({ alarms: updatedAlarms });
      
      if (nextTime) {
        await chrome.alarms.create(alarm.name, { when: nextTime });
      }
    }
  }

  // 通知の表示処理
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const activeTab = tabs[0];
      if (activeTab.url && !activeTab.url.startsWith('chrome://') && !activeTab.url.startsWith('chrome-extension://')) {
        chrome.tabs.sendMessage(activeTab.id, { 
          action: "showNotification", 
          alarmId: notificationTitle
        }).catch(err => {
          console.warn("Content script not ready, fallback to system notification.", err);
          showSystemNotification(alarm.name, notificationTitle);
          addPendingToast(alarm.name, notificationTitle);
        });
      } else {
        showSystemNotification(alarm.name, notificationTitle);
        addPendingToast(alarm.name, notificationTitle);
      }
    } else {
      showSystemNotification(alarm.name, notificationTitle);
      addPendingToast(alarm.name, notificationTitle);
    }
  });
});

// Offscreen Document の作成と音声再生
async function playAudio() {
  const offscreenUrl = chrome.runtime.getURL('offscreen/offscreen.html');
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length === 0) {
    if (chrome.offscreen) {
      await chrome.offscreen.createDocument({
        url: 'offscreen/offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'To play timer and alarm notification sounds'
      });
    }
  }

  // 設定を取得
  const syncData = await chrome.storage.sync.get('settings');
  const localData = await chrome.storage.local.get('customSoundData');
  const settings = syncData.settings || {};
  const volume = settings.volume !== undefined ? settings.volume : 50;
  let url = null;

  if (settings.sound === 'custom' && localData.customSoundData) {
    url = localData.customSoundData;
  } else if (settings.sound) {
    url = chrome.runtime.getURL(settings.sound);
  }
  
  chrome.runtime.sendMessage({ action: 'playAudio', url, volume }).catch(e => console.error(e));
}

// ポップアップ通知からの停止メッセージ等を受け取る
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "stopAudio") {
    pendingToasts.forEach(toast => {
      chrome.notifications.clear(toast.alarmId);
    });
    pendingToasts = [];
  } else if (msg.action === "playAudio" && sender.id === chrome.runtime.id && !sender.url?.includes('offscreen.html')) {
    playAudio().catch(e => console.error(e));
  }
});

// システム通知を表示する
function showSystemNotification(alarmId, title) {
  chrome.notifications.create(alarmId, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Time Alert",
    message: title,
    buttons: [{ title: "ストップ" }],
    requireInteraction: true
  });
}

// システム通知のボタンクリック処理
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    console.log("Notification stopped:", notificationId);
    pendingToasts = pendingToasts.filter(t => t.alarmId !== notificationId);
    chrome.runtime.sendMessage({ action: "stopAudio" }).catch(() => {});
  }
});

// システム通知が（ボタンではなく）閉じられた場合
chrome.notifications.onClosed.addListener((notificationId, byUser) => {
  if (byUser) {
    pendingToasts = pendingToasts.filter(t => t.alarmId !== notificationId);
    chrome.runtime.sendMessage({ action: "stopAudio" }).catch(() => {});
  }
});
