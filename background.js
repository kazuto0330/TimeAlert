// Service Worker: アラームの監視や通知の制御を行う

let pendingToasts = []; // OS通知を出して、まだ画面上にポップアップを出せていないアラームのリスト

// 拡張機能インストール時の処理
chrome.runtime.onInstalled.addListener(() => {
  console.log("Time Alert 拡張機能がインストールされました");
  
  // サイドパネルの有効化設定（アクションクリックでサイドパネルを開く）
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
            // タブへの送信が成功したらシステム通知を消し、pendingリストから除外
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

// アラーム発火時の処理（ハイブリッド通知の分岐）
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log("Alarm triggered:", alarm.name);

  // 音声の再生 (Offscreen API経由)
  await playAudio();

  // タイマーの場合はストレージの状態を 'idle' に戻す
  if (alarm.name.startsWith('timer_')) {
    const data = await chrome.storage.sync.get('timers');
    if (data.timers) {
      const updatedTimers = data.timers.map(t => {
        if (t.id === alarm.name) {
          return { ...t, state: 'idle', endTime: null };
        }
        return t;
      });
      await chrome.storage.sync.set({ timers: updatedTimers });
    }
  }

  // タイトル取得のための簡易的な処理（本来はstorageから取得するが今回はアラーム名を利用）
  let notificationTitle = "時間になりました！";
  if (alarm.name.startsWith('timer_')) {
    const data = await chrome.storage.sync.get('timers');
    const timer = data.timers?.find(t => t.id === alarm.name);
    if (timer) notificationTitle = timer.title;
  }

  // アクティブなタブを取得
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      // アクティブなタブが存在する場合はContent Scriptにメッセージを送信して通知UIを表示
      const activeTab = tabs[0];
      
      // 特殊なURL (chrome:// など) では Content Script が動作しないためチェック
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
      // アクティブなタブが存在しない場合はシステム通知を表示
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
  
  chrome.runtime.sendMessage({ action: 'playAudio' }).catch(e => console.error(e));
}

// ポップアップ通知からの停止メッセージを受け取る
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "stopAudio") {
    // 停止された場合、システム通知を消去し、pendingリストもクリアする
    pendingToasts.forEach(toast => {
      chrome.notifications.clear(toast.alarmId);
    });
    pendingToasts = [];
  }
});

// システム通知（OS標準の通知）を表示する
function showSystemNotification(alarmId, title) {
  chrome.notifications.create(alarmId, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Time Alert",
    message: title,
    buttons: [{ title: "ストップ" }],
    requireInteraction: true // ユーザーが閉じるまで表示し続ける
  });
}

// システム通知のボタンクリック処理
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    console.log("Notification stopped:", notificationId);
    pendingToasts = pendingToasts.filter(t => t.alarmId !== notificationId);
    // 音声の停止
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
