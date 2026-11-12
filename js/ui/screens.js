/** @typedef {'home'|'role'|'hostSetup'|'hostWaiting'|'guestJoin'|'connecting'|'game'|'disconnected'} ScreenId */

/**
 * @param {HTMLElement} root
 */
export function createScreenHost(root) {
  /** @type {ScreenId} */
  let current = 'home';
  const views = new Map();

  function ensure(id, html) {
    let el = views.get(id);
    if (!el) {
      el = document.createElement('section');
      el.className = `screen screen-${id}`;
      el.hidden = true;
      el.innerHTML = html;
      root.appendChild(el);
      views.set(id, el);
    }
    return el;
  }

  ensure(
    'home',
    `
    <h1>オセロ</h1>
    <p class="lede">友人と1対1。通信はWebRTC（P2P）です。</p>
    <p class="notice">接続時にIPアドレス等が相手に見える場合があります。STUNは第三者サービスを利用します。</p>
    <button type="button" data-action="play" class="btn primary">友達と対戦</button>
  `
  );

  ensure(
    'role',
    `
    <h2>役割を選ぶ</h2>
    <button type="button" data-action="host" class="btn primary">招待を作成（A）</button>
    <button type="button" data-action="guest" class="btn">招待リンクで参加（B）</button>
    <button type="button" data-action="backHome" class="btn link">戻る</button>
  `
  );

  ensure(
    'hostSetup',
    `
    <h2>招待を作成</h2>
    <label class="field">ニックネーム（任意）
      <input type="text" data-field="nick" maxlength="32" autocomplete="nickname" />
    </label>
    <p class="hint">あなたは黒（先手）です。ページを閉じずに待機してください。</p>
    <button type="button" data-action="createInvite" class="btn primary">招待を作成</button>
    <button type="button" data-action="backRole" class="btn link">戻る</button>
  `
  );

  ensure(
    'hostWaiting',
    `
    <h2>友人の参加を待つ</h2>
    <p data-field="status" class="status">準備中…</p>
    <label class="field">招待URL
      <textarea data-field="inviteUrl" readonly rows="3"></textarea>
    </label>
    <button type="button" data-action="copyInvite" class="btn">URLをコピー</button>
    <label class="field">招待コード（URLが使えない場合）
      <textarea data-field="inviteCode" readonly rows="4"></textarea>
    </label>
    <button type="button" data-action="copyCode" class="btn">コードをコピー</button>
    <p data-field="iceWarn" class="warn" hidden></p>
    <label class="field">友人からの返答を貼り付け
      <textarea data-field="answerPaste" rows="5" maxlength="32768" placeholder="返答テキスト"></textarea>
    </label>
    <button type="button" data-action="submitAnswer" class="btn primary">接続する</button>
    <p data-field="error" class="error" hidden></p>
    <button type="button" data-action="cancelHost" class="btn link">キャンセル</button>
  `
  );

  ensure(
    'guestJoin',
    `
    <h2>招待に参加</h2>
    <p class="hint">あなたは白です。リンクを開いた場合は自動で読み込みます。</p>
    <label class="field">招待URLまたはコード
      <textarea data-field="inviteInput" rows="5" maxlength="32768"></textarea>
    </label>
    <button type="button" data-action="loadInvite" class="btn primary">読み込む</button>
    <p data-field="status" class="status" hidden></p>
    <label class="field">友人（A）へ送る返答
      <textarea data-field="answerOut" readonly rows="5"></textarea>
    </label>
    <button type="button" data-action="copyAnswer" class="btn">返答をコピー</button>
    <p data-field="iceWarn" class="warn" hidden></p>
    <p data-field="error" class="error" hidden></p>
    <button type="button" data-action="backRole" class="btn link">戻る</button>
  `
  );

  ensure(
    'connecting',
    `
    <h2>接続中</h2>
    <p data-field="status" class="status">接続を確立しています…</p>
    <p class="hint">うまくいかない場合はVPNをオフにする、別ブラウザを試す、招待を作り直すなどを検討してください。すべての環境で接続できる保証はありません。</p>
  `
  );

  ensure(
    'game',
    `
    <div class="game-header">
      <p data-field="turnInfo"></p>
      <p data-field="score"></p>
      <span data-field="connDot" class="conn-dot" title="接続"></span>
    </div>
    <div data-field="board" class="board-wrap"></div>
    <div class="game-actions">
      <button type="button" data-action="pass" class="btn">パス</button>
    </div>
    <p data-field="gameMessage" class="status"></p>
  `
  );

  ensure(
    'disconnected',
    `
    <h2>切断</h2>
    <p data-field="reason">接続が切断されました。</p>
    <button type="button" data-action="newGame" class="btn primary">新しい対戦</button>
  `
  );

  function show(id) {
    current = id;
    for (const [key, el] of views) {
      el.hidden = key !== id;
    }
  }

  function $(id, selector) {
    const screen = views.get(id);
    return screen?.querySelector(selector) ?? null;
  }

  return { show, $, get current() { return current; }, root: views };
}

export function showError(screen, selector, message) {
  const el = screen.$(screen.current, selector);
  if (el) {
    el.textContent = message;
    el.hidden = !message;
  }
}

export function setStatus(screen, id, message) {
  const el = screen.$(id, '[data-field="status"]');
  if (el) {
    el.textContent = message;
    el.hidden = false;
  }
}
