import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// === ENDPOINT DO CHAT COMPATÍVEL COM SUA EXTENSÃO ===
app.post("/mensagem", (req, res) => {
    const texto = req.body.texto?.toLowerCase() || "";

    let resposta = "Ainda estou aprendendo, mas já estou funcionando!";

    if (texto.includes("taxa mínima")) {
        resposta = "A taxa mínima de água em Sinop é R$ 48,59.";
    } 
    else if (texto.includes("parcelamento")) {
        resposta = "Água parcela em até 5x. Esgoto parcela em até 48x.";
    }
    else if (texto.includes("troca de titularidade")) {
        resposta = "Para troca de titularidade, você precisa do contrato, documentos pessoais e estar sem débitos.";
    }

    res.json({ resposta });
});

// === TESTE SIMPLES PARA SABER SE O BACKEND ESTÁ ONLINE ===
app.get("/", (req, res) => {
    res.send("Assistente GSS Backend ✔️ ONLINE");
});

// === LIGA O SERVIDOR ===
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
