const { OpenAI } = require("openai");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function getCompanyDetails(name) {
  const prompt = `Jesteś ekspertem od weryfikacji danych kontaktowych firm. Podaj **zweryfikowany** numer telefonu i adres e-mail dla firmy o nazwie "${name}". 
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
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    });

    const rawText = completion.choices[0].message.content;

    const match = rawText.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error("Nie znaleziono poprawnego JSON-a");

    const cleanJson = match[0];
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Błąd API OpenAI:", error);
    return null;
  }
}

module.exports = { getCompanyDetails };
