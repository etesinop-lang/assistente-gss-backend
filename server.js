import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ===== OPENAI (SÓ PROCEDIMENTOS TEXTUAIS) =====
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
const ASSISTANT_ID = "asst_q7sE4luSibuvNqIo7prih343";

// ===== CONTEXTO POR SESSÃO =====
const contexto = {};

// ===== TARIFAS DE CONSUMO (POR ANO) =====
const tarifasPorAno = {
  2025: {
    residencial: { f1: 5.402, f2: 7.671, f3: 12.857, f4: 16.098 },
    social:      { f1: 2.701, f2: 3.835, f3: 12.857, f4: 16.098 },
    vulneravel:  { f1: 1.999, f2: 2.863, f3: 12.857, f4: 16.098 },
    comercial:   { f1: 11.020, f2: 18.313 },
    publica:     { f1: 16.098, f2: 26.416 },
    industrial:  { f1: 11.020, f2: 18.313 }
  },
  2026: {
    residencial: { f1: 5.510, f2: 7.824, f3: 13.114, f4: 16.420 },
    social:      { f1: 2.755, f2: 3.912, f3: 13.114, f4: 16.420 },
    vulneravel:  { f1: 2.039, f2: 2.920, f3: 13.114, f4: 16.420 },
    comercial:   { f1: 11.240, f2: 18.679 },
    publica:     { f1: 16.420, f2: 26.944 },
    industrial:  { f1: 11.240, f2: 18.679 }
  }
};

// ===== PROCEDIMENTOS (ORDEM DE SERVIÇO) =====
const procedimentos = {
  religacao: {
    valor: 80.17,
    descricao: "Religação a pedido ou por débito"
  },
  deslocamento: {
    terra: 154.53,
    asfalto: 257.55,
    descricao: "Deslocamento acima de 1 metro"
  },
  consumo_final: {
    taxa: 81.03,
    descricao: "Consumo final com possível residual"
  },
  troca_titularidade: {
    valor: 4.92,
    descricao: "Taxa de troca de titularidade"
  },
  ligacao_nova: {
    base: 286.25,
    corte_simples: 387.05,
    corte_duplo: 774.11,
    parcelas: 5,
    descricao: "Ligação nova (parcelável)"
  }
};

// ===== HELPERS =====
const arred2 = v => Math.round(v * 100) / 100;

const detectarConsumo = t => {
  const m = t.match(/(\d+)\s*(m3|m³|metro|metros|cubico|cúbico)/);
  return m ? parseInt(m[1], 10) : null;
};

const detectarCategoria = t => {
  if (t.includes("residencial")) return "residencial";
  if (t.includes("comercial")) return "comercial";
  if (t.includes("publica") || t.includes("pública")) return "publica";
  if (t.includes("industrial")) return "industrial";
  if (t.includes("social")) return "social";
  if (t.includes("vulneravel") || t.includes("vulnerável")) return "vulneravel";
  return null;
};

const detectarAno = t => {
  const m = t.match(/\b(2025|2026)\b/);
  return m ? parseInt(m[1], 10) : null;
};

const detectarPercentual = t => {
  if (/(^|\D)80(\D|$)/.test(t) || t.includes("80%")) return 0.8;
  if (/(^|\D)90(\D|$)/.test(t) || t.includes("90%")) return 0.9;
  if (/(^|\D)100(\D|$)/.test(t) || t.includes("100%")) return 1;
  return null;
};

const detectarProcedimento = t => {
  if (t.includes("religação") || t.includes("religacao")) return "religacao";
  if (t.includes("deslocamento")) return "deslocamento";
  if (t.includes("consumo final")) return "consumo_final";
  if (t.includes("troca")) return "troca_titularidade";
  if (t.includes("ligação nova") || t.includes("ligacao nova")) return "ligacao_nova";
  return null;
};

// ===== CÁLCULO ÁGUA (COM ANO + REGRA SOCIAL/VULNERÁVEL > 20) =====
const calcularAgua = (consumo, categoria, ano) => {
  const tab = tarifasPorAno[ano];
  if (!tab) return null;

  const isSoc = (categoria === "social" || categoria === "vulneravel");

  const calcCat = (cons, cat) => {
    const t = tab[cat];
    let total = t.f1 * 10;

    if (["comercial", "publica", "industrial"].includes(cat)) {
      if (cons > 10) total += t.f2 * (cons - 10);
    } else {
      if (cons > 10) total += t.f2 * Math.min(cons - 10, 10);
      if (cons > 20) total += t.f3 * Math.min(cons - 20, 10);
      if (cons > 30) total += t.f4 * (cons - 30);
    }

    return arred2(total);
  };

  // Até 20 (ou categorias normais): calcula direto
  if (!isSoc || consumo <= 20) return calcCat(consumo, categoria);

  // Acima de 20: 0-20 social/vulnerável + excedente residencial
  const parte020 = calcCat(20, categoria);
  const resTotal = calcCat(consumo, "residencial");
  const resAte20 = calcCat(20, "residencial");

  return arred2(parte020 + (resTotal - resAte20));
};

// ===== STATUS =====
app.get("/", (_, res) =>
  res.send("Assistente GSS IA ✔️ ONLINE")
);

// ===== CHAT =====
app.post("/mensagem", async (req, res) => {
  try {
    const texto = (req.body.mensagem || "").toLowerCase().trim();
    const sessionId = req.body.sessionId;

    if (!sessionId) return res.json({ resposta: "Sessão inválida." });
    if (!texto) return res.json({ resposta: "Repita a pergunta." });
    if (!contexto[sessionId]) contexto[sessionId] = {};

    /* ======================================================
       PROCEDIMENTOS
       ====================================================== */
    const proc = detectarProcedimento(texto);

    if (proc === "religacao") {
      return res.json({
        resposta: `Religação: R$ ${procedimentos.religacao.valor.toFixed(2)}\n(${procedimentos.religacao.descricao})`
      });
    }

    if (proc === "deslocamento") {
      if (texto.includes("terra")) {
        return res.json({
          resposta: `Deslocamento (terra): R$ ${procedimentos.deslocamento.terra.toFixed(2)}`
        });
      }
      if (texto.includes("asfalto")) {
        return res.json({
          resposta: `Deslocamento (asfalto): R$ ${procedimentos.deslocamento.asfalto.toFixed(2)}`
        });
      }
      return res.json({
        resposta:
          `Deslocamento (>1m):\n` +
          `Terra: R$ ${procedimentos.deslocamento.terra.toFixed(2)}\n` +
          `Asfalto: R$ ${procedimentos.deslocamento.asfalto.toFixed(2)}`
      });
    }

    if (proc === "consumo_final") {
      return res.json({
        resposta:
          `Consumo final:\n` +
          `Taxa: R$ ${procedimentos.consumo_final.taxa.toFixed(2)}\n` +
          `*Pode haver cobrança de consumo residual, conforme leitura.`
      });
    }

    if (proc === "troca_titularidade") {
      return res.json({
        resposta: `Troca de titularidade: R$ ${procedimentos.troca_titularidade.valor.toFixed(2)}`
      });
    }

    if (proc === "ligacao_nova") {
      return res.json({
        resposta:
          `Ligação nova:\n` +
          `Valor base: R$ ${procedimentos.ligacao_nova.base.toFixed(2)}\n` +
          `Corte calçada/asfalto: + R$ ${procedimentos.ligacao_nova.corte_simples.toFixed(2)}\n` +
          `Corte duplo: + R$ ${procedimentos.ligacao_nova.corte_duplo.toFixed(2)}\n` +
          `Parcelável em até ${procedimentos.ligacao_nova.parcelas}x na fatura.`
      });
    }

    /* ======================================================
       CONSUMO DE ÁGUA (motor)
       ====================================================== */
    const consumo = detectarConsumo(texto);
    const categoria = detectarCategoria(texto);
    const percentual = detectarPercentual(texto);
    const ano = detectarAno(texto);

    // HARD LOCK: se tem consumo e não informou ano, não calcula
    if (consumo && !ano) {
      return res.json({ resposta: "Informe o ano da tarifa (2025 ou 2026)." });
    }

    if (consumo && categoria && percentual !== null) {
      const agua = calcularAgua(consumo, categoria, ano);
      const esgoto = arred2(agua * percentual);
      const total = arred2(agua + esgoto);

      contexto[sessionId] = { consumo, categoria, ano, valorAgua: agua };

      return res.json({
        resposta:
          `Água: R$ ${agua.toFixed(2)}\n` +
          `Esgoto (${percentual * 100}%): R$ ${esgoto.toFixed(2)}\n` +
          `Total: R$ ${total.toFixed(2)}`
      });
    }

    if (consumo && categoria) {
      const agua = calcularAgua(consumo, categoria, ano);
      contexto[sessionId] = { consumo, categoria, ano, valorAgua: agua };

      return res.json({
        resposta:
          `${consumo} m³ ${categoria}: R$ ${agua.toFixed(2)} (sem esgoto).\n` +
          `Deseja incluir esgoto? (80%, 90% ou 100%)`
      });
    }

    if (percentual !== null && contexto[sessionId]?.valorAgua) {
      const agua = contexto[sessionId].valorAgua;
      const esgoto = arred2(agua * percentual);
      const total = arred2(agua + esgoto);

      return res.json({
        resposta:
          `Água: R$ ${agua.toFixed(2)}\n` +
          `Esgoto (${percentual * 100}%): R$ ${esgoto.toFixed(2)}\n` +
          `Total: R$ ${total.toFixed(2)}`
      });
    }

    /* ======================================================
       IA — APENAS ORIENTAÇÃO
       ====================================================== */
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
      await new Promise(r => setTimeout(r, 400));
      status = await client.beta.threads.runs.retrieve(thread.id, run.id);
    } while (status.status !== "completed");

    const msgs = await client.beta.threads.messages.list(thread.id);

    return res.json({
      resposta: msgs.data[0].content[0].text.value
    });

  } catch (e) {
    console.error(e);
    return res.json({
      resposta: "Erro interno no Assistente GSS."
    });
  }
});

// ===== START =====
app.listen(process.env.PORT || 3000, () =>
  console.log("🚀 Assistente GSS rodando com procedimentos")
);
