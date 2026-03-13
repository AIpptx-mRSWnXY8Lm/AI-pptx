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

  showToast("copyToast", "✔︎ プロンプトをコピーしました。AIに貼り付けてください。", 5000);

  if (copyTimer !== null) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    btn.textContent = "コピーする";
    copyTimer = null;
  }, 2000);
}

/* ------------------------------
   トースト通知（緑ボックス）
   id    : 同一 id のトーストは上書きして表示
   msg   : 表示テキスト
   ms    : 表示時間（ミリ秒）
------------------------------ */
function showToast(id, msg, ms = 5000) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    el.style.cssText = [
      "display:none",
      "margin-top:10px",
      "padding:10px 16px",
      "background:#dcfce7",
      "color:#166534",
      "border:1px solid #86efac",
      "border-radius:6px",
      "font-size:14px",
      "line-height:1.5",
    ].join(";");
  }
  el.textContent = msg;
  el.style.display = "block";

  // 挿入先：コピーボタンは .AIbuttons の直後、保存ボタンは #saveArea の直後
  if (id === "copyToast") {
    const anchor = document.querySelector(".AIbuttons");
    if (anchor && !anchor.nextSibling?.id?.includes("Toast")) anchor.after(el);
  } else {
    const anchor = document.getElementById("saveArea");
    if (anchor && !anchor.nextSibling?.id?.includes("Toast")) anchor.after(el);
  }

  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.display = "none"; }, ms);
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

  // 実行（安全ラッパー）
  // ---------------------------------------------------------------

  /* ================================================================
     AUTO_FIXES テーブル
     ルール：
       - pattern : このパターンにマッチするコードにのみ適用を試みる
       - fix(code): コードを受け取り修正済みコードを返す
       - 各 fix は独立して適用される（前の fix の失敗結果を引き継がない）
       - スライドのレイアウト・内容には絶対に触れない
  ================================================================ */
  const AUTO_FIXES = [

    // ──────────────────────────────────────────────────────────────
    // F-1: 全角引用符・全角記号の正規化
    //   SyntaxError: Invalid character が発生するケースの大半は
    //   コピー時に全角の ' ' " " などが混入していることによる。
    //   最初に必ず適用し、後続 fix のベースラインを整える。
    // ──────────────────────────────────────────────────────────────
    {
      label: "全角引用符・記号を半角に正規化",
      // 全角シングル/ダブル引用符、全角コロン、全角波括弧 等
      pattern: /[''""：｛｝（）；]/,
      fix(code) {
        return code
          .replace(/['']/g, "'")
          .replace(/[""]/g, '"')
          .replace(/：/g, ":")
          .replace(/｛/g, "{").replace(/｝/g, "}")
          .replace(/（/g, "(").replace(/）/g, ")")
          .replace(/；/g, ";");
      }
    },

    // ──────────────────────────────────────────────────────────────
    // F-2: ShapeType 変数切り出し + 文字列フォールバックパターンの修正
    //
    //   問題の構造（err2 パターン）:
    //     const ShapeType = pres.ShapeType || pres.shapes || {};
    //     const RECT = ShapeType.RECTANGLE || 'rect';   ← 'rect' が渡されてエラー
    //
    //   原因: new Function 内では pres が SafePptx のインスタンスなので
    //         pres.ShapeType は正しく存在するが、
    //         フォールバック文字列 'rect' 等が addShape に渡るとエラーになる。
    //
    //   対処:
    //     1. `const RECT = ShapeType.RECTANGLE || 'rect'` の文字列フォールバックを除去
    //        → `const RECT = ShapeType.RECTANGLE`
    //     2. `const ShapeType = pres.ShapeType || pres.shapes || {}`
    //        のさらに前に `const pres_ShapeType_ref = ...` を追加するのは不要。
    //        SafePptx が pres.ShapeType を保証しているため。
    //
    //   正規表現の厳密化:
    //     マッチ対象を「const 識別子 = ShapeType.識別子 || '英小文字のみ'」に限定し
    //     `pres.shapes || {}` のような別の || 式に誤ってマッチしないようにする。
    // ──────────────────────────────────────────────────────────────
    {
      label: "ShapeType フォールバック文字列を除去",
      // `ShapeType.XXX || 'xxx'` の形にのみマッチ（pres.shapes || {} は対象外）
      pattern: /const\s+\w+\s*=\s*ShapeType\.\w+\s*\|\|\s*'[a-z_]+'/,
      fix(code) {
        // `const RECT = ShapeType.RECTANGLE || 'rect'`
        //   → `const RECT = ShapeType.RECTANGLE`
        // ShapeType.XXX の直後の `|| 'lowercase'` だけを除去する。
        // `pres.shapes || {}` などには絶対にマッチしない正規表現。
        return code.replace(
          /(const\s+\w+\s*=\s*ShapeType\.\w+)\s*\|\|\s*'[a-z_]+'/g,
          "$1"
        );
      }
    },

    // ──────────────────────────────────────────────────────────────
    // F-3: LINE shape の h:0 / fill → line プロパティ補正
    //   pptxgenjs の LINE は h:0 を受け付けず、
    //   色は fill ではなく line: { color, width } で渡す必要がある。
    // ──────────────────────────────────────────────────────────────
    {
      label: "LINE shape の h:0 / fill → line プロパティ補正",
      pattern: /addShape\s*\(\s*[^,]*LINE[^,]*,/,
      fix(code) {
        return code.replace(
          /(addShape\s*\(\s*[^,]*LINE[^,]*,\s*)\{([^}]*)\}/g,
          (match, prefix, body) => {
            let fixed = body;
            fixed = fixed.replace(/\bh\s*:\s*0\b/, "h: 0.01");
            fixed = fixed.replace(
              /fill\s*:\s*\{\s*color\s*:\s*(['"])([0-9A-Fa-f]{6})\1\s*\}/,
              "line: { color: '$2', width: 1 }"
            );
            return `${prefix}{${fixed}}`;
          }
        );
      }
    },

    // ──────────────────────────────────────────────────────────────
    // F-4: w/h の '%' 文字列をインチ数値に変換
    //   addShape の w/h は数値のみ受け付ける。
    // ──────────────────────────────────────────────────────────────
    {
      label: "w/h の '%' 文字列をインチ数値に変換",
      pattern: /[wh]\s*:\s*['"][0-9]+%['"]/,
      fix(code) {
        return code
          .replace(/\bw\s*:\s*['"]100%['"]/g, "w: 13.33")
          .replace(/\bh\s*:\s*['"]100%['"]/g, "h: 7.5")
          .replace(/\bw\s*:\s*['"]90%['"]/g,  "w: 12")
          .replace(/\bw\s*:\s*['"]80%['"]/g,  "w: 10.67")
          .replace(/\bw\s*:\s*['"]75%['"]/g,  "w: 10")
          .replace(/\bw\s*:\s*['"]66%['"]/g,  "w: 8.8")
          .replace(/\bw\s*:\s*['"]50%['"]/g,  "w: 6.67")
          .replace(/\bw\s*:\s*['"]33%['"]/g,  "w: 4.44")
          .replace(/\bw\s*:\s*['"]25%['"]/g,  "w: 3.33");
      }
    },

  ];

  /* ----------------------------------------------------------------
     実行前にグローバル PptxGenJS の prototype.addSlide をパッチし、
     返される slide オブジェクトの addShape を安全化する。

     【設計方針の変更理由】
       以前の「SafePptx コンストラクタラッパー」方式では、
       pptxgen.bundle.js が内部で `this` を使った初期化を行うため、
       別変数に束縛して `new _RealPptxGenJS()` を呼ぶと
       `this` が正しく渡らず pres が壊れる問題があった。

       新方式：
         1. ユーザーコードには PptxGenJS をそのまま（グローバル）使わせる
         2. new Function の引数には何も渡さない
         3. 実行前に PptxGenJS.prototype.addSlide をパッチして
            返す slide の addShape を安全化する
         4. 実行後にパッチを元に戻す（他への影響を防ぐ）
  ---------------------------------------------------------------- */

  // PptxGenJS のプロトタイプをパッチして addSlide が返す slide を安全化
  function applyPptxPatch() {
    const proto = PptxGenJS.prototype;
    if (proto.__origAddSlide) return; // 二重パッチ防止

    proto.__origAddSlide = proto.addSlide;
    proto.addSlide = function(...args) {
      const slide = proto.__origAddSlide.apply(this, args);
      if (slide && typeof slide.addShape === "function" && !slide.__patched) {
        const _origAddShape = slide.addShape.bind(slide);
        slide.addShape = function(type, opt = {}) {
          if (!type) {
            throw new Error(
              "ShapeType が未指定です\n例: slide.addShape(pres.ShapeType.RECTANGLE,{x:1,y:1,w:1,h:1})"
            );
          }
          opt.x ??= 0;
          opt.y ??= 0;
          opt.w ??= 1;
          opt.h ??= 1;
          return _origAddShape(type, opt);
        };
        slide.__patched = true;
      }
      return slide;
    };
  }

  function removePptxPatch() {
    const proto = PptxGenJS.prototype;
    if (!proto.__origAddSlide) return;
    proto.addSlide = proto.__origAddSlide;
    delete proto.__origAddSlide;
  }

  /* ----------------------------------------------------------------
     コードを実行する
     PptxGenJS はグローバルのままユーザーコードに使わせる。
     new Function の引数は空（ユーザーコードが直接グローバルを参照）。
  ---------------------------------------------------------------- */
  function runCode(code) {
    return new Promise((resolve, reject) => {
      let result;
      applyPptxPatch();
      try {
        const fn = new Function(`"use strict";\n${code}`);
        result = fn();
      } catch (err) {
        removePptxPatch();
        reject(err);
        return;
      }
      if (result && typeof result.then === "function") {
        result.then(v => { removePptxPatch(); resolve(v); })
              .catch(e => { removePptxPatch(); reject(e); });
      } else {
        removePptxPatch();
        resolve(result);
      }
    });
  }

  /* ----------------------------------------------------------------
     自動修正ロジック
     重要な設計原則:
       - 失敗した fix の結果を次の fix に引き継がない
         （壊れたコードが蓄積してさらに壊れるのを防ぐ）
       - 各 fix は必ずオリジナルコードをベースとして適用する
       - 複数の fix が必要な場合は、全 fix を適用した合成コードも試す
  ---------------------------------------------------------------- */
  runBtn.addEventListener("click", async () => {

    errorBox.textContent = "";
    errorBox.style.color = "";
    runBtn.disabled = true;
    runBtn.textContent = "実行中…";

    const originalCode = codeInput.value; // textarea は絶対に変更しない
    let lastErr  = null;
    let fixLog   = [];

    // Step 1: まずオリジナルをそのまま試す
    try {
      await runCode(originalCode);
      runBtn.disabled = false;
      runBtn.textContent = "スライド生成（PPTXダウンロード）";
      return;
    } catch (err) {
      lastErr = err;
    }

    // Step 2: 各 fix を「オリジナルコードに対して」単独で試す
    //   → 失敗しても fixedCode は汚染されない
    let succeededCode = null;
    const appliedLabels = [];

    for (const fix of AUTO_FIXES) {
      if (!fix.pattern.test(originalCode)) continue;

      const candidate = fix.fix(originalCode);
      if (candidate === originalCode) continue;

      try {
        await runCode(candidate);
        succeededCode = candidate;
        appliedLabels.push(fix.label);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        // ここでは candidate を破棄し、originalCode ベースを維持
      }
    }

    // Step 3: 単独 fix で成功しなかった場合、
    //   マッチする全 fix を originalCode に順番に重ね掛けして試す
    if (!succeededCode) {
      let combined = originalCode;
      const combinedLabels = [];

      for (const fix of AUTO_FIXES) {
        if (!fix.pattern.test(combined)) continue;
        const next = fix.fix(combined);
        if (next === combined) continue;
        combined = next;
        combinedLabels.push(fix.label);
      }

      if (combinedLabels.length > 0 && combined !== originalCode) {
        try {
          await runCode(combined);
          succeededCode = combined;
          appliedLabels.push(...combinedLabels);
          lastErr = null;
        } catch (err) {
          lastErr = err;
        }
      }
    }

    runBtn.disabled = false;
    runBtn.textContent = "スライド生成（PPTXダウンロード）";

    if (succeededCode) {
      errorBox.style.color = "#16a34a";
      errorBox.textContent =
        `✅ 自動修正でエラーを解決し、ダウンロードしました。\n適用した修正: ${appliedLabels.join(" + ")}`;
      setTimeout(() => {
        errorBox.textContent = "";
        errorBox.style.color = "";
      }, 6000);
    } else {
      let msg = formatError(lastErr, originalCode);
      if (appliedLabels.length > 0) {
        msg += `\n\n【自動修正を試みましたが解決できませんでした】\n試みた修正: ${appliedLabels.join(" / ")}`;
      }
      errorBox.textContent = msg;
    }

  });

  /* ------------------------------
     エラー整形
  ------------------------------ */
  function formatError(err, code, wrapperLines = 1) {

    let msg = "エラーが発生しました\n\n";
    msg += `種類: ${err.name}\n`;
    msg += `内容: ${err.message}\n`;

    if (err.stack) {
      // ブラウザごとにスタック形式が異なるため複数パターンで試みる
      // Chrome/Edge: "at <anonymous>:行:列"
      // Safari:      "eval code:行:列" / "Function:行:列"
      const m = err.stack.match(/<anonymous>:(\d+):(\d+)/)
             || err.stack.match(/Function(?:Code)?:(\d+):(\d+)/)
             || err.stack.match(/:(\d+):(\d+)/);

      if (m) {
        const rawLine   = Number(m[1]);
        const col       = Number(m[2]);
        // new Function 内では先頭に以下の行が挿入される:
        //   1行目: "use strict";  （引数なしのため関数宣言行はカウントしない）
        // → ユーザーコードの実際の行 = rawLine - 1
        const userLine  = rawLine - 1;
        const codeLines = code.split("\n");
        const totalLines = codeLines.length;

        if (userLine >= 1 && userLine <= totalLines) {
          // 正常範囲：ユーザーコード内の行を特定できた
          const codeLine = codeLines[userLine - 1] ?? "";
          msg += `\n行: ${userLine}`;
          msg += `\n列: ${col}`;
          msg += `\n\n該当コード:\n${codeLine}`;
        } else {
          // 行番号がユーザーコード範囲外 = ラッパー内部 or ライブラリ内部のエラー
          // （「行: 292」のようにコード行数を大幅に超えるケースがこれに該当）
          msg += `\n※ エラー箇所はライブラリ内部またはラッパー内部です（行番号: ${rawLine}）。`;
          msg += `\n  コード自体の構文は正しいが、pptxgenjs への渡し方に問題がある可能性があります。`;
          if (col) msg += `\n列（参考）: ${col}`;
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
    if (saved) {
      addSavedItem(key, data);
      showToast("saveToast", "✔︎ プロンプト・コードを保存しました。以下の欄から復元・削除ができます", 5000);
    }

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
    pre.style.cssText = [
      "font-size:12px",
      "white-space:pre-wrap",
      "word-break:break-all",
      "overflow-wrap:anywhere",
      "margin:8px 0 4px",
      "padding:8px",
      "background:#f8fafc",
      "border:1px solid #e2e8f0",
      "border-radius:4px",
      "max-height:400px",
      "overflow-y:auto",
    ].join(";");
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
