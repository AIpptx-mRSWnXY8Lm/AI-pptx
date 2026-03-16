/**
 * /common/router.js
 * ─────────────────────────────────────────────────
 * PC / スマホ 自動振り分け ＋ 切替バナー挿入を一本化したスクリプト。
 *
 * ■ ディレクトリ構成
 *   /0001_SwAjHqU.html          ← PC版（このスクリプトを読み込む）
 *   /sp/0001_SwAjHqU_sp.html    ← SP版（このスクリプトを読み込む）
 *   /common/router.js           ← このファイル
 *
 * ■ ファイル名の規則
 *   PC版: 任意の名前.html
 *   SP版: (PC版のファイル名から.htmlを除いた部分)_sp.html
 *   例: 0001_SwAjHqU.html  ↔  sp/0001_SwAjHqU_sp.html
 *
 * ■ ?noredirect=1 を付けると自動リダイレクトをスキップ（手動切替用）
 */

(function () {
  "use strict";

  /* ── UA判定 ── */
  var ua = navigator.userAgent;
  var isMobile =
    /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    /iPad/.test(ua) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua) && window.innerWidth <= 1024);

  /* ── 現在のページ判定 ── */
  var path     = location.pathname;                        // 例: /sp/0001_SwAjHqU_sp.html
  var filename = path.split("/").pop();                    // 例: 0001_SwAjHqU_sp.html
  var onSP     = filename.endsWith("_sp.html");

  /* ── 相手ページのURLを生成 ── */
  function makePartnerUrl(addNoRedirect) {
    var origin = location.origin;
    var search = location.search.replace(/[?&]noredirect=1/, "");
    var suffix = addNoRedirect ? (search ? search + "&noredirect=1" : "?noredirect=1") : search;

    if (onSP) {
      // SP → PC: /sp/0001_XXX_sp.html → /0001_XXX.html
      var dir    = path.substring(0, path.lastIndexOf("/sp/") + 1); // リポジトリのルートパス
      var pcFile = filename.replace(/_sp\.html$/, ".html");
      return origin + dir + pcFile + suffix;
    } else {
      // PC → SP: /0001_XXX.html → /sp/0001_XXX_sp.html
      var dir    = path.substring(0, path.lastIndexOf("/") + 1);    // /  または  /subdir/
      var spFile = filename.replace(/\.html$/, "_sp.html");
      return origin + dir + "sp/" + spFile + suffix;
    }
  }

  /* ── 自動リダイレクト ── */
  var noRedirect = /[?&]noredirect=1/.test(location.search);
  if (!noRedirect) {
    if (isMobile && !onSP) {
      location.replace(makePartnerUrl(false));
      return; // リダイレクト後はバナー処理不要
    }
    if (!isMobile && onSP) {
      location.replace(makePartnerUrl(false));
      return;
    }
  }

  /* ── 切替バナーをDOMに挿入 ── */
  function insertBanner() {
    var app = document.getElementById("app");
    if (!app) return;
    if (document.getElementById("switch-banner")) return; // 二重挿入防止

    var partnerUrl = makePartnerUrl(true); // noredirect=1 付き

    var banner = document.createElement("div");
    banner.id = "switch-banner";
    banner.style.cssText = [
      "background:#e0f2fe",
      "border:1px solid #7dd3fc",
      "border-radius:6px",
      "padding:8px 14px",
      "margin-bottom:10px",
      "font-size:13px",
      "font-family:system-ui,sans-serif",
      "display:flex",
      "align-items:center",
      "justify-content:space-between",
      "gap:8px",
      "box-sizing:border-box"
    ].join(";");

    var label = onSP ? "📱 スマホ版を表示中" : "🖥️ PC版を表示中";
    var linkText = onSP ? "PC版で見る →" : "スマホ版で見る →";

    banner.innerHTML =
      "<span>" + label + "</span>" +
      "<a href='" + partnerUrl + "' style='color:#0369a1;white-space:nowrap;font-weight:bold;text-decoration:none;'>" + linkText + "</a>";

    app.insertBefore(banner, app.firstChild);
  }

  // appReady（main.js が発火）を待ってバナーを挿入
  document.addEventListener("appReady", insertBanner, { once: true });
  // フォールバック: DOMContentLoaded でも試みる
  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(insertBanner, 300);
  }, { once: true });

})();
