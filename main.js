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

  // details を unwrap：summary（折りたたみラベル）は削除し、本文ノードだけ展開
  baseClone.querySelectorAll("details").forEach(details => {
    const frag = document.createDocumentFragment();
    [...details.childNodes].forEach(n => {
      if (n.nodeName.toLowerCase() === "summary") return; // ラベルは捨てる
      frag.appendChild(n.cloneNode(true));
    });
    details.replaceWith(frag);
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

  /* ----------------------------------------------------------------
     既知エラーパターンの自動修正テーブル
     各エントリ: { pattern, fix(code) → 修正済みコード }
     エラーが発生するたびに先頭から順に試行し、修正できたら再実行する。
     スライドのレイアウト・内容には一切触れない。
  ---------------------------------------------------------------- */
  const AUTO_FIXES = [

    // ① LINE shape に h:0 が渡されると内部エラー → h を最小値に補正し
    //   fill ではなく line プロパティに変換する
    {
      label: "LINE shape の h:0 / fill → line プロパティ補正",
      pattern: /ShapeType\.LINE|shapes\.LINE|\bLINE\b/,
      fix(code) {
        // addShape(...LINE..., { ... }) の引数オブジェクト全体を書き換える
        // h:0 → h:0.01、fill:{color:'XXXXXX'} → line:{color:'XXXXXX',width:1}
        return code.replace(
          /(addShape\s*\(\s*(?:[^,]+LINE[^,]*),\s*)\{([^}]*)\}/g,
          (match, prefix, body) => {
            let fixed = body;
            // h: 0 → h: 0.01
            fixed = fixed.replace(/\bh\s*:\s*0\b/, "h: 0.01");
            // fill: { color: 'XXXXXX' } → line: { color: 'XXXXXX', width: 1 }
            fixed = fixed.replace(
              /fill\s*:\s*\{\s*color\s*:\s*(['"])([0-9A-Fa-f]{6})\1\s*\}/,
              "line: { color: '$2', width: 1 }"
            );
            return `${prefix}{${fixed}}`;
          }
        );
      }
    },

    // ② RIGHT_ARROW / LEFT_ARROW など矢印系 ShapeType が存在しない場合
    //   pptxgenjs 3.x の正式 enum 名 "RIGHT_ARROW" は "ARROW_RIGHT" ではなく
    //   実際には存在するが、取得パスが pres.ShapeType でないと undefined になる。
    //   文字列 'rect' や 'line' などのフォールバック文字列をそのまま渡している
    //   場合（err2 パターン）を検出し、pres.ShapeType 経由の呼び出しに差し替える。
    {
      label: "ShapeType 文字列フォールバック → pres.ShapeType 直接参照に変換",
      pattern: /(?:const\s+\w+\s*=\s*ShapeType\.\w+\s*\|\|\s*['"][a-z_]+['"])/,
      fix(code) {
        // const RECT = ShapeType.RECTANGLE || 'rect'  →  const RECT = ShapeType.RECTANGLE
        // const LINE = ShapeType.LINE || 'line'        →  const LINE = ShapeType.LINE
        // など "|| '文字列'" の部分を除去
        return code.replace(
          /(const\s+\w+\s*=\s*ShapeType\.\w+)\s*\|\|\s*['"][^'"]+['"]/g,
          "$1"
        );
      }
    },

    // ③ addShape に数値ではなく '100%' 形式の文字列が w/h に渡されてエラーになる場合
    //   w: '100%' → LAYOUT_WIDE の横幅 13.33 インチに変換
    //   h: '100%' → 7.5 インチに変換
    {
      label: "w/h の '%' 文字列をインチ数値に変換",
      pattern: /[wh]\s*:\s*['"]100%['"]/,
      fix(code) {
        return code
          .replace(/\bw\s*:\s*['"]100%['"]/g, "w: 13.33")
          .replace(/\bh\s*:\s*['"]100%['"]/g, "h: 7.5")
          .replace(/\bw\s*:\s*['"]90%['"]/g, "w: 12")
          .replace(/\bw\s*:\s*['"]80%['"]/g, "w: 10.67")
          .replace(/\bw\s*:\s*['"]50%['"]/g, "w: 6.67");
      }
    },

  ];

  /* ----------------------------------------------------------------
     pptxgenjs の addShape を安全化したコンストラクタラッパーを返す
  ---------------------------------------------------------------- */
  function buildSafePptx() {
    return function SafePptx(...args) {
      const pres = new PptxGenJS(...args);

      // shapes エイリアスを保証
      if (!pres.shapes) {
        pres.shapes = pres.ShapeType || {};
      }

      const _addShape = pres.addShape.bind(pres);
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
        return _addShape(type, opt);
      };

      return pres;
    };
  }

  /* ----------------------------------------------------------------
     コードを実行し、Promise まで含めて結果を返す
     成功なら resolve、失敗なら reject する Promise を返す
  ---------------------------------------------------------------- */
  function runCode(code) {
    return new Promise((resolve, reject) => {
      let result;
      try {
        const fn = new Function("PptxGenJS", `"use strict";\n${code}`);
        result = fn(buildSafePptx());
      } catch (err) {
        reject(err);
        return;
      }
      // writeFile 等の非同期エラーも捕捉
      if (result && typeof result.then === "function") {
        result.then(resolve).catch(reject);
      } else {
        resolve(result);
      }
    });
  }

  /* ----------------------------------------------------------------
     自動修正を順番に試みながら再実行するメインロジック
  ---------------------------------------------------------------- */
  runBtn.addEventListener("click", async () => {

    errorBox.textContent = "";
    runBtn.disabled = true;
    runBtn.textContent = "実行中…";

    let code = codeInput.value;   // textarea の内容は変更しない
    let lastErr = null;
    let fixLog  = [];

    // まずオリジナルコードをそのまま試す
    try {
      await runCode(code);
      runBtn.disabled = false;
      runBtn.textContent = "スライド生成（PPTXダウンロード）";
      return; // 成功
    } catch (err) {
      lastErr = err;
    }

    // 失敗したら AUTO_FIXES を順に適用して再試行
    let fixedCode = code;
    for (const fix of AUTO_FIXES) {
      if (!fix.pattern.test(fixedCode)) continue; // 該当パターンなければスキップ

      const candidate = fix.fix(fixedCode);
      if (candidate === fixedCode) continue;       // 変化なければスキップ

      try {
        await runCode(candidate);
        // 成功
        fixedCode = candidate;
        fixLog.push(fix.label);
        lastErr = null;
        break;
      } catch (err) {
        // この修正では直らなかった → fixedCode は更新せず次へ
        lastErr = err;
        // ただし部分的に改善している可能性があるので fixedCode は更新する
        fixedCode = candidate;
        fixLog.push(fix.label + "（部分適用）");
      }
    }

    runBtn.disabled = false;
    runBtn.textContent = "スライド生成（PPTXダウンロード）";

    if (lastErr) {
      // 自動修正しても直らなかった場合はエラーを表示
      let msg = formatError(lastErr, codeInput.value, WRAPPER_LINES);
      if (fixLog.length > 0) {
        msg += `\n\n【自動修正を試みましたが解決できませんでした】\n適用: ${fixLog.join(" / ")}`;
      }
      errorBox.textContent = msg;
    } else if (fixLog.length > 0) {
      // 自動修正で成功した場合はその旨を表示（コードは変更しない）
      errorBox.style.color = "#16a34a";
      errorBox.textContent =
        `✅ 自動修正でエラーを解決し、ダウンロードしました。\n適用した修正: ${fixLog.join(" / ")}`;
      setTimeout(() => {
        errorBox.textContent = "";
        errorBox.style.color = "";
      }, 6000);
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
      // ブラウザによってスタック形式が異なるため複数パターンで試みる
      // Chrome/Edge: "at <anonymous>:行:列"
      // Safari:      "新しい関数コード@行:列" もしくは "eval code:行:列"
      const m = err.stack.match(/<anonymous>:(\d+):(\d+)/)
             || err.stack.match(/Function(?:Code)?:(\d+):(\d+)/)
             || err.stack.match(/:(\d+):(\d+)/);

      if (m) {
        // new Function の行番号は「function 宣言の 1 行」+「"use strict";\n の 1 行」
        // の計 (wrapperLines + 1) 行分オフセットされている
        const rawLine = Number(m[1]);
        const line    = rawLine - (wrapperLines + 1);
        const col     = m[2];

        // NaN や 0 以下になった場合は行番号を表示しない
        if (Number.isFinite(line) && line > 0) {
          const lines    = code.split("\n");
          const codeLine = lines[line - 1] ?? "";

          msg += `\n行: ${line}`;
          msg += `\n列: ${col}`;
          msg += `\n\n該当コード:\n${codeLine}`;
        } else {
          // 行が特定できない場合は列のみ表示
          msg += `\n列: ${col}`;
          msg += `\n（行番号の特定に失敗しました。ブラウザの開発者ツールでご確認ください）`;
        }
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
