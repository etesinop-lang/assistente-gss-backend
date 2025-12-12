import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ===== ASSISTENTE OPENAI =====
const ASSISTANT_ID = "asst_q7sE4luSibuvNqIo7prih343";

// ===== TABELA DE TARIFAS (R$/m³) =====
const tarifas = {
  residencial: { f1: 5.402, f2: 7.671, f3: 12.857, f4: 16.098 },
  social:      { f1: 2.701, f2: 3.835, f3: 12.857, f4: 16.098 },
  vulneravel:  { f1: 1.999, f2: 2.863, f3: 12.857, f4: 16.098 },
  comercial:   { f1: 11.020, f2: 18.313 },
  publica:     { f1: 16.098, f2: 26.416 },
  industrial:  { f1: 11.020, f2: 18.313 }
};

function arred2(v) {
  return Math.round(v * 100) / 100;
}

function detectarConsumo(texto) {
  const m = texto.match(/(\d+)\s*(m3|m³|cubicos|cúbicos)/);
  return m ? parseInt(m[1]) : null;
}

function detectarCategoria(texto) {
  texto = texto.toLowerCase();
  if (texto.includes("residencial")) return "residencial";
  if (texto.includes("comercial")) return "comercial";
  if (texto.includes("pública") || texto.includes("publica")) return "publica";
  if (texto.includes("industrial")) return "industrial";
  if (texto.includes("social")) return "social";
  if (texto.includes("vulnerável") || texto.includes("vulneravel")) return "vulneravel";
  return null;
}

function calcularAgua(consumo, categoria) {
  const t = tarifas[categoria];
  let total = 0;

  if (["comercial", "publica", "industrial"].includes(categoria)) {
    total = t.f1 * 10;
    if (consumo > 10) total += t.f2 * (consumo - 10);
  } else {
    total += t.f1 * 10;
    if (consumo > 10) total += t.f2 * Math.min(consumo - 10, 10);
    if (consumo > 20) total += t.f3 * Math.min(consumo - 20, 10);
    if (consumo > 30) total += t.f4 * (consumo - 30);
  }

  return arred2(total);
}

// ===== HEALTH CHECK =====
app.get("/", (req, res) => {
  res.send("Assistente GSS IA ✔️ ONLINE");
});

// ===== ENDPOINT PRINCIPAL =====
app.post("/mensagem", async (req, res) => {
  try {
    const texto = (req.body.mensagem || "").toLowerCase().trim();
    if (!texto) return res.json({ resposta: "Repita a pergunta." });

    const consumo = detectarConsumo(texto);
    const categoria = detectarCategoria(texto);

    // 🔹 REGRA 1 — pediu cálculo sem categoria
    if (consumo && !categoria) {
      return res.json({
        resposta: "Informe a categoria: Residencial, Comercial, Pública, Industrial, Social ou Vulnerável."
      });
    }

    // 🔹 REGRA 2 — cálculo de água
    if (consumo && categoria) {
      const valorAgua = calcularAgua(consumo, categoria);
      return res.json({
        resposta: `${consumo} m³ ${categoria}: R$ ${valorAgua.toFixed(2)} (sem esgoto). Deseja incluir esgoto? (80%, 90% ou 100%)`
      });
    }

    // 🔹 REGRA 3 — resposta de esgoto
    if (["80", "90", "100"].includes(texto)) {
      return res.json({
        resposta: "Informe novamente consumo e categoria para aplicar o esgoto."
      });
    }

    // 🔹 REGRA 4 — NÃO É CÁLCULO → PASSA PARA A IA
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

    const mensagens = await client.beta.threads.messages.list(thread.id);
    const respostaIA = mensagens.data[0].content[0].text.value;

    return res.json({ resposta: respostaIA });

  } catch (e) {
    console.error(e);
    return res.json({ resposta: "Erro interno no Assistente GSS." });
  }
});

// ===== START =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Assistente GSS rodando na porta", PORT);
});
