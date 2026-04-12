let audio = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'playAudio') {
    playAudio();
    sendResponse({status: "playing"});
  } else if (msg.action === 'stopAudio') {
    stopAudio();
    sendResponse({status: "stopped"});
  }
});

function playAudio() {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  // デフォルト音源
  const audioUrl = chrome.runtime.getURL("sounds/Clock-Alarm01-1(Low-Loop).mp3");
  audio = new Audio(audioUrl);
  audio.loop = true;
  audio.play().catch(e => console.error("Offscreen audio play error:", e));
}

function stopAudio() {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
}
