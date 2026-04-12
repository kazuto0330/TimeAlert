document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab-button');
  const addBtn = document.getElementById('add-btn');
  const cardList = document.getElementById('card-list');
  
  let currentTab = 'timer'; // 初期タブ

  // タブ切り替え処理
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // アクティブクラスの切り替え
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      currentTab = tab.dataset.tab;
      renderCards();
    });
  });

  // ＋ボタン押下処理
  addBtn.addEventListener('click', () => {
    console.log(`新規 ${currentTab} を追加します`);
    // TODO: ここにカード追加のロジック（データ作成、ストレージ保存、再レンダリング）を実装
    
    // モックの視覚的フィードバック
    const emptyMsg = document.querySelector('.empty-message');
    if (emptyMsg) emptyMsg.style.display = 'none';
    
    const card = document.createElement('div');
    card.style.background = 'var(--card-bg)';
    card.style.padding = '16px';
    card.style.borderRadius = 'var(--border-radius)';
    card.style.boxShadow = 'var(--shadow)';
    card.innerHTML = `<h3 style="margin:0 0 8px 0;">${currentTab === 'timer' ? '新規タイマー' : '新規アラーム'}</h3><p style="margin:0;opacity:0.6;">(実装待ち)</p>`;
    
    cardList.insertBefore(card, cardList.firstChild);
  });

  // カードのレンダリング関数 (スタブ)
  function renderCards() {
    console.log(`${currentTab} のリストを再描画します`);
    // TODO: chrome.storage からデータを取得してリストを描画する
    
    // とりあえずリストをクリア
    cardList.innerHTML = '<p class="empty-message">右下の＋ボタンから追加してください</p>';
  }
  
  // 初期レンダリング
  renderCards();
});
