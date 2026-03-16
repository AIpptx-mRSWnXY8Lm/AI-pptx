/**
 * /common/sp_style.js
 * ─────────────────────────────────────────────────
 * スマホ版専用スタイル。style.css の上から上書きする。
 * main.js / style.css / app.html は一切変更しない。
 */

(function () {
  "use strict";

  /* ══════════════════════════════════════════════
     1. スマホ専用 CSS を <head> に注入
  ══════════════════════════════════════════════ */
  var css = `
/* ── sp_style.js 注入スタイル ── */

body {
  padding: 10px !important;
  font-size: 16px;
  -webkit-text-size-adjust: 100%;
}

h1 { font-size: 1.6em !important; }
h2 { font-size: 1.25em !important; margin-top: 18px; }

.info { padding: 6px; }
.infos { font-size: 1.1em !important; }

/* プロンプトボックス */
.prompt-box {
  width: 100% !important;
  box-sizing: border-box;
  font-size: 12px !important;
}

/* テキストエリア */
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

/* AIボタン群：2列折り返し */
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
/* コピーボタンは全幅・青 */
.AIbuttons button:first-child {
  flex: 1 1 100% !important;
  background: #1e40af;
  color: #fff;
  border: none;
  border-radius: 8px;
}

/* 実行ボタン：全幅・目立つ青 */
#runBtn {
  width: 100% !important;
  background: #1e40af !important;
  color: #fff !important;
  border: none !important;
  border-radius: 8px !important;
  font-size: 17px !important;
}

/* ダウンロードボタン */
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
#saveBtn { width: 100% !important; }

/* プレビューエリア：横スクロール許容 */
#pptxViewer { overflow-x: auto; }

/* 行番号を非表示（幅節約） */
#lineGutter { display: none !important; }
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
`;

  var style = document.createElement("style");
  style.id = "sp-injected-style";
  style.textContent = css;
  document.head.appendChild(style);


  /* ══════════════════════════════════════════════
     2. プレビュービューワーをスマホ幅に合わせて調整
        （router.js のバナーとは独立して動作）
  ══════════════════════════════════════════════ */
  function adjustViewer() {
    var viewer = document.getElementById("pptxViewer");
    if (!viewer) return;

    // サイドバー（サムネイル列）を非表示
    var layout = viewer.querySelector("div");
    if (layout && layout.style.display === "flex") {
      var sidebar = layout.firstElementChild;
      if (sidebar) sidebar.style.display = "none";
    }

    // メインスライドをビューポート幅に合わせる
    var vw = window.innerWidth - 24;
    var containers = viewer.querySelectorAll("div[style*='box-shadow']");
    containers.forEach(function (sc) {
      var newW = Math.min(vw, 500);
      var ratio = 12192000 / 6858000; // LAYOUT_WIDE の幅/高さ比
      var newH = Math.round(newW / ratio);
      sc.style.width  = newW + "px";
      sc.style.height = newH + "px";
    });
  }

  function setupSP() {
    // previewArea の変化を監視してビューワーを調整
    var previewArea = document.getElementById("previewArea");
    if (previewArea) {
      new MutationObserver(function () {
        if (previewArea.style.display !== "none") {
          setTimeout(adjustViewer, 150);
        }
      }).observe(previewArea, { attributes: true, childList: true, subtree: true });
    }
    window.addEventListener("resize", adjustViewer);
  }

  document.addEventListener("appReady", setupSP, { once: true });
  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(setupSP, 300);
  }, { once: true });

})();
