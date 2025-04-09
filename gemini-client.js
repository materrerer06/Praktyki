const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function getCompanyDetails(nip) {
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        generationConfig: {
            responseMimeType: "application/json" // Wymuś odpowiedź w JSON
        }
    });

    const prompt = `Jesteś ekspertem od weryfikacji danych kontaktowych firm. Podaj **zweryfikowany** numer telefonu i adres e-mail dla firmy o NIP ${nip}. 
Format odpowiedzi: JSON. Przykład:
{
  "phone": "+48123456789",
  "email": "biuro@firma.pl"
}
Jeśli nie możesz znaleźć zweryfikowanych danych, zwróć:
{
  "phone": null,
  "email": null
}
Nie dodawaj żadnych dodatkowych informacji ani tekstu poza JSON.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const rawText = response.text().replace(/``````/g, '').trim(); // Usuń ewentualne znaczniki
        
        return JSON.parse(rawText);
    } catch (error) {
        console.error("Błąd API Gemini:", error);
        console.log("Odpowiedź API:", response?.text()); // Debugowanie
        return null;
    }
}

module.exports = { getCompanyDetails };
