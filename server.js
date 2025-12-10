import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();
const PORT = process.env.PORT || 3000;

// Libera CORS para permitir que a extensão use a API
app.use(cors({
  origin: "*",         // permite requisições de qualquer site
  methods: "GET,POST", // libera POST (necessário para o chat)
}));

app.use(bodyParser.json());

// Endpoint do chat
app.post("/mensagem", async (req, res) => {
  try {
    const { texto } = req.body;

    if (!texto) {
      return res.status(400).json({ erro: "Mensagem vazia." });
    }

    console.log("Usuário disse:", texto);

    // RESPOSTA SIMPLES SÓ PARA TESTAR
    return res.json({
      resposta: `Você escreveu: ${texto}`
    });

  } catch (error) {
    console.error("Erro:", error);
    res.status(500).json({ erro: "Falha interna no servidor." });
  }
});

// Rota básica para ver se está online
app.get("/", (req, res) => {
  res.send("Servidor do Assistente GSS está rodando!");
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Assistente GSS rodando na porta ${PORT}`);
});

