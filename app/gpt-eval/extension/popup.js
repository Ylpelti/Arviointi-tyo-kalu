const API_BASE = "http://localhost:8000";

let currentTaskId = "";
let selectEl, textareaEl, resultEl, evaluateBtn, copyBtn;

function setResult(text) {
  if (resultEl) {
    resultEl.textContent = text;
  }
}

function toggleLoading(isLoading) {
  if (!evaluateBtn) return;
  evaluateBtn.disabled = isLoading;
  evaluateBtn.textContent = isLoading ? "Arvioidaan..." : "Arvioi";
}

async function loadTasks() {
  try {
    const res = await fetch(`${API_BASE}/tasks`);
    if (!res.ok) throw new Error("Tehtävien nouto epäonnistui");
    const tasks = await res.json();

    selectEl.innerHTML =
      '<option value="" disabled selected hidden>Valitse...</option>';

    tasks.forEach((task) => {
      const opt = document.createElement("option");
      opt.value = task.id;
      opt.textContent = `${task.id} – ${task.nimi || "Tehtävä"}`;
      selectEl.appendChild(opt);
    });

    chrome.storage.local.get(["selectedTask"], (data) => {
      if (data.selectedTask) {
        selectEl.value = data.selectedTask;
        currentTaskId = data.selectedTask;
      }
    });
  } catch (err) {
    console.error("Task load failed:", err);
    setResult(
      "Tehtävien lataus epäonnistui. Onko backend käynnissä osoitteessa http://localhost:8000 ?"
    );
  }
}

async function handleEvaluate() {
  const answer = (textareaEl.value || "").trim();

  if (!currentTaskId) {
    setResult("Valitse tehtävä ensin.");
    return;
  }
  if (!answer) {
    setResult("Liitä oppilaan vastaus.");
    return;
  }

  toggleLoading(true);
  setResult("Arvioidaan...");

  try {
    const res = await fetch(`${API_BASE}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_id: currentTaskId,
        answer,
      }),
    });

    const rawText = await res.text();
    let data;

    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error("JSON parse error:", rawText);
      throw new Error("Palautettu data ei ollut JSON-muodossa:\n\n" + rawText);
    }

    if (!res.ok) {
      throw new Error(data.detail || data.error || "Arviointi epäonnistui.");
    }

    // Expecting new backend format:
    // {
    //   "kokonaispisteet": int,
    //   "max_pisteet": int,
    //   "osa_alueet": {...},
    //   "vahvuudet": str,
    //   "kehityskohteet": str,
    //   "palauteteksti": str
    // }
    const total = data.kokonaispisteet ?? "-";
    const max = data.max_pisteet ?? "-";
    const osa = data.osa_alueet || {};

    let osaLines = "";
    for (const [key, value] of Object.entries(osa)) {
      osaLines += `  ${key}: ${value}\n`;
    }

    const vahvuudet = data.vahvuudet || "-";
    const kehitys = data.kehityskohteet || "-";
    const palaute = data.palauteteksti || "-";

    const pretty = `
Pisteet: ${total}/${max}

Osa-alueet:
${osaLines || "  (ei osa-alueita)"}

Vahvuudet:
${vahvuudet}

Kehityskohteet:
${kehitys}

Palaute oppilaalle:
${palaute}
`.trim();

    setResult(pretty);
  } catch (err) {
    console.error("Evaluation error:", err);
    setResult(err.message || "Tuntematon virhe arvioinnissa.");
  } finally {
    toggleLoading(false);
  }
}

async function handleCopy() {
  const text = (resultEl.textContent || "").trim();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    const original = copyBtn.textContent;
    copyBtn.textContent = "Kopioitu!";
    setTimeout(() => {
      copyBtn.textContent = original;
    }, 1200);
  } catch (err) {
    console.error("Clipboard error:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  selectEl = document.getElementById("task-select");
  textareaEl = document.getElementById("student-answer");
  resultEl = document.getElementById("result");
  evaluateBtn = document.getElementById("evaluate-btn");
  copyBtn = document.getElementById("copy-btn");

  if (!selectEl || !textareaEl || !resultEl || !evaluateBtn || !copyBtn) {
    console.error("Popup elements missing – tarkista popup.html ID:t");
    return;
  }

  selectEl.addEventListener("change", (e) => {
    currentTaskId = e.target.value;
    chrome.storage.local.set({ selectedTask: currentTaskId });
  });

  evaluateBtn.addEventListener("click", handleEvaluate);
  copyBtn.addEventListener("click", handleCopy);

  loadTasks();
});
