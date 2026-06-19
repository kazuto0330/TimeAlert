document.addEventListener('DOMContentLoaded', async () => {
  const i18n = {
    ja: {
      settingsTitle: "設定 - Time Alert",
      tabGeneral: "一般",
      tabAppearance: "外観",
      tabSound: "サウンド",
      tabAbout: "概要",
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
      settingAutoEnableDesc: "時刻を変更した際、自動的にアラームを有効化します。",
      settingAutoEnableTimer: "タイマー時間変更時に自動でONにする",
      settingAutoEnableTimerDesc: "時間を変更した際、自動的にタイマーを有効化します。",
      settingAboutLinks: "リンク集",
      settingOtoLogicCredit: "当拡張機能では、OtoLogicの素材を使用しています。",
      uploadSizeError: "ファイルサイズが5MBを超えています。",
      uploadSuccess: "アップロード成功！",
      uploadFail: "保存に失敗しました（容量制限の可能性があります）。"
      },
      en: {
      settingsTitle: "Settings - Time Alert",
      tabGeneral: "General",
      tabAppearance: "Appearance",
      tabSound: "Sound",
      tabAbout: "About",
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
      settingAutoEnableDesc: "Automatically enables the alarm when the time is modified.",
      settingAutoEnableTimer: "Auto-enable timer on time change",
      settingAutoEnableTimerDesc: "Automatically enables the timer when the time is modified.",
      settingAboutLinks: "Links",
      settingOtoLogicCredit: "This extension uses sound materials from OtoLogic.",
      uploadSizeError: "File size exceeds 5MB.",
      uploadSuccess: "Upload successful!",
      uploadFail: "Failed to save (storage limit may have been reached)."
      }
  };

  const defaultSettings = {
    language: 'system',
    theme: 'system',
    volume: 50,
    sound: 'sounds/Clock-Alarm01-1(Low-Loop).mp3',
    autoEnableAlarm: true,
    autoEnableTimer: true
  };

  let appSettings = { ...defaultSettings };

  function applyLanguage(langPref) {
    let lang = langPref;
    if (lang === 'system' || !lang) {
      lang = navigator.language.startsWith('ja') ? 'ja' : 'en';
    }
    const dict = i18n[lang] || i18n.en;
    
    document.title = dict.settingsTitle;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (dict[key]) {
        if (el.tagName === 'OPTION') {
          el.textContent = dict[key];
        } else {
          el.textContent = dict[key];
        }
      }
    });

    const activeTab = document.querySelector('.nav-tab.active');
    if (activeTab) {
        document.getElementById('current-tab-title').textContent = activeTab.textContent;
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

  // Load Initial Settings
  const data = await chrome.storage.sync.get(['settings']);
  if (data.settings) {
    appSettings = { ...defaultSettings, ...data.settings };
  }
  
  applyTheme(appSettings.theme);
  applyLanguage(appSettings.language);

  // Sync state changes from other pages
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.settings) {
      appSettings = { ...defaultSettings, ...(changes.settings.newValue || {}) };
      applyTheme(appSettings.theme);
      applyLanguage(appSettings.language);
      updateUI();
    }
  });

  // UI Elements
  const tabs = document.querySelectorAll('.nav-tab');
  const panels = document.querySelectorAll('.tab-panel');
  const tabTitle = document.getElementById('current-tab-title');

  const langSelect = document.getElementById('setting-language');
  const themeSelect = document.getElementById('setting-theme');
  const volumeInput = document.getElementById('setting-volume');
  const volumeVal = document.getElementById('volume-val');
  const soundSelect = document.getElementById('setting-sound');
  const uploadContainer = document.getElementById('upload-container');
  const uploadInput = document.getElementById('setting-upload');
  const uploadStatus = document.getElementById('upload-status');
  const autoEnableCheckbox = document.getElementById('setting-auto-enable');
  const autoEnableTimerCheckbox = document.getElementById('setting-auto-enable-timer');

  function updateUI() {
    langSelect.value = appSettings.language;
    themeSelect.value = appSettings.theme;
    volumeInput.value = appSettings.volume;
    volumeVal.textContent = appSettings.volume;
    
    // settings.htmlからの相対パス調整
    let soundVal = appSettings.sound;
    if (soundVal && soundVal.startsWith('sounds/')) {
       soundVal = '../' + soundVal;
    }
    soundSelect.value = soundVal;
    autoEnableCheckbox.checked = appSettings.autoEnableAlarm !== false;
    autoEnableTimerCheckbox.checked = appSettings.autoEnableTimer !== false;
    
    uploadContainer.style.display = soundSelect.value === 'custom' ? 'flex' : 'none';
  }

  updateUI();

  // Tab Switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      
      tab.classList.add('active');
      const targetPanel = document.getElementById(`panel-${tab.dataset.tab}`);
      targetPanel.classList.add('active');
      tabTitle.textContent = tab.textContent;
    });
  });

  // Save changes
  function saveSettings() {
    chrome.storage.sync.set({ settings: appSettings });
  }

  // Event Listeners
  langSelect.addEventListener('change', () => {
    appSettings.language = langSelect.value;
    applyLanguage(appSettings.language);
    saveSettings();
  });

  themeSelect.addEventListener('change', () => {
    appSettings.theme = themeSelect.value;
    applyTheme(appSettings.theme);
    saveSettings();
  });

  volumeInput.addEventListener('input', () => {
    volumeVal.textContent = volumeInput.value;
  });

  volumeInput.addEventListener('change', () => {
    appSettings.volume = parseInt(volumeInput.value, 10);
    saveSettings();
    chrome.runtime.sendMessage({ action: "playAudio", url: null, volume: appSettings.volume }).catch(() => {});
    setTimeout(() => chrome.runtime.sendMessage({ action: "stopAudio" }).catch(() => {}), 1500);
  });

  soundSelect.addEventListener('change', () => {
    let newSound = soundSelect.value;
    if (newSound.startsWith('../')) {
        newSound = newSound.replace('../', '');
    }
    appSettings.sound = newSound;
    uploadContainer.style.display = soundSelect.value === 'custom' ? 'flex' : 'none';
    saveSettings();
  });

  const previewSoundBtn = document.getElementById('preview-sound-btn');
  if (previewSoundBtn) {
    previewSoundBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: "playAudio", url: null, volume: appSettings.volume }).catch(() => {});
      setTimeout(() => chrome.runtime.sendMessage({ action: "stopAudio" }).catch(() => {}), 1500);
    });
  }

  const closeSettingsBtn = document.getElementById('close-settings-btn');
  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', async () => {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      if (tabs.length === 1) {
        history.back();
      } else {
        window.close();
      }
    });
  }

  uploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const lang = appSettings.language === 'system' || !appSettings.language
      ? (navigator.language.startsWith('ja') ? 'ja' : 'en')
      : appSettings.language;
    const dict = i18n[lang] || i18n.en;

    if (file.size > 5 * 1024 * 1024) {
      uploadStatus.textContent = dict.uploadSizeError;
      uploadStatus.style.color = "#ff4444";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target.result;
      try {
        await chrome.storage.local.set({ customSoundData: dataUrl });
        uploadStatus.textContent = dict.uploadSuccess;
        uploadStatus.style.color = "var(--accent-color)";
        
        chrome.runtime.sendMessage({ action: "playAudio", url: null, volume: appSettings.volume }).catch(() => {});
        setTimeout(() => chrome.runtime.sendMessage({ action: "stopAudio" }).catch(() => {}), 1500);
      } catch (err) {
        uploadStatus.textContent = dict.uploadFail;
        uploadStatus.style.color = "#ff4444";
        console.error(err);
      }
    };
    reader.readAsDataURL(file);
  });

  autoEnableCheckbox.addEventListener('change', () => {
    appSettings.autoEnableAlarm = autoEnableCheckbox.checked;
    saveSettings();
  });

  autoEnableTimerCheckbox.addEventListener('change', () => {
    appSettings.autoEnableTimer = autoEnableTimerCheckbox.checked;
    saveSettings();
  });
});
