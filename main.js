let copyTimer = null;

/* ------------------------------
   コピー処理
------------------------------ */
function copyButton() {
  const promptBox = document.getElementById("prompt");
  const min = document.getElementById("min").value || "";
  const max = document.getElementById("max").value || "";
  const demand = document.getElementById("demand").value || "";
  const content = document.getElementById("promput").value || "";

  // --- 修正: details/summary タグを除去してからテキスト化 ---
  const baseClone = promptBox.cloneNode(true);
  baseClone.querySelectorAll("input, textarea").forEach(el => el.remove());

  // details ラッパーを unwrap（中身のノードはそのまま保持）
  baseClone.querySelectorAll("details").forEach(details => {
    const frag = document.createDocumentFragment();
    [...details.childNodes].forEach(n => frag.appendChild(n.cloneNode(true)));
    details.replaceWith(frag);
  });
  // summary タグも unwrap
  baseClone.querySelectorAll("summary").forEach(summary => {
    const frag = document.createDocumentFragment();
    [...summary.childNodes].forEach(n => frag.appendChild(n.cloneNode(true)));
    summary.replaceWith(frag);
  });

  // --- 修正: textContent 一致ではなく id で ikanoran 要素を直接置換 ---
  const ikanoranEl = baseClone.querySelector("#ikanoran");
  if (ikanoranEl) ikanoranEl.replaceWith(document.createTextNode(demand));

  const result = baseClone.textContent
    .trim()
    .replace(
      "- スライドの枚数は枚以上枚以下とする",
      `- スライドの枚数は ${min} 枚以上 ${max} 枚以下とする`
    )
    + "\n"
    + content;

  navigator.clipboard.writeText(result);

  const btn = document.getElementById("copybutton");
  btn.textContent = "コピー完了";

  if (copyTimer !== null) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    btn.textContent = "コピーする";
    copyTimer = null;
  }, 2000);
}

/* ===============================
   初期化
   - DOMContentLoaded はすでに発火済みのため使わない
   - 0001_SwAjHqU.html 側が script.onload 後に
     document.dispatchEvent(new Event("appReady")) を発火する
=============================== */
function init() {

  // 二重実行防止
  if (document._appInitDone) return;
  document._appInitDone = true;

  /* ------------------------------
     DOM 参照（init 内で取得することで null を防ぐ）
  ------------------------------ */
  const runBtn          = document.getElementById("runBtn");
  const codeInput       = document.getElementById("codeInput");
  const errorBox        = document.getElementById("errorBox");
  const slideTitleInput = document.getElementById("slideTitle");
  const saveBtn         = document.getElementById("saveBtn");
  const savedList       = document.getElementById("savedList");
  const minInput        = document.getElementById("min");
  const maxInput        = document.getElementById("max");
  const demandInput     = document.getElementById("demand");
  const promputInput    = document.getElementById("promput");

  /* ------------------------------
     枚数バリデーション
     --- 修正: 負数・小数・min>max を検出してエラー表示 ---
  ------------------------------ */
  function validateSlideCount() {
    const minVal = minInput.value.trim();
    const maxVal = maxInput.value.trim();
    const errors = [];

    const minN = Number(minVal);
    const maxN = Number(maxVal);

    if (minVal !== "" && (!Number.isInteger(minN) || minN < 0)) {
      errors.push("最小枚数は0以上の整数を入力してください");
    }
    if (maxVal !== "" && (!Number.isInteger(maxN) || maxN < 0)) {
      errors.push("最大枚数は0以上の整数を入力してください");
    }
    if (
      minVal !== "" && maxVal !== "" &&
      Number.isInteger(minN) && Number.isInteger(maxN) &&
      minN > maxN
    ) {
      errors.push("最小枚数が最大枚数を超えています");
    }

    let countErrEl = document.getElementById("slideCountError");
    if (!countErrEl) {
      countErrEl = document.createElement("span");
      countErrEl.id = "slideCountError";
      countErrEl.style.cssText = "color:#dc2626;font-size:13px;margin-left:8px;";
      maxInput.after(countErrEl);
    }
    countErrEl.textContent = errors.join("　");
    return errors.length === 0;
  }

  minInput.addEventListener("input", validateSlideCount);
  maxInput.addEventListener("input", validateSlideCount);

  /* ------------------------------
     実行（安全ラッパー）
  ------------------------------ */

  // --- 修正: ラッパー行数を定数化して行番号補正に使う ---
  // `"use strict";\n` の 1 行
  const WRAPPER_LINES = 1;

  runBtn.addEventListener("click", () => {

    errorBox.textContent = "";

    try {

      const SafePptx = new Proxy(PptxGenJS, {
        construct(target, args) {
          const pres = new target(...args);

          if (!pres.shapes) {
            pres.shapes = pres.ShapeType || {};
          }

          const originalAddShape = pres.addShape.bind(pres);
          pres.addShape = function(type, opt = {}) {
            if (!type) {
              throw new Error(
                "ShapeType が未指定です\n例: slide.addShape(pptx.ShapeType.RECTANGLE,{x:1,y:1,w:1,h:1})"
              );
            }
            opt.x ??= 0;
            opt.y ??= 0;
            opt.w ??= 1;
            opt.h ??= 1;
            return originalAddShape(type, opt);
          };

          return pres;
        }
      });

      const wrapper = new Function(
        "PptxGenJS",
        `"use strict";\n${codeInput.value}`
      );

      // --- 修正: writeFile などの非同期エラーを catch するため戻り値を Promise として扱う ---
      const result = wrapper(SafePptx);
      if (result && typeof result.catch === "function") {
        result.catch(err => {
          errorBox.textContent = formatError(err, codeInput.value, WRAPPER_LINES);
        });
      }

    } catch (err) {
      errorBox.textContent = formatError(err, codeInput.value, WRAPPER_LINES);
    }

  });

  /* ------------------------------
     エラー整形
     --- 修正: WRAPPER_LINES を受け取り行番号補正を正確にする ---
  ------------------------------ */
  function formatError(err, code, wrapperLines = 1) {

    let msg = "エラーが発生しました\n\n";
    msg += `種類: ${err.name}\n`;
    msg += `内容: ${err.message}\n`;

    if (err.stack) {
      const m = err.stack.match(/:(\d+):(\d+)/);
      if (m) {
        // new Function 内の行番号から「"use strict";\n」の行と
        // Function 先頭行の計 (wrapperLines + 1) 行を引く
        const line = Number(m[1]) - (wrapperLines + 1);
        const col  = m[2];
        const lines    = code.split("\n");
        const codeLine = lines[line - 1] || "";

        msg += `\n行: ${line}`;
        msg += `\n列: ${col}`;
        msg += `\n\n該当コード:\n${codeLine}`;
      }
    }

    return msg;
  }

  /* ------------------------------
     フォーカス解除
  ------------------------------ */
  document.addEventListener("pointerdown", e => {
    const a = document.activeElement;
    if (
      a &&
      (a.tagName === "INPUT" || a.tagName === "TEXTAREA") &&
      !a.contains(e.target)
    ) a.blur();
  }, true);

  /* ===============================
     ストレージ
  =============================== */
  const PptxStore = {

    prefix: "pptx_store_",

    // --- 修正: 4MB を超えそうな時だけ警告（上限 5MB の手前） ---
    WARN_THRESHOLD_BYTES: 4 * 1024 * 1024,

    makeKey(key) {
      return this.prefix + key;
    },

    _currentUsageBytes() {
      let total = 0;
      for (const k of Object.keys(localStorage)) {
        total += (localStorage.getItem(k) || "").length * 2; // UTF-16 換算
      }
      return total;
    },

    save(key, data) {
      const serialized = JSON.stringify(data);
      const addBytes   = (this.makeKey(key).length + serialized.length) * 2;
      const usage      = this._currentUsageBytes();

      if (usage + addBytes >= this.WARN_THRESHOLD_BYTES) {
        const usageMB = ((usage + addBytes) / 1024 / 1024).toFixed(1);
        const ok = confirm(
          `保存データが約 ${usageMB}MB になります（ブラウザ上限 5MB）。\n` +
          "このまま保存するとデータが破損する可能性があります。\n" +
          "保存しますか？"
        );
        if (!ok) return false;
      }

      try {
        localStorage.setItem(this.makeKey(key), serialized);
        return true;
      } catch (e) {
        alert("保存に失敗しました。localStorageの容量が不足しています。\n古い保存データを削除してください。");
        return false;
      }
    },

    loadAll() {
      const list = [];
      Object.keys(localStorage).forEach(k => {
        if (!k.startsWith(this.prefix)) return;
        try {
          const data = JSON.parse(localStorage.getItem(k));
          const key  = k.replace(this.prefix, "");
          list.push({ key, data });
        } catch {}
      });
      return list.sort((a, b) => b.key - a.key);
    },

    remove(key) {
      localStorage.removeItem(this.makeKey(key));
    },

    clearAll() {
      Object.keys(localStorage)
        .filter(k => k.startsWith(this.prefix))
        .forEach(k => localStorage.removeItem(k));
    }

  };

  /* ===============================
     日付
  =============================== */
  function nowString() {
    const d = new Date();
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")} `
         + `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }

  /* ===============================
     全削除ボタン
  =============================== */
  const clearAllBtn = document.createElement("button");
  clearAllBtn.textContent = "保存項目をすべて削除";
  clearAllBtn.onclick = () => {
    if (!confirm("全削除しますか？")) return;
    PptxStore.clearAll();
    savedList.innerHTML = "";
  };
  savedList.before(clearAllBtn);

  /* ===============================
     保存
  =============================== */
  saveBtn.addEventListener("click", () => {

    const title = slideTitleInput.value.trim();
    if (!title) {
      alert("タイトルを入力してください");
      return;
    }
    if (!validateSlideCount()) {
      alert("枚数の入力に誤りがあります。確認してください。");
      return;
    }

    const key  = Date.now().toString();
    const data = {
      title,
      savedAt: nowString(),
      min:     minInput.value,
      max:     maxInput.value,
      demand:  demandInput.value,
      content: promputInput.value,
      code:    codeInput.value
    };

    const saved = PptxStore.save(key, data);
    if (saved) addSavedItem(key, data);

  });

  /* ===============================
     保存アイテム表示
  =============================== */
  function addSavedItem(key, data) {

    const d = document.createElement("details");
    const s = document.createElement("summary");
    s.textContent = `${data.title}（${data.savedAt}）`;

    const load = document.createElement("button");
    load.textContent = "入力";
    load.onclick = () => { restoreData(data); };

    const del = document.createElement("button");
    del.textContent = "削除";
    del.onclick = () => {
      if (!confirm("削除しますか？")) return;
      PptxStore.remove(key);
      d.remove();
    };

    s.append(load, del);
    d.append(s);

    const pre = document.createElement("pre");
    pre.textContent =
`【保存日時】
${data.savedAt}

【その他条件】
${data.demand}

【スライド内容】
${data.content}

【コード】
${data.code}`;

    d.append(pre);
    savedList.prepend(d);
  }

  /* ===============================
     復元
  =============================== */
  function restoreData(data) {
    slideTitleInput.value = data.title;
    minInput.value        = data.min;
    maxInput.value        = data.max;
    demandInput.value     = data.demand;
    promputInput.value    = data.content;
    codeInput.value       = data.code;
  }

  /* ===============================
     初期復元
     --- 修正: DOMContentLoaded ではなく init() 実行時点で復元 ---
  =============================== */
  const list = PptxStore.loadAll();
  list.forEach(o => { addSavedItem(o.key, o.data); });

} // end init()

/* ===============================
   init のトリガー
   - 通常: 0001_SwAjHqU.html の script.onload → appReady イベントで呼ばれる
   - フォールバック: 直接 <script> 埋め込み時は DOMContentLoaded / 即時実行
=============================== */
document.addEventListener("appReady", init, { once: true });

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  // すでにロード済み（直接埋め込みなど）
  init();
}
