import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ===== OPENAI =====
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
const ASSISTANT_ID = "asst_q7sE4luSibuvNqIo7prih343";

// ===== CONTEXTO EM MEMÓRIA =====
const contexto = {};

// ===== TARIFAS =====
const tarifas = {
  residencial: { f1: 5.402, f2: 7.671, f3: 12.857, f4: 16.098 },
  social:      { f1: 2.701, f2: 3.835, f3: 12.857, f4: 16.098 },
  vulneravel:  { f1: 1.999, f2: 2.863, f3: 12.857, f4: 16.098 },
  comercial:   { f1: 11.020, f2: 18.313 },
  publica:     { f1: 16.098, f2: 26.416 },
  industrial:  { f1: 11.020, f2: 18.313 }
};

// ===== HELPERS =====
const arred2 = v => Math.round(v * 100) / 100;

const detectarConsumo = t => {
  const m = t.match(/(\d+)\s*(m3|m³|cubicos|cúbicos)/);
  return m ? parseInt(m[1]) : null;
};

const detectarCategoria = t => {
  if (t.includes("residencial")) return "residencial";
  if (t.includes("comercial")) return "comercial";
  if (t.includes("pública") || t.includes("publica")) return "publica";
  if (t.includes("industrial")) return "industrial";
  if (t.includes("social")) return "social";
  if (t.includes("vulnerável") || t.includes("vulneravel")) return "vulneravel";
  return null;
};

const detectarPercentual = t => {
  if (t.includes("80")) return 0.8;
  if (t.includes("90")) return 0.9;
  if (t.includes("100")) return 1;
  return null;
};

function calcularAgua(consumo, categoria) {
  const t = tarifas[categoria];
  let total = t.f1 * 10;

  if (["comercial", "publica", "industrial"].includes(categoria)) {
    if (consumo > 10) total += t.f2 * (consumo - 10);
  } else {
    if (consumo > 10) total += t.f2 * Math.min(consumo - 10, 10);
    if (consumo > 20) total += t.f3 * Math.min(consumo - 20, 10);
    if (consumo > 30) total += t.f4 * (consumo - 30);
  }
  return arred2(total);
}

// ===== STATUS =====
app.get("/", (_, res) => res.send("Assistente GSS IA ✔️ ONLINE"));

// ===== CHAT =====
app.post("/mensagem", async (req, res) => {
  try {
    const texto = (req.body.mensagem || "").toLowerCase().trim();
    if (!texto) return res.json({ resposta: "Repita a pergunta." });

    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    const consumo = detectarConsumo(texto);
    const categoria = detectarCategoria(texto);
    const percentual = detectarPercentual(texto);

    // 🔹 NOVO CONSUMO → RESETA CONTEXTO
    if (consumo && categoria) {
      const valorAgua = calcularAgua(consumo, categoria);
      contexto[ip] = { consumo, categoria, valorAgua };

      return res.json({
        resposta: `${consumo} m³ ${categoria}: R$ ${valorAgua.toFixed(2)} (sem esgoto). Deseja incluir esgoto? (80%, 90% ou 100%)`
      });
    }

    // 🔹 % SEM CONTEXTO
    if ((percentual !== null || texto === "sim") && !contexto[ip]) {
      return res.json({ resposta: "Informe consumo e categoria." });
    }

    // 🔹 AJUSTE DE ESGOTO (SEM RESETAR ÁGUA)
    if (percentual !== null || texto === "sim" || texto.includes("esgoto")) {
      const pct = percentual ?? 0.8;
      const { valorAgua } = contexto[ip];

      const esgoto = arred2(valorAgua * pct);
      const total = arred2(valorAgua + esgoto);

      return res.json({
        resposta:
          `Água: R$ ${valorAgua.toFixed(2)}\n` +
          `Esgoto (${pct * 100}%): R$ ${esgoto.toFixed(2)}\n` +
          `Total: R$ ${total.toFixed(2)}`
      });
    }

    // 🔹 IA (procedimentos)
    const thread = await client.beta.threads.create();
    await client.beta.threads.messages.create(thread.id, {
      role: "user",
      content: texto
    });

    const run = await client.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID
    });

    let status;
    do {
      await new Promise(r => setTimeout(r, 500));
      status = await client.beta.threads.runs.retrieve(thread.id, run.id);
    } while (status.status !== "completed");

    const msgs = await client.beta.threads.messages.list(thread.id);
    return res.json({ resposta: msgs.data[0].content[0].text.value });

  } catch (e) {
    console.error(e);
    return res.json({ resposta: "Erro interno no Assistente GSS." });
  }
});

app.listen(process.env.PORT || 3000, () =>
  console.log("🚀 Assistente GSS rodando")
);
