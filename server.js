import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();

// === MIDDLEWARES ===
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// === TESTE DE VIDA ===
app.get("/", (req, res) => {
  res.send("Assistente GSS Backend ✔️ ONLINE");
});

// === ENDPOINT PRINCIPAL DO CHAT ===
app.post("/mensagem", async (req, res) => {
  try {
    const texto =
      req.body.texto ||
      req.body.mensagem ||
      req.body.pergunta ||
      "";

    const pergunta = texto.toLowerCase().trim();

    console.log("📩 Mensagem recebida:", pergunta);

    if (!pergunta) {
      return res.json({
        resposta: "Não consegui entender. Pode repetir a pergunta?"
      });
    }

    let resposta = "Ainda estou aprendendo, mas já consigo ajudar com taxa mínima, titulardade, vazamento e parcelamentos.";

    // === TAXA MÍNIMA ===
    if (pergunta.includes("taxa mínima") || pergunta.includes("taxa minima")) {
      resposta = "A taxa mínima de água em Sinop é de R$ 48,59 (até 10 m³).";
    }

    // === PARCELAMENTO ===
    else if (pergunta.includes("parcelamento") || pergunta.includes("parcela")) {
      resposta =
        "Em geral:\n• Água → até 5x\n• Esgoto → até 48x\nSempre confira no GSS se a matrícula atende aos critérios (valor mínimo, sem acordo ativo etc.).";
    }

    // === TROCA DE TITULARIDADE ===
    else if (
      pergunta.includes("troca de titularidade") ||
      pergunta.includes("troca de nome") ||
      (pergunta.includes("titularidade") && pergunta.includes("troca"))
    ) {
      resposta =
        "Para troca de titularidade, é necessário:\n\n" +
        "• Documento pessoal do novo titular\n" +
        "• Contrato de locação ou compra/venda\n" +
        "• Comprovar vínculo com o imóvel\n\n" +
        "O atendente lança na tela de Consulta/Alteração de Cliente/Imóvel do GSS.";
    }

    // === VAZAMENTO ===
    else if (pergunta.includes("vazamento")) {
      resposta =
        "Para desconto de vazamento:\n• Cliente precisa comprovar o reparo (nota, fotos, laudo)\n" +
        "• Máximo de 2 descontos por ano\n" +
        "• A solicitação é registrada no GSS para análise técnica.";
    }

    // === ESGOTO ===
    else if (pergunta.includes("esgoto")) {
      resposta =
        "A cobrança de esgoto segue a legislação local. Em áreas atendidas pela rede pública, a ligação é obrigatória. Em caso de dúvidas, consulte o Projeto de Adesão.";
    }

    // === CONSUMO EM M³ ===
    else if (
      pergunta.includes("m³") ||
      pergunta.includes("m3") ||
      pergunta.includes("cúbico") ||
      pergunta.includes("cubico")
    ) {
      resposta =
        "Até 10 m³ o cliente paga a taxa mínima. Acima disso, aplica-se tarifa progressiva por faixas. Você pode usar a calculadora interna para valores exatos.";
    }

    // RETORNO FINAL
    console.log("📤 Enviando resposta:", resposta);

    return res.json({ resposta });

  } catch (erro) {
    console.error("❌ ERRO NO /mensagem:", erro);
    return res.status(500).json({
      resposta: "Ocorreu um erro interno ao processar sua mensagem."
    });
  }
});

// === INICIAR SERVIDOR ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Servidor Assistente GSS rodando na porta " + PORT);
});
