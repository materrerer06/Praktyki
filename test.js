const mysql = require('mysql2');
const { OpenAI } = require("openai");

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'company_db',
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the database.');
});

// Inicjalizacja OpenAI z kluczem API bez Configuration
const OPENAI_API_KEY = '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';  // Wstaw swój klucz API OpenAI

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });
// Funkcja do pobierania danych kontaktowych z ChatGPT
async function fetchContactFromChatGPT(nip) {
    try {
        const prompt = `Find the contact details (phone number and email) for the company with NIP: ${nip}. Provide the complete response with contact details as a JSON object.`;

        const response = await openai.responses.create({
            model: 'gpt-4o', // Używamy modelu gpt-4
            tools: [{ type: "web_search_preview" }],
            input: prompt,
            max_output_tokens: 100,
        });

        const contactData = response.choices[0].message.content.trim(); // Cała odpowiedź bota

        return contactData; // Zwracamy całą odpowiedź bota
    } catch (error) {
        console.error('Błąd pobierania danych z ChatGPT:', error);
        return null;
    }
}

// Funkcja do zapisywania odpowiedzi bota do bazy danych
async function saveContactToDatabase(companyId, contactData, connection) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO company_contacts (company_id, odpowiedz_bota, zrodlo_danych, created_at)
            VALUES (?, ?, ?, NOW())`;

        connection.query(query, [companyId, contactData, 'ChatGPT'], (err, results) => {
            if (err) {
                console.error('Błąd przy wstawianiu odpowiedzi bota do bazy danych:', err);
                return reject(err);
            } else {
                console.log('Dodano odpowiedź bota do bazy danych');
                return resolve(results);
            }
        });
    });
}

// Funkcja główna, która integruje całość
async function processCompanyContact(nip, companyId) {
    const contactData = await fetchContactFromChatGPT(nip);
    if (contactData) {
        await saveContactToDatabase(companyId, contactData, connection);
    } else {
        console.log("Brak danych kontaktowych dla firmy o NIP:", nip);
    }
}

// Przykład wywołania funkcji z NIP firmy i ID
processCompanyContact('8942853534', 1); // Zastąp "1" właściwym ID firmy w bazie
