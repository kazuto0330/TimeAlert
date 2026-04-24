export const i18n = {
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
    days: ['日', '月', '火', '水', '木', '金', '土'],
    advancedSettings: "詳細設定",
    addMemo: "メモを追加..."
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
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    advancedSettings: "Advanced settings",
    addMemo: "Add note..."
  }
};

export const defaultSettings = {
  language: 'system',
  theme: 'system',
  volume: 50,
  sound: 'sounds/Clock-Alarm01-1(Low-Loop).mp3',
  autoEnableAlarm: true,
  lastTab: 'timer'
};

export let appState = { timers: [], alarms: [], settings: {} };

export function saveState() {
  chrome.storage.sync.set({ 
    timers: appState.timers, 
    alarms: appState.alarms,
    settings: appState.settings 
  });
}

export function applyLanguage(langPref, cardList, renderCardsFn) {
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
  
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    if (dict[key]) {
      el.title = dict[key];
    }
  });
  
  document.querySelectorAll('[data-i18n-alt]').forEach(el => {
    const key = el.dataset.i18nAlt;
    if (dict[key]) {
      el.alt = dict[key];
    }
  });
  
  if (cardList && cardList.children.length > 0 && !cardList.querySelector('.empty-message')) {
    if (renderCardsFn) renderCardsFn();
  } else if (cardList && cardList.querySelector('.empty-message')) {
    cardList.innerHTML = `<p class="empty-message" data-i18n="emptyMessage">${dict.emptyMessage}</p>`;
  }
}

export function applyTheme(themePref) {
  document.body.classList.remove('theme-light', 'theme-dark');
  if (themePref === 'light') {
    document.body.classList.add('theme-light');
  } else if (themePref === 'dark') {
    document.body.classList.add('theme-dark');
  }
}
