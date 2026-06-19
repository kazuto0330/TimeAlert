// Content Script: 画面上部からのスライドイン通知UIを描画・制御する

// Backgroundからのメッセージを受信
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "showNotification") {
    showToastNotification(request.alarmId);
    sendResponse({ status: "ok" });
  }
  return true;
});

const i18n = {
  ja: {
    timeUp: "時間になりました！",
    stop: "ストップ"
  },
  en: {
    timeUp: "Time is up!",
    stop: "Stop"
  }
};

async function showToastNotification(title) {
  const settingsData = await chrome.storage.sync.get('settings');
  const langPref = settingsData.settings?.language || 'system';
  let lang = langPref;
  if (lang === 'system' || !lang) {
    lang = navigator.language.startsWith('ja') ? 'ja' : 'en';
  }
  const dict = i18n[lang] || i18n.en;

  // 既に通知が存在する場合は削除
  const existingToast = document.getElementById('time-alert-toast');
  if (existingToast) {
    existingToast.remove();
  }

  // トーストコンテナの作成
  const toast = document.createElement('div');
  toast.id = 'time-alert-toast';
  
  // 内部HTML (タイトルとストップボタン、アクセントカラーはオレンジ)
  toast.innerHTML = `
    <div class="ta-toast-content">
      <div class="ta-toast-icon">⏰</div>
      <div class="ta-toast-text">
        <div class="ta-toast-title">Time Alert</div>
        <div class="ta-toast-message">${title || dict.timeUp}</div>
      </div>
      <button class="ta-toast-stop-btn">${dict.stop}</button>
    </div>
  `;

  document.body.appendChild(toast);

  // ストップボタンのイベントリスナー
  const stopBtn = toast.querySelector('.ta-toast-stop-btn');
  stopBtn.addEventListener('click', () => {
    // BackgroundのOffscreen Documentに音声停止を要求
    chrome.runtime.sendMessage({ action: "stopAudio" }).catch(() => {});
    
    // スライドアウトアニメーション
    toast.classList.add('ta-slide-out');
    setTimeout(() => {
      toast.remove();
    }, 300); // CSSのトランジション時間と合わせる
  });
  
  // 強制リフローさせてアニメーションを発火
  void toast.offsetWidth;
  toast.classList.add('ta-show');
}
