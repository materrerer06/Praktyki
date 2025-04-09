const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function getCompanyDetails(name) {
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-pro-exp-03-25",
        generationConfig: {
            responseMimeType: "application/json" // Wymuś odpowiedź w JSON
        }
    });

    const prompt = `Jesteś ekspertem od weryfikacji danych kontaktowych firm. Podaj **zweryfikowany** numer telefonu i adres e-mail dla firmy o nazwie ${name}. 
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
        const rawText = await response.text();

        // Spróbuj wyciągnąć czysty blok JSON (pierwszy nawias klamrowy do ostatniego)
        const match = rawText.match(/\{[\s\S]*?\}/);
        if (!match) throw new Error("Nie znaleziono poprawnego JSON-a");
        
        const cleanJson = match[0];
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error("Błąd API Gemini:", error);
        console.log("Odpowiedź API:", response?.text()); // Debugowanie
        return null;
    }
}

module.exports = { getCompanyDetails };