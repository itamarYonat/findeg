/* FinDeg – דף הנחיתה הכללי (index.html): מזהה את הפקולטה מתוך התדפיס
 * שהועלה (faculties/registry.js) ומעביר לדף הפקולטה המתאימה. לא מטפל
 * במסלול/דרישות תואר בעצמו בכלל - זה קורה אך ורק בתוך דף הפקולטה
 * (faculties/<id>/index.html, js/app.js), אחרי ההעברה.
 */
(function () {
  // ראו הערה מקבילה ב-js/app.js - נתיב יציב יחסית ל-js/landing.js עצמו,
  // לא למיקום הדף (גם אם כרגע landing.js תמיד נטען מהשורש, זה נשאר עמיד
  // אם זה ישתנה בעתיד).
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdf.worker.min.js", document.currentScript.src).href;

  const $ = sel => document.querySelector(sel);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // מפתח sessionStorage משותף עם דפי הפקולטה (js/app.js קורא אותו כש-
  // ?autoload=1) - השורות שכבר חולצו מה-PDF כאן, כדי שדף הפקולטה לא יצטרך
  // להריץ את pdf.js פעם שנייה על אותו קובץ (וגם כדי לא להעביר בייטים גולמיים
  // דרך sessionStorage בלי צורך).
  const HANDOFF_KEY = "findeg_landing_lines";

  function showError(msg) {
    const box = $("#parse-error");
    box.textContent = msg;
    box.classList.remove("hidden");
  }

  function goToFaculty(folder, autoload) {
    location.href = folder + "index.html" + (autoload ? "?autoload=1" : "");
  }

  function showManualPicker(note) {
    $("#manual-note").textContent = note;
    const sel = $("#faculty-select");
    sel.innerHTML = "";
    for (const f of window.FINDEG_FACULTY_REGISTRY) {
      const o = el("option", null, esc(f.name));
      o.value = f.folder;
      sel.appendChild(o);
    }
    $("#manual-card").classList.remove("hidden");
    $("#manual-card").scrollIntoView({ behavior: "smooth" });
  }

  $("#manual-go").addEventListener("click", () => goToFaculty($("#faculty-select").value, sessionStorage.getItem(HANDOFF_KEY) != null));

  async function handleFile(file) {
    if (window.FINDEG_TRACK) window.FINDEG_TRACK("upload");
    $("#parse-error").classList.add("hidden");
    $("#dz-text").textContent = "מזהה פקולטה מתוך " + file.name + "…";
    try {
      const buf = await file.arrayBuffer();
      const lines = await FINDEG_PARSER.extractLines(buf);
      const head = lines.slice(0, 8).join(" ");
      const match = window.FINDEG_FACULTY_REGISTRY.find(f => f.detect(head));
      sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(lines));
      if (match) {
        goToFaculty(match.folder, true);
      } else {
        $("#dz-text").textContent = "גרירת קובץ PDF לכאן / לחיצה לבחירה";
        showManualPicker("לא זיהינו אוטומטית את הפקולטה שלכם מהתדפיס - בחרו ידנית מהרשימה (התדפיס שהועלה יטען אוטומטית שם).");
      }
    } catch (err) {
      console.error(err);
      showError("שגיאה בקריאת הקובץ: " + err.message);
      $("#dz-text").textContent = "גרירת קובץ PDF לכאן / לחיצה לבחירה";
    }
  }

  const dz = $("#dropzone"), fi = $("#file-input");
  dz.addEventListener("click", () => fi.click());
  dz.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") fi.click(); });
  ["dragover", "dragenter"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("dragover"); }));
  dz.addEventListener("drop", e => { if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
  fi.addEventListener("change", () => { if (fi.files[0]) handleFile(fi.files[0]); });
})();
