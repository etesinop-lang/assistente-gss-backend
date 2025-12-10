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

// ID DO ASSISTENTE QUE VOCÊ CRIOU
const ASSISTANT_ID = "asst_q7sE4luSibuvNqIo7prih343";

app.get("/", (req, res) => {
  res.send("Assistente GSS IA ✔️ ONLINE");
});

app.post("/mensagem", async (req, res) => {
  try {
    const mensagem = req.body.mensagem || req.body.texto || "";

    if (!mensagem.trim()) {
      return res.json({ resposta: "Pode repetir a pergunta? Não consegui entender." });
    }

    console.log("📩 Usuário perguntou:", mensagem);

    // 🔹 1. Criar thread nova
    const thread = await client.beta.threads.create();

    // 🔹 2. Inserir a mensagem do usuário
    await client.beta.threads.messages.create(thread.id, {
      role: "user",
      content: mensagem
    });

    // 🔹 3. Rodar o assistente IA
    const run = await client.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID
    });

    // 🔹 4. Aguardar a IA terminar
    let status;
    do {
      await new Promise(resolve => setTimeout(resolve, 600));
      status = await client.beta.threads.runs.retrieve(thread.id, run.id);
      console.log("⏳ Status:", status.status);
    } while (status.status !== "completed");

    // 🔹 5. Pegar mensagem final da IA
    const mensagens = await client.beta.threads.messages.list(thread.id);
    const respostaIA = mensagens.data[0].content[0].text.value;

    console.log("📤 Resposta IA:", respostaIA);

    return res.json({ resposta: respostaIA });

  } catch (erro) {
    console.error("❌ ERRO NO SERVIDOR:", erro);
    return res.json({
      resposta: "Erro ao processar sua mensagem no assistente GSS."
    });
  }
});

// 🔹 INICIAR SERVIDOR
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Assistente GSS rodando na porta " + PORT);
});
