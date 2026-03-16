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
     行番号付きコードエディタの構築
    ------------------------------ */
    (function setupLineNumbers() {
        const wrapper = document.createElement("div");
        wrapper.id = "codeEditorWrapper";
        wrapper.style.cssText = [
            "display:flex",
            "align-items:stretch",
            "margin-top:12px",
            "border:1px solid #cbd5e1",
            "border-radius:4px",
            "overflow:hidden",
            "background:#fff",
            "font-family:monospace",
            "font-size:14px",
            "line-height:1.5",
        ].join(";");

        const gutter = document.createElement("div");
        gutter.id = "lineGutter";
        gutter.style.cssText = [
            "min-width:42px",
            "padding:12px 6px 12px 0",
            "background:#f1f5f9",
            "border-right:1px solid #cbd5e1",
            "color:#94a3b8",
            "text-align:right",
            "user-select:none",
            "overflow:hidden",
            "flex-shrink:0",
            "box-sizing:border-box",
            "line-height:1.5",
            "font-size:14px",
            "font-family:monospace",
        ].join(";");

        codeInput.style.cssText = [
            "flex:1",
            "height:320px",
            "margin:0",
            "padding:12px 8px",
            "border:none",
            "outline:none",
            "resize:vertical",
            "font-family:monospace",
            "font-size:14px",
            "line-height:1.5",
            "overflow-y:auto",
            "box-sizing:border-box",
            "background:#fff",
        ].join(";");

        codeInput.parentNode.insertBefore(wrapper, codeInput);
        wrapper.appendChild(gutter);
        wrapper.appendChild(codeInput);

        function updateGutter() {
            const lineCount = codeInput.value.split("\n").length;
            const numbers = [];
            for (let i = 1; i <= lineCount; i++) {
                numbers.push('<div style="padding-right:8px;min-height:1.5em;">' + i + '</div>');
            }
            gutter.innerHTML = numbers.join("");
            gutter.style.height = codeInput.offsetHeight + "px";
        }

        codeInput.addEventListener("scroll", () => {
            gutter.scrollTop = codeInput.scrollTop;
        });
        codeInput.addEventListener("input", updateGutter);
        new ResizeObserver(updateGutter).observe(codeInput);
        updateGutter();
    })();

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
     writeFile() → write({outputType:'arraybuffer'}) に差し替え、
     ArrayBuffer を返す。プレビューはこの値から JSZip で描画する。
    ---------------------------------------------------------------- */

    // ユーザーコード中の writeFile 呼び出しを write(arraybuffer) に差し替え
    // ★ 重要: new Function 内では return しないと Promise が捨てられる。
    //   行末の pres.writeFile(...); は必ず return pres.write(...); に変換する。
    function patchWriteFile(code) {
        // pres.writeFile(...) を return pres.write({outputType:'arraybuffer'}) に置換。
        // 対応パターン:
        //   A) pres.writeFile({ fileName: '...' })   オブジェクト引数
        //   B) pres.writeFile("ファイル名.pptx")      文字列引数（NG形式）
        //   C) pres.writeFile()                       引数なし
        const TO = "pres.write({ outputType: 'arraybuffer' })";
        const RET = "$1return " + TO + ";";
        return code
            // 独立行: オブジェクト引数 { ... }
            .replace(/^([ \t]*)pres\.writeFile\s*\(\s*\{[^}]*\}\s*\)\s*;?\s*$/mg, RET)
            // 独立行: 文字列引数 ("...") または ('...')
            .replace(/^([ \t]*)pres\.writeFile\s*\(\s*"[^"]*"\s*\)\s*;?\s*$/mg, RET)
            .replace(/^([ \t]*)pres\.writeFile\s*\(\s*'[^']*'\s*\)\s*;?\s*$/mg, RET)
            // 独立行: 引数なし
            .replace(/^([ \t]*)pres\.writeFile\s*\(\s*\)\s*;?\s*$/mg, RET)
            // 行途中フォールバック: 上記で置換されなかった残りを処理（returnなし）
            .replace(/\bpres\.writeFile\s*\([^)]*\)/g, TO);
    }

    function runCode(code) {
        const patchedCode = patchWriteFile(code);
        return new Promise((resolve, reject) => {
            let result;
            applyPptxPatch();
            try {
                const fn = new Function(`"use strict";\n${patchedCode}`);
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

        // プレビューエリアをリセット
        document.getElementById("previewArea").style.display = "none";
        document.getElementById("pptxViewer").innerHTML = "";

        const originalCode = codeInput.value; // textarea は絶対に変更しない
        let lastErr  = null;
        let fixLog   = [];
        let pptxArrayBuffer = null;

        // Step 1: まずオリジナルをそのまま試す
        try {
            pptxArrayBuffer = await runCode(originalCode);
            runBtn.disabled = false;
            runBtn.textContent = "▶ スライド生成＆プレビュー";
            if (pptxArrayBuffer) await showPptxPreview(pptxArrayBuffer, originalCode);
            return;
        } catch (err) {
            lastErr = err;
        }

        // Step 2: 各 fix を「オリジナルコードに対して」単独で試す
        let succeededCode = null;
        const appliedLabels = [];

        for (const fix of AUTO_FIXES) {
            if (!fix.pattern.test(originalCode)) continue;

            const candidate = fix.fix(originalCode);
            if (candidate === originalCode) continue;

            try {
                pptxArrayBuffer = await runCode(candidate);
                succeededCode = candidate;
                appliedLabels.push(fix.label);
                lastErr = null;
                break;
            } catch (err) {
                lastErr = err;
            }
        }

        // Step 3: 単独 fix で成功しなかった場合、全 fix を重ね掛けして試す
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
                    pptxArrayBuffer = await runCode(combined);
                    succeededCode = combined;
                    appliedLabels.push(...combinedLabels);
                    lastErr = null;
                } catch (err) {
                    lastErr = err;
                }
            }
        }

        runBtn.disabled = false;
        runBtn.textContent = "▶ スライド生成＆プレビュー";

        if (succeededCode) {
            errorBox.style.color = "#16a34a";
            errorBox.textContent =
                `✅ 自動修正でエラーを解決しました。\n適用した修正: ${appliedLabels.join(" + ")}`;
            setTimeout(() => {
                errorBox.textContent = "";
                errorBox.style.color = "";
            }, 6000);
            if (pptxArrayBuffer) await showPptxPreview(pptxArrayBuffer, succeededCode);
        } else {
            let msg = formatError(lastErr, originalCode);
            if (appliedLabels.length > 0) {
                msg += `\n\n【自動修正を試みましたが解決できませんでした】\n試みた修正: ${appliedLabels.join(" / ")}`;
            }
            errorBox.textContent = msg;
        }

    });

    /* ================================================================
     PPTX プレビューエンジン
     ノウハウ: JSZip で ArrayBuffer を解凍 → slide*.xml をパース
               → CSS transform:scale で縮小表示
               前後にダウンロードボタンを設置
    ================================================================ */

    // ファイル名をコードから取得するヘルパー
    function extractFileName(code) {
        const m = code.match(/fileName\s*:\s*['"]([^'"]+\.pptx)['"]/);
        return m ? m[1] : "presentation.pptx";
    }

    // ArrayBuffer → Blob → ダウンロード
    function downloadPptx(arrayBuffer, fileName) {
        const blob = new Blob([arrayBuffer], {
            type: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    // ダウンロードボタン生成
    function makeDownloadBtn(arrayBuffer, fileName) {
        const btn = document.createElement("button");
        btn.textContent = "⬇ PPTXをダウンロード";
        btn.style.cssText = [
            "display:inline-block",
            "margin:8px 0",
            "padding:10px 22px",
            "font-size:16px",
            "background:#2563eb",
            "color:#fff",
            "border:none",
            "border-radius:6px",
            "cursor:pointer",
        ].join(";");
        btn.onmouseenter = () => btn.style.background = "#1d4ed8";
        btn.onmouseleave = () => btn.style.background = "#2563eb";
        btn.onclick = () => downloadPptx(arrayBuffer, fileName);
        return btn;
    }

    // EMU → px 変換（96dpi 換算）
    function emuToPx(val) {
        if (!val) return 0;
        return parseInt(val) / 914400 * 96;
    }

    // OOXML の色ノードから CSS カラーを取得
    function parseOoxmlColor(node) {
        if (!node) return null;
        const srgb = node.querySelector("srgbClr");
        if (srgb) return "#" + srgb.getAttribute("val");
        const prstClr = node.querySelector("prstClr");
        if (prstClr) {
            const map = {
                white:"#ffffff", black:"#000000", red:"#ff0000",
                blue:"#0000ff", green:"#008000", yellow:"#ffff00",
                gray:"#808080", grey:"#808080", orange:"#ffa500",
                cyan:"#00ffff", magenta:"#ff00ff", darkBlue:"#00008b",
                darkGray:"#a9a9a9", lightGray:"#d3d3d3",
            };
            return map[prstClr.getAttribute("val")] || "#888888";
        }
        return null;
    }

    // 1枚のスライド XML を DOM に変換して返す
    function renderSlideXml(xmlStr, containerW, containerH, slideW, slideH) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlStr, "text/xml");
        const scale = Math.min(containerW / slideW, containerH / slideH);

        const wrapper = document.createElement("div");
        wrapper.style.cssText = `
            width:${containerW}px;height:${containerH}px;
            position:relative;overflow:hidden;background:#f8fafc;
        `.trim();

        const inner = document.createElement("div");
        inner.style.cssText = `
            width:${slideW}px;height:${slideH}px;
            position:absolute;
            top:${(containerH - slideH * scale) / 2}px;
            left:${(containerW - slideW * scale) / 2}px;
            transform:scale(${scale});transform-origin:top left;
            overflow:hidden;background:#fff;
        `.trim();

        // 背景色
        const bgSolid = doc.querySelector("bg solidFill");
        if (bgSolid) {
            const c = parseOoxmlColor(bgSolid);
            if (c) inner.style.background = c;
        }
        const bgGrad = doc.querySelector("bg gradFill");
        if (bgGrad) {
            const stops = [...bgGrad.querySelectorAll("gs")].map(gs => {
                const pos = parseInt(gs.getAttribute("pos") || 0) / 1000;
                return `${parseOoxmlColor(gs) || "#fff"} ${pos}%`;
            });
            if (stops.length > 1) inner.style.background = `linear-gradient(135deg,${stops.join(",")})`;
        }

        // 図形ツリー
        const spTree = doc.querySelector("spTree");
        if (spTree) {
            for (const sp of spTree.querySelectorAll("sp,cxnSp")) {
                renderOoxmlShape(sp, inner);
            }
        }

        wrapper.appendChild(inner);
        return wrapper;
    }

    // 1つの図形要素を描画
    function renderOoxmlShape(sp, container) {
        const xfrm = sp.querySelector("xfrm");
        if (!xfrm) return;
        const off = xfrm.querySelector("off");
        const ext = xfrm.querySelector("ext");
        if (!off || !ext) return;

        const x = emuToPx(off.getAttribute("x"));
        const y = emuToPx(off.getAttribute("y"));
        const w = emuToPx(ext.getAttribute("cx"));
        const h = emuToPx(ext.getAttribute("cy"));

        const el = document.createElement("div");
        el.style.cssText = `
            position:absolute;left:${x}px;top:${y}px;
            width:${w}px;height:${h}px;overflow:hidden;box-sizing:border-box;
        `.trim();

        // 図形スタイル
        const spPr = sp.querySelector("spPr");
        if (spPr) {
            // 塗りつぶし
            const solid = spPr.querySelector(":scope > solidFill");
            if (solid) {
                const c = parseOoxmlColor(solid);
                if (c) el.style.background = c;
            }
            const noFill = spPr.querySelector(":scope > noFill");
            if (noFill) el.style.background = "transparent";

            // グラデーション
            const grad = spPr.querySelector(":scope > gradFill");
            if (grad) {
                const stops = [...grad.querySelectorAll("gs")].map(gs => {
                    const pos = parseInt(gs.getAttribute("pos") || 0) / 1000;
                    return `${parseOoxmlColor(gs) || "#fff"} ${pos}%`;
                });
                const ang = grad.querySelector("lin");
                const deg = ang ? (parseInt(ang.getAttribute("ang") || 0) / 60000) : 90;
                if (stops.length > 1) el.style.background = `linear-gradient(${deg}deg,${stops.join(",")})`;
            }

            // ボーダー
            const ln = spPr.querySelector(":scope > ln");
            if (ln) {
                const lnSolid = ln.querySelector("solidFill");
                if (lnSolid) {
                    const lc = parseOoxmlColor(lnSolid);
                    const lw = Math.max(1, emuToPx(ln.getAttribute("w") || "9144"));
                    if (lc) el.style.border = `${lw}px solid ${lc}`;
                }
                if (ln.querySelector("noFill")) el.style.border = "none";
            }

            // 角丸
            const geom = spPr.querySelector("prstGeom");
            if (geom && geom.getAttribute("prst") === "roundRect") el.style.borderRadius = "8px";
            if (geom && geom.getAttribute("prst") === "ellipse") el.style.borderRadius = "50%";
        }

        // テキスト
        const txBody = sp.querySelector("txBody");
        if (txBody) {
            el.style.display = "flex";
            el.style.flexDirection = "column";

            const bodyPr = txBody.querySelector("bodyPr");
            if (bodyPr) {
                const anchor = bodyPr.getAttribute("anchor");
                if (anchor === "ctr") el.style.justifyContent = "center";
                else if (anchor === "b") el.style.justifyContent = "flex-end";

                // 内側マージン
                const tIns = emuToPx(bodyPr.getAttribute("tIns") ?? "45720");
                const bIns = emuToPx(bodyPr.getAttribute("bIns") ?? "45720");
                const lIns = emuToPx(bodyPr.getAttribute("lIns") ?? "91440");
                const rIns = emuToPx(bodyPr.getAttribute("rIns") ?? "91440");
                el.style.padding = `${tIns}px ${rIns}px ${bIns}px ${lIns}px`;
            }

            const textDiv = document.createElement("div");
            for (const para of txBody.querySelectorAll("p")) {
                const pEl = document.createElement("p");
                pEl.style.margin = "0";

                const pPr = para.querySelector("pPr");
                if (pPr) {
                    const algn = pPr.getAttribute("algn");
                    if (algn === "ctr") pEl.style.textAlign = "center";
                    else if (algn === "r") pEl.style.textAlign = "right";
                    else if (algn === "just") pEl.style.textAlign = "justify";
                    const spcBef = pPr.querySelector("spcBef spcPts");
                    if (spcBef) pEl.style.marginTop = (parseInt(spcBef.getAttribute("val") || 0) / 100) + "pt";
                }

                const runs = [...para.querySelectorAll("r,a\\:br,br")];
                if (runs.length === 0) {
                    pEl.innerHTML = "&nbsp;";
                } else {
                    for (const run of runs) {
                        const tag = run.tagName.replace(/^.*:/, "");
                        if (tag === "br") { pEl.appendChild(document.createElement("br")); continue; }
                        const t = run.querySelector("t");
                        if (!t) continue;
                        const span = document.createElement("span");
                        span.textContent = t.textContent;
                        const rPr = run.querySelector("rPr");
                        if (rPr) {
                            const sz = rPr.getAttribute("sz");
                            if (sz) span.style.fontSize = (parseInt(sz) / 100) + "pt";
                            if (rPr.getAttribute("b") === "1") span.style.fontWeight = "bold";
                            if (rPr.getAttribute("i") === "1") span.style.fontStyle = "italic";
                            const u = rPr.getAttribute("u");
                            if (u && u !== "none") span.style.textDecoration = "underline";
                            const rSolid = rPr.querySelector("solidFill");
                            if (rSolid) { const rc = parseOoxmlColor(rSolid); if (rc) span.style.color = rc; }
                            const latin = rPr.querySelector("latin");
                            if (latin) span.style.fontFamily = `"${latin.getAttribute("typeface")}",sans-serif`;
                        }
                        pEl.appendChild(span);
                    }
                }
                textDiv.appendChild(pEl);
            }
            el.appendChild(textDiv);
        }

        container.appendChild(el);
    }

    // メインのプレビュー表示関数
    async function showPptxPreview(arrayBuffer, code) {
        const previewArea      = document.getElementById("previewArea");
        const viewerEl         = document.getElementById("pptxViewer");
        const downloadTopEl    = document.getElementById("previewDownloadTop");
        const downloadBottomEl = document.getElementById("previewDownloadBottom");

        const fileName = extractFileName(code);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // ★ ダウンロードボタンは arrayBuffer がある時点で即座に設置
        //   → プレビュー描画の成否に関係なく確実にダウンロード可能にする
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        downloadTopEl.innerHTML = "";
        downloadBottomEl.innerHTML = "";
        downloadTopEl.appendChild(makeDownloadBtn(arrayBuffer, fileName));
        downloadBottomEl.appendChild(makeDownloadBtn(arrayBuffer, fileName));
        previewArea.style.display = "block";   // ← ボタン設置と同時に表示

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 進捗表示ヘルパー
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        function showProgress(pct, msg) {
            viewerEl.innerHTML = "";
            const wrap = document.createElement("div");
            wrap.style.cssText = [
                "padding:32px 24px;background:#1e293b;border-radius:8px",
                "border:1px solid #334155;font-family:system-ui,sans-serif",
                "display:flex;flex-direction:column;align-items:center;gap:16px",
            ].join(";");

            const label = document.createElement("div");
            label.style.cssText = "color:#94a3b8;font-size:14px;";
            label.textContent = msg;

            const barWrap = document.createElement("div");
            barWrap.style.cssText = "width:360px;max-width:90%;height:8px;background:#334155;border-radius:4px;overflow:hidden;";
            const bar = document.createElement("div");
            bar.style.cssText = `height:100%;border-radius:4px;background:#4f46e5;width:${pct}%;transition:width .3s;`;
            barWrap.appendChild(bar);

            const pctLabel = document.createElement("div");
            pctLabel.style.cssText = "color:#e2e8f0;font-size:22px;font-weight:bold;font-family:monospace;";
            pctLabel.textContent = `${Math.round(pct)}%`;

            wrap.append(label, barWrap, pctLabel);
            viewerEl.appendChild(wrap);
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // JSZip で解凍（進捗: 0→30%）
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        showProgress(5, "PPTXを解析中...");
        await new Promise(r => setTimeout(r, 0)); // 描画を先に反映

        let zip;
        try {
            zip = await JSZip.loadAsync(arrayBuffer);
        } catch (e) {
            viewerEl.innerHTML = `<div style="padding:24px;color:#f87171;font-size:13px;">⚠ プレビュー解析に失敗: ${e.message}<br>ダウンロードボタンからは取得できます。</div>`;
            return;
        }
        showProgress(30, "スライド構造を読み込み中...");
        await new Promise(r => setTimeout(r, 0));

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // スライドサイズ取得（進捗: 35%）
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        let slideW = 12192000 / 914400 * 96; // LAYOUT_WIDE デフォルト
        let slideH =  6858000 / 914400 * 96;
        try {
            const presXml = await zip.file("ppt/presentation.xml").async("text");
            const presDoc = new DOMParser().parseFromString(presXml, "text/xml");
            const sldSz = presDoc.querySelector("sldSz");
            if (sldSz) {
                slideW = emuToPx(sldSz.getAttribute("cx"));
                slideH = emuToPx(sldSz.getAttribute("cy"));
            }
        } catch(e) {}
        showProgress(35, "スライドファイルを検索中...");
        await new Promise(r => setTimeout(r, 0));

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // スライドXMLをソート（★ slide(\d+).xml で正確に番号抽出）
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const slideFiles = Object.keys(zip.files)
            .filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f))
            .sort((a, b) => {
                const na = parseInt(a.match(/slide(\d+)\.xml/)[1]);
                const nb = parseInt(b.match(/slide(\d+)\.xml/)[1]);
                return na - nb;
            });

        if (slideFiles.length === 0) {
            viewerEl.innerHTML = `<div style="padding:24px;color:#fbbf24;font-size:13px;">⚠ スライドが見つかりませんでした。ダウンロードして直接確認してください。</div>`;
            return;
        }
        showProgress(40, `${slideFiles.length}枚のスライドを発見...`);
        await new Promise(r => setTimeout(r, 0));

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 全スライドXMLを先読みしてキャッシュ（進捗: 40→85%）
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const xmlCache = new Array(slideFiles.length).fill(null);
        for (let i = 0; i < slideFiles.length; i++) {
            try {
                xmlCache[i] = await zip.file(slideFiles[i]).async("text");
            } catch(e) {}
            const pct = 40 + ((i + 1) / slideFiles.length) * 45;
            showProgress(pct, `スライドを読み込み中... (${i + 1}/${slideFiles.length})`);
            // 毎回 await で描画機会を与える
            await new Promise(r => setTimeout(r, 0));
        }

        showProgress(90, "プレビューを構築中...");
        await new Promise(r => setTimeout(r, 0));

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // ビューワー UI を構築
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        viewerEl.innerHTML = "";
        viewerEl.style.cssText = [
            "border:1px solid #334155",
            "border-radius:8px",
            "overflow:hidden",
            "background:#1e293b",
            "margin:4px 0",
        ].join(";");

        const THUMB_W = 144, THUMB_H = Math.round(144 * slideH / slideW);
        const MAIN_H  = 420, MAIN_W  = Math.round(420 * slideW / slideH);

        const layout = document.createElement("div");
        layout.style.cssText = `display:flex;height:${MAIN_H + 72}px;`;

        // --- サイドバー ---
    const sidebar = document.createElement("div");
        sidebar.style.cssText = [
            "width:164px;min-width:164px",
            "background:#0f172a",
            "overflow-y:auto",
            "padding:10px 8px",
            "display:flex;flex-direction:column;gap:8px",
            "border-right:1px solid #1e293b",
        ].join(";");
        sidebar.style.scrollbarWidth = "thin";
        sidebar.style.scrollbarColor = "#334155 #0f172a";

        // --- メイン表示 ---
    const mainArea = document.createElement("div");
        mainArea.style.cssText = [
            "flex:1;display:flex;flex-direction:column",
            "align-items:center;justify-content:center",
            "background:#1e293b;gap:10px;padding:16px",
        ].join(";");

        const slideContainer = document.createElement("div");
        slideContainer.style.cssText = [
            `width:${MAIN_W}px;height:${MAIN_H}px`,
            "background:#fff;border-radius:4px",
            "box-shadow:0 8px 32px rgba(0,0,0,0.6)",
            "overflow:hidden;flex-shrink:0",
        ].join(";");

        // ナビゲーション
        const nav = document.createElement("div");
        nav.style.cssText = "display:flex;align-items:center;gap:10px;";

        const makeNavBtn = (label) => {
            const b = document.createElement("button");
            b.textContent = label;
            b.style.cssText = [
                "background:#334155;color:#e2e8f0;border:none",
                "width:34px;height:34px;border-radius:6px",
                "font-size:18px;cursor:pointer;line-height:1",
            ].join(";");
            b.onmouseenter = () => { if (!b.disabled) b.style.background = "#4f46e5"; };
            b.onmouseleave = () => { if (!b.disabled) b.style.background = "#334155"; };
            return b;
        };
        const prevBtn = makeNavBtn("‹");
        const nextBtn = makeNavBtn("›");
        const navInfo = document.createElement("span");
        navInfo.style.cssText = "color:#94a3b8;font-size:13px;min-width:70px;text-align:center;font-family:monospace;";

        nav.append(prevBtn, navInfo, nextBtn);
        mainArea.append(slideContainer, nav);
        layout.append(sidebar, mainArea);
        viewerEl.appendChild(layout);

        let currentIdx = 0;

        function updateNav(idx) {
            navInfo.textContent = `${idx + 1} / ${slideFiles.length}`;
            prevBtn.disabled = idx === 0;
            nextBtn.disabled = idx === slideFiles.length - 1;
            prevBtn.style.opacity  = idx === 0 ? "0.3" : "1";
            nextBtn.style.opacity  = idx === slideFiles.length - 1 ? "0.3" : "1";
            prevBtn.style.background = "#334155";
            nextBtn.style.background = "#334155";
        }

        function showMainSlide(idx) {
            currentIdx = idx;
            const xml = xmlCache[idx];
            if (!xml) return;

            slideContainer.innerHTML = "";
            const rendered = renderSlideXml(xml, MAIN_W, MAIN_H, slideW, slideH);
            rendered.style.width  = "100%";
            rendered.style.height = "100%";
            slideContainer.appendChild(rendered);

            updateNav(idx);

            // サムネイルのアクティブ状態
            sidebar.querySelectorAll(".pv-thumb").forEach((t, i) => {
                t.style.borderColor = i === idx ? "#4f46e5" : "transparent";
                t.style.boxShadow   = i === idx ? "0 0 0 1px #4f46e5" : "none";
            });
            sidebar.querySelectorAll(".pv-thumb")[idx]
                ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }

        prevBtn.onclick = () => { if (currentIdx > 0) showMainSlide(currentIdx - 1); };
        nextBtn.onclick = () => { if (currentIdx < slideFiles.length - 1) showMainSlide(currentIdx + 1); };

        viewerEl.setAttribute("tabindex", "0");
        viewerEl.onkeydown = (e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); nextBtn.click(); }
            if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   { e.preventDefault(); prevBtn.click(); }
        };

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // サムネイル描画（キャッシュ済みXMLから同期的に生成）
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        for (let i = 0; i < slideFiles.length; i++) {
            const thumb = document.createElement("div");
            thumb.className = "pv-thumb";
            thumb.style.cssText = [
                `width:${THUMB_W}px;height:${THUMB_H}px`,
                "border-radius:4px;overflow:hidden",
                "border:2px solid transparent",
                "cursor:pointer;flex-shrink:0",
                "background:#fff;position:relative",
                "transition:border-color .12s, box-shadow .12s",
            ].join(";");

            const numLabel = document.createElement("div");
            numLabel.textContent = i + 1;
            numLabel.style.cssText = [
                "position:absolute;bottom:3px;right:5px",
                "font-size:10px;color:#e2e8f0",
                "background:rgba(15,23,42,.8)",
                "padding:1px 4px;border-radius:3px;z-index:2",
                "font-family:monospace;pointer-events:none",
            ].join(";");

            const idx = i;
            thumb.onclick = () => showMainSlide(idx);
            thumb.onmouseenter = () => { if (idx !== currentIdx) thumb.style.borderColor = "#6366f1"; };
            thumb.onmouseleave = () => { if (idx !== currentIdx) thumb.style.borderColor = "transparent"; };

            if (xmlCache[i]) {
                const rendered = renderSlideXml(xmlCache[i], THUMB_W, THUMB_H, slideW, slideH);
                rendered.style.width  = "100%";
                rendered.style.height = "100%";
                thumb.appendChild(rendered);
            }
            thumb.appendChild(numLabel);
            sidebar.appendChild(thumb);
        }

        showProgress(98, "完了！");
        await new Promise(r => setTimeout(r, 80));

        // 1枚目を表示
        showMainSlide(0);

        // プレビューにスクロール
        previewArea.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    /* ----------------------------------------------------------------
     エラー整形
    ---------------------------------------------------------------- */
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
    // 「保存内容一覧」見出しと余白を savedList の前に挿入
    const savedListSection = document.createElement("div");
    savedListSection.style.cssText = "margin-top:40px;";

    const savedListHeading = document.createElement("h2");
    savedListHeading.textContent = "保存内容一覧";

    const clearAllBtn = document.createElement("button");
    clearAllBtn.textContent = "保存項目をすべて削除";
    clearAllBtn.onclick = () => {
        if (!confirm("全削除しますか？")) return;
        PptxStore.clearAll();
        savedList.innerHTML = "";
    };

    savedListSection.append(savedListHeading, clearAllBtn);
    savedList.before(savedListSection);

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
