/**
 * router.js
 * ─────────────────────────────────────────────────
 * どちらのHTMLに置いても動作する PC / スマホ 自動振り分けスクリプト。
 *
 * ■ 配置方法
 *   PC版 (0006_OiHbyxI.html) と スマホ版 (0006_OiHbyxI_sp.html) の
 *   両方の <head> 内で最初に読み込む。
 *
 * ■ 動作
 *   - スマホからPC版にアクセス → スマホ版にリダイレクト
 *   - PCからスマホ版にアクセス → PC版にリダイレクト
 *   - ?noredirect=1 を付けると振り分けをスキップ（手動切替用）
 *
 * ■ ファイル名の設定（ここを実際のファイル名に合わせる）
 */

(function () {
  "use strict";

  var PC_PAGE = "0006_OiHbyxI.html";
  var SP_PAGE = "0006_OiHbyxI_sp.html";

  // ?noredirect=1 があればスキップ（手動で「PC版を見る」等に使う）
  if (/[?&]noredirect=1/.test(location.search)) return;

  var ua = navigator.userAgent;

  // iPad(iPadOS13以降)はmaxTouchPoints>1かつwindow幅で判断
  var isMobile =
    /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    (/iPad/.test(ua)) ||
    (navigator.maxTouchPoints > 1 &&
      /Macintosh/.test(ua) &&
      window.innerWidth <= 1024);

  var currentFile = location.pathname.split("/").pop() || "";
  var onSP = currentFile === SP_PAGE;

  if (isMobile && !onSP) {
    location.replace(location.href.replace(currentFile, SP_PAGE));
  } else if (!isMobile && onSP) {
    location.replace(location.href.replace(SP_PAGE, PC_PAGE));
  }
})();
