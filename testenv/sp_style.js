/**
 * sp_style.js
 * ─────────────────────────────────────────────────
 * スマホ版専用スタイル。style.css の上からクラスを追加して上書きする。
 * main.js / style.css / app.html は一切変更しない。
 *
 * ■ 方針
 *   - <style> タグをDOMに注入してCSSを適用
 *   - JS側でUIを再構成する必要があるものは setupSP() で処理
 *   - appReady イベント（main.jsと同じタイミング）を利用
 */

(function () {
  "use strict";

  /* ══════════════════════════════════════════════
     1. スマホ専用 CSS を <head> に注入
  ══════════════════════════════════════════════ */
  var css = `
/* ── sp_style.js が注入するスマホ専用スタイル ── */

/* ベースリセット */
body {
  padding: 10px !important;
  font-size: 16px;
  -webkit-text-size-adjust: 100%;
}

/* 見出し */
h1 { font-size: 1.6em !important; }
h2 { font-size: 1.25em !important; margin-top: 18px; }

/* お知らせ欄 */
.info { padding: 6px; }
.infos { font-size: 1.1em !important; }

/* プロンプトボックス */
.prompt-box {
  width: 100% !important;
  box-sizing: border-box;
  font-size: 12px !important;
}

/* テキストエリア（カスタム条件・スライド内容） */
textarea.promput {
  width: 100% !important;
  box-sizing: border-box;
  font-size: 15px !important;
  min-height: 80px;
}

/* コード入力エリア */
textarea.codeinput {
  width: 100% !important;
  box-sizing: border-box;
  height: 200px !important;
  font-size: 13px !important;
}
#codeEditorWrapper {
  width: 100% !important;
  box-sizing: border-box;
}

/* ボタン全般：タップしやすい大きさに */
button {
  min-height: 48px !important;
  padding: 12px 14px !important;
  font-size: 15px !important;
  touch-action: manipulation;
}

/* AIボタン群：縦並びに変更 */
.AIbuttons {
  flex-wrap: wrap !important;
  gap: 6px !important;
}
.AIbuttons button {
  flex: 1 1 calc(50% - 6px) !important;
  margin: 0 !important;
  min-width: 120px;
  font-size: 14px !important;
}
/* コピーボタンは幅いっぱい */
.AIbuttons button:first-child {
  flex: 1 1 100% !important;
  background: #1e40af;
  color: #fff;
  border: none;
  border-radius: 8px;
}

/* 実行ボタン：幅いっぱい・目立つ色 */
#runBtn {
  width: 100% !important;
  background: #1e40af !important;
  color: #fff !important;
  border: none !important;
  border-radius: 8px !important;
  font-size: 17px !important;
}

/* ダウンロードボタン（previewエリア内） */
#previewDownloadTop button,
#previewDownloadBottom button {
  width: 100% !important;
  box-sizing: border-box;
  border-radius: 8px !important;
}

/* 保存エリア：縦並び */
#saveArea {
  flex-direction: column !important;
  align-items: stretch !important;
  gap: 6px !important;
}
#slideTitle {
  width: 100% !important;
  box-sizing: border-box;
  font-size: 16px !important;
  padding: 10px !important;
}
#saveBtn {
  width: 100% !important;
}

/* プレビューエリア */
#pptxViewer {
  overflow-x: auto;
}
/* プレビュー内のビューワー：横スクロール許容 */
#pptxViewer > div {
  min-width: 0;
}

/* 行番号エディタ：スマホでは行番号を非表示にして幅を節約 */
#lineGutter {
  display: none !important;
}
#codeEditorWrapper textarea.codeinput {
  width: 100% !important;
  border: 1px solid #cbd5e1 !important;
  border-radius: 4px !important;
}

/* エラーボックス */
#errorBox {
  font-size: 13px !important;
  word-break: break-all;
}

/* 保存済みリスト */
#savedList details summary {
  font-size: 15px;
  padding: 8px 4px;
}
#savedList details summary button {
  min-height: 40px !important;
  font-size: 13px !important;
  padding: 8px 10px !important;
}

/* スマホ切替バナー */
#sp-switch-banner {
  background: #e0f2fe;
  border: 1px solid #7dd3fc;
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 10px;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
#sp-switch-banner a {
  color: #0369a1;
  white-space: nowrap;
  font-weight: bold;
  text-decoration: none;
}
`;

  var style = document.createElement("style");
  style.id = "sp-injected-style";
  style.textContent = css;
  document.head.appendChild(style);


  /* ══════════════════════════════════════════════
     2. DOM が揃ってから行うUI調整
  ══════════════════════════════════════════════ */
  function setupSP() {
    // ── 2-1. 「PC版で見る」バナーを最上部に挿入 ──
    var app = document.getElementById("app");
    if (app && !document.getElementById("sp-switch-banner")) {
      // 現在のURLの sp ファイル名を PC ファイル名に置換したリンクを生成
      var pcUrl = location.href
        .replace(/0001_sp\.html/, "0001_SwAjHqU.html")
        .replace(/[?&]noredirect=1/, "");
      // noredirect=1 を付けてPC版でrouter.jsが再リダイレクトしないようにする
      pcUrl += (pcUrl.indexOf("?") >= 0 ? "&" : "?") + "noredirect=1";

      var banner = document.createElement("div");
      banner.id = "sp-switch-banner";
      banner.innerHTML =
        '<span>📱 スマホ版を表示中</span>' +
        '<a href="' + pcUrl + '">PC版で見る →</a>';
      app.insertBefore(banner, app.firstChild);
    }

    // ── 2-2. プレビュービューワーをスマホ向けにリサイズ ──
    // sp_style.js は描画後もプレビューサイズを監視して調整する
    function adjustViewer() {
      var viewer = document.getElementById("pptxViewer");
      if (!viewer) return;
      var layout = viewer.querySelector("div[style*='display:flex']");
      if (!layout) return;

      var vw = window.innerWidth - 20; // padding分引く

      // サイドバー（サムネイル列）をスマホでは非表示に
      var sidebar = layout.firstElementChild;
      if (sidebar) {
        sidebar.style.display = "none";
      }

      // メインスライドコンテナをビューポート幅に合わせる
      var mainArea = layout.lastElementChild;
      if (mainArea) {
        mainArea.style.padding = "8px";
      }

      var slideContainers = viewer.querySelectorAll("[style*='box-shadow']");
      slideContainers.forEach(function (sc) {
        var aspect = 420 / Math.round(420 * 6858000 / 12192000); // W/H 比
        var newW = Math.min(vw - 16, 500);
        var newH = Math.round(newW / aspect);
        sc.style.width  = newW + "px";
        sc.style.height = newH + "px";
      });
    }

    // プレビューが表示されたら調整（MutationObserverで監視）
    var previewArea = document.getElementById("previewArea");
    if (previewArea) {
      var mo = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          if (m.type === "attributes" && m.attributeName === "style") {
            if (previewArea.style.display !== "none") {
              setTimeout(adjustViewer, 100);
            }
          }
          if (m.type === "childList") {
            setTimeout(adjustViewer, 100);
          }
        });
      });
      mo.observe(previewArea, { attributes: true, childList: true, subtree: true });
    }

    window.addEventListener("resize", adjustViewer);
  }

  // appReady（main.js と同じタイミング）または DOMContentLoaded で実行
  document.addEventListener("appReady", setupSP, { once: true });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(setupSP, 200);
    }, { once: true });
  } else {
    setTimeout(setupSP, 200);
  }

})();
