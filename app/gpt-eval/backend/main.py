import json
from pathlib import Path
from typing import Any, Dict, List
import dotenv
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel
dotenv.load_dotenv()
app = FastAPI()
client = OpenAI(api_key=os.getenv("OPEN_AI_API_KEY"))

# -----------------------------------------------------------------------
#   CORS — extension can call API from browser
# -----------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],         # for local-only use, safe enough
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------
#   Load tasks from tehtavat.json
# -----------------------------------------------------------------------
def load_tasks() -> list[dict[str, Any]]:
    task_file = Path(__file__).with_name("tehtavat.json")
    with task_file.open("r", encoding="utf-8") as f:
        raw = json.load(f)

    return [{"id": key, **value} for key, value in raw.items()]


TASKS = load_tasks()


# -----------------------------------------------------------------------
#   Pydantic models
# -----------------------------------------------------------------------
class EvalReq(BaseModel):
    task_id: str
    answer: str


# -----------------------------------------------------------------------
#   Improved prompt builder
# -----------------------------------------------------------------------
def build_prompt(task_id: str, task: Dict[str, Any], answer: str) -> str:
    # Material section (optional)
    materials = ""
    materiaali = task.get("materiaali")
    if materiaali:
        materials = (
            f"\nTehtävän materiaalin mukaan:\n"
            f"Valtio A = {materiaali.get('valtio_A')}\n"
            f"Valtio B = {materiaali.get('valtio_B')}\n"
        )

    # Build structured criteria text
    osa_alueet_text = ""
    for osa in task["osa_alueet"]:
        osa_alueet_text += f"\nOsa-alue: {osa['nimi']} (max {osa['max']} pistettä)\n"
        for k in osa["kriteerit"]:
            osa_alueet_text += f"- {k}\n"

    strictness = task.get("strictness", "neutral")

    # Final prompt
    return f"""
Arvioi oppilaan vastaus alla olevan tehtävän perusteella. 

Tehtävä {task_id}
Ohje: {task['ohje']}
Max pisteet: {task['max_pisteet']}

{materials}

Arviointirakenne:
{osa_alueet_text}

Tiukkuustaso: {strictness}
- strict = pisteitä vain, jos kaikki kriteerit täyttyvät selkeästi
- neutral = normaali koulukohtainen taso
- lenient = pisteitä annetaan enemmän, jos vastaus osoittaa ymmärrystä vaikka ei olisi täydellinen

Tärkeää:
- Älä keksi mitään oppilaan vastauksessa mainitsematonta väitettä.
- Älä lisää uusia faktoja tai tulkintoja, joita oppilas ei ole kirjoittanut.
- Arvioi tehtävä vain oppilaan antaman vastauksen perusteella.
- Perustele jokainen osa-alueen pistemäärä lyhyesti.

Oppilaan vastaus:
\"\"\"{answer}\"\"\"

Palauta TÄSMÄLLINEN JSON ilman lisäkommentteja:
{{
  "kokonaispisteet": int,
  "max_pisteet": {task['max_pisteet']},
  "osa_alueet": {{
    {", ".join([f'"{osa["id"]}": int' for osa in task["osa_alueet"]])}
  }},
  "vahvuudet": "string",
  "kehityskohteet": "string",
  "palauteteksti": "string"
}}
""".strip()


# -----------------------------------------------------------------------
#   GET /tasks — returns task list for dropdown in popup UI
# -----------------------------------------------------------------------
@app.get("/tasks")
async def list_tasks() -> List[Dict[str, str]]:
    return [
        {
            "id": task["id"],
            "nimi": task.get("nimi", task["id"]),
            "ohje": task["ohje"],
        }
        for task in TASKS
    ]



# -----------------------------------------------------------------------
#   POST /evaluate — Grade the answer with GPT
# -----------------------------------------------------------------------
@app.post("/evaluate")
async def evaluate(req: EvalReq):
    task = next((t for t in TASKS if t["id"] == req.task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Tehtävää ei löydy.")

    prompt = build_prompt(req.task_id, task, req.answer)

    resp = client.chat.completions.create(
        model="gpt-4.1-mini",   # you may replace with gpt-4o-mini for cheaper usage
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )

    # Return the parsed JSON response
    return json.loads(resp.choices[0].message.content)
