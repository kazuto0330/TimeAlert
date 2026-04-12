// Service Worker: アラームの監視や通知の制御を行う

// 拡張機能インストール時の処理
chrome.runtime.onInstalled.addListener(() => {
  console.log("Time Alert 拡張機能がインストールされました");
  
  // サイドパネルの有効化設定（アクションクリックでサイドパネルを開く）
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));
});

// アラーム発火時の処理（ハイブリッド通知の分岐）
chrome.alarms.onAlarm.addListener((alarm) => {
  console.log("Alarm triggered:", alarm.name);

  // アクティブなタブを取得
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      // アクティブなタブが存在する場合はContent Scriptにメッセージを送信して通知UIを表示
      const activeTab = tabs[0];
      
      // 特殊なURL (chrome:// など) では Content Script が動作しないためチェック
      if (activeTab.url && !activeTab.url.startsWith('chrome://')) {
        chrome.tabs.sendMessage(activeTab.id, { 
          action: "showNotification", 
          alarmId: alarm.name 
        }).catch(err => {
          console.warn("Content script not ready, fallback to system notification.", err);
          showSystemNotification(alarm.name);
        });
      } else {
        showSystemNotification(alarm.name);
      }
    } else {
      // アクティブなタブが存在しない場合はシステム通知を表示
      showSystemNotification(alarm.name);
    }
  });
});

// システム通知（OS標準の通知）を表示する
function showSystemNotification(alarmId) {
  chrome.notifications.create(alarmId, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Time Alert",
    message: "時間になりました！",
    buttons: [{ title: "ストップ" }],
    requireInteraction: true // ユーザーが閉じるまで表示し続ける
  });
}

// システム通知のボタンクリック処理
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    console.log("Notification stopped:", notificationId);
    // 音声の停止や状態のリセット処理をここに記述
  }
});
