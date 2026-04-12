let audio = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'playAudio') {
    playAudio(msg.url, msg.volume);
    sendResponse({status: "playing"});
  } else if (msg.action === 'stopAudio') {
    stopAudio();
    sendResponse({status: "stopped"});
  }
});

function playAudio(url, volume) {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  
  // 設定された音源またはデフォルト音源
  const audioUrl = url || chrome.runtime.getURL("sounds/Clock-Alarm01-1(Low-Loop).mp3");
  audio = new Audio(audioUrl);
  
  // 設定された音量（デフォルト50%）
  const vol = volume !== undefined ? volume : 50;
  audio.volume = vol / 100;
  audio.loop = true;
  
  audio.play().catch(e => console.error("Offscreen audio play error:", e));
}

function stopAudio() {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
}
