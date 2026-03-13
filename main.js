let copyTimer = null;

/* ------------------------------
   コピー処理
------------------------------ */
function copyButton() {
  const promptBox = document.getElementById("prompt");
  const minVal = document.getElementById("min").value || "";
  const maxVal = document.getElementById("max").value || "";
  const demand = document.getElementById("demand").value || "";
  const content = document.getElementById("promput").value || "";

  // --- 枚数バリデーション ---
  const minNum = minVal === "" ? null : Number(minVal);
  const maxNum = maxVal === "" ? null : Number(maxVal);

  if (minVal !== "" && (!Number.isInteger(minNum) || minNum < 1)) {
    alert("最小枚数は1以上の整数を入力してください。");
    return;
  }
  if (maxVal !== "" && (!Number.isInteger(maxNum) || maxNum < 1)) {
    alert("最大枚数は1以上の整数を入力してください。");
    return;
  }
  if (minNum !== null && maxNum !== null && minNum > maxNum) {
    alert("最小枚数は最大枚数以下にしてください。");
    return;
  }

  // --- プロンプトテキスト組み立て ---
  // <pre> 内の input/textarea 要素はテキスト取得から除外し、
  // 各値を文字列として差し込む
  const baseText = promptBox.cloneNode(true);
  baseText.querySelectorAll("input, textarea").forEach(el => el.remove());

  // ikanoran の span テキストも除去（demand 欄の説明文）
  const ikanoranClone = baseText.querySelector("#ikanoran");
  if (ikanoranClone) ikanoranClone.remove();

  let result = baseText.textContent.trim();

  // 枚数プレースホルダーを置換
  result = result.replace(
    /- スライドの枚数は\s*枚以上\s*枚以下とする/,
    `- スライドの枚数は ${minVal} 枚以上 ${maxVal} 枚以下とする`
  );

  // カスタム条件を追記（空なら何も追加しない）
  if (demand.trim()) {
    result += "\n\n【カスタム条件】\n" + demand.trim();
  }

  // スライド内容を追記
  result += "\n\n## 【スライドの内容】\n" + content;

  navigator.clipboard.writeText(result);

  const btn = document.getElementById("copybutton");
  btn.textContent = "コピー完了";

  if (copyTimer !== null) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    btn.textContent = "コピーする";
    copyTimer = null;
  }, 2000);
}

/* ------------------------------
   DOM 取得（fetch + 動的 script 挿入後に呼ばれる前提）
------------------------------ */
const runBtn    = document.getElementById("runBtn");
const codeInput = document.getElementById("codeInput");
const errorBox  = document.getElementById("errorBox");

/* ------------------------------
   実行（安全ラッパー）
------------------------------ */
runBtn.addEventListener("click", () => {
  errorBox.textContent = "";

  const code = codeInput.value;

  // new Function のラッパー行数：
  //   "use strict";\n  → 1行
  //   空行なし         → オフセット = 1
  const WRAPPER_LINE_OFFSET = 1;

  let result;
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

    const wrapper = new Function("PptxGenJS", `"use strict";\n${code}`);
    result = wrapper(SafePptx);

  } catch (err) {
    errorBox.textContent = formatError(err, code, WRAPPER_LINE_OFFSET);
    return;
  }

  // --- 非同期エラー（writeFile の Promise reject）を捕捉 ---
  if (result && typeof result.then === "function") {
    result.catch(err => {
      errorBox.textContent = "非同期エラー:\n" + (err?.message ?? String(err));
    });
  }
});

/* ------------------------------
   エラー整形（行番号補正付き）
------------------------------ */
function formatError(err, code, wrapperOffset = 1) {
  let msg = "エラーが発生しました\n\n";
  msg += `種類: ${err.name}\n`;
  msg += `内容: ${err.message}\n`;

  if (err.stack) {
    const m = err.stack.match(/:(\d+):(\d+)/);
    if (m) {
      // new Function 内の行番号からラッパー行数を引いてユーザーコードの行番号に変換
      const rawLine = Number(m[1]);
      const col     = m[2];
      const line    = rawLine - wrapperOffset;

      const lines    = code.split("\n");
      const codeLine = lines[line - 1] ?? "";

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

// localStorage の使用量をバイト単位で返す
function localStorageUsedBytes() {
  let total = 0;
  for (const key of Object.keys(localStorage)) {
    total += (key.length + (localStorage.getItem(key)?.length ?? 0)) * 2; // UTF-16
  }
  return total;
}

// 保存前に容量を確認し、超過しそうなら警告（デフォルト閾値 4.5 MB）
function checkStorageCapacity(newDataStr, thresholdBytes = 4.5 * 1024 * 1024) {
  const used    = localStorageUsedBytes();
  const adding  = newDataStr.length * 2;
  const total   = used + adding;

  if (total > thresholdBytes) {
    const usedMB  = (used    / 1024 / 1024).toFixed(2);
    const totalMB = (total   / 1024 / 1024).toFixed(2);
    return confirm(
      `⚠️ localStorage の使用量が上限（約5MB）に近づいています。\n` +
      `現在: ${usedMB} MB　→　保存後の推定: ${totalMB} MB\n\n` +
      `古い保存データを削除してから保存することをお勧めします。\n` +
      `このまま保存しますか？`
    );
  }
  return true;
}

const PptxStore = {
  prefix: "pptx_store_",

  makeKey(key) { return this.prefix + key; },

  save(key, data) {
    const json = JSON.stringify(data);
    if (!checkStorageCapacity(json)) return false;
    try {
      localStorage.setItem(this.makeKey(key), json);
      return true;
    } catch (e) {
      // QuotaExceededError など実際に溢れた場合
      alert("保存に失敗しました。localStorage の空き容量が不足しています。\n古いデータを削除してから再試行してください。");
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

  remove(key) { localStorage.removeItem(this.makeKey(key)); },

  clearAll() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(this.prefix))
      .forEach(k => localStorage.removeItem(k));
  }
};

/* ===============================
   DOM
=============================== */
const slideTitleInput = document.getElementById("slideTitle");
const saveBtn         = document.getElementById("saveBtn");
const savedList       = document.getElementById("savedList");

const minInput    = document.getElementById("min");
const maxInput    = document.getElementById("max");
const demandInput = document.getElementById("demand");
const promputInput= document.getElementById("promput");

/* ===============================
   日付
=============================== */
function nowString() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")} `
       + `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

/* ===============================
   全削除
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
  if (!title) { alert("タイトルを入力してください"); return; }

  const key  = Date.now().toString();
  const data = {
    title,
    savedAt: nowString(),
    min:    minInput.value,
    max:    maxInput.value,
    demand: demandInput.value,
    content:promputInput.value,
    code:   codeInput.value
  };

  if (PptxStore.save(key, data)) {
    addSavedItem(key, data);
  }
});

/* ===============================
   表示
=============================== */
function addSavedItem(key, data) {
  const d = document.createElement("details");
  const s = document.createElement("summary");
  s.textContent = `${data.title}（${data.savedAt}）`;

  const load = document.createElement("button");
  load.textContent = "入力";
  load.onclick = () => restoreData(data);

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
   ※ このファイルは fetch + 動的 <script> で読み込まれるため、
     DOMContentLoaded はすでに発火済み。
     直接呼び出しで初期化する。
=============================== */
(function initSavedList() {
  PptxStore.loadAll().forEach(o => addSavedItem(o.key, o.data));
})();
