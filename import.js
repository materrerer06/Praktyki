const { OpenAI } = require("openai");
const mysql = require('mysql2');
const fs = require('fs').promises; // Używamy promises dla asynchronicznego odczytu plików
const path = require('path');
const readline = require('readline');

// OpenAI API konfiguracja
const OPENAI_API_KEY = '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';  // Wstaw swój klucz API OpenAI

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("Co chcesz zrobić?");
console.log("1 - Importuj dane do bazy");
console.log("2 - Usuń dane z bazy");

rl.question("Wybierz opcję: ", (answer) => {
    if (answer === '1') {
        runScript1();
    } else if (answer === '2') {
        runScript2();
    } else {
        console.log("Nieznana opcja, zakończono działanie.");
        rl.close();
    }
});

async function runScript1() {
    console.log("Uruchamiam import danych...");
    const folders = await fs.readdir(__dirname);
    const wojFolders = await filterWojFolders(folders);
    await executeDatabaseImport(wojFolders);
}

async function filterWojFolders(folders) {
    const wojFolders = [];
    for (const folder of folders) {
        const folderPath = path.join(__dirname, folder);
        try {
            const stats = await fs.lstat(folderPath);
            if (stats.isDirectory() && folder.startsWith('woj')) {
                wojFolders.push(folder);
            }
        } catch (err) {
            console.error(`Błąd odczytu folderu ${folder}:`, err);
        }
    }
    return wojFolders;
}

function runScript2() {
    console.log("Usuwam dane z bazy...");
    deleteDatabaseData();
}

// Funkcja do wyszukiwania telefonu i emaila z ChatGPT
async function fetchContactFromChatGPT(nip) {
    try {
        const prompt = `Find the contact details (phone number and email) for the company with NIP: ${nip}. Provide the complete response with contact details as a JSON object.`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 10,
            temperature: 0.7,
        });

        const contactData = response.choices[0].message.content.trim(); // Cała odpowiedź bota

        return contactData; // Zwracamy całą odpowiedź bota
    } catch (error) {
        console.error('Błąd pobierania danych z ChatGPT:', error);
        return null;
    }
}
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

// Funkcja do importu danych do bazy danych MySQL
async function executeDatabaseImport(folders) {
    const parseAddress = (str) => {
        if (!str) {
            return {};
        }
        const parts = str.split(', ');
        let addressData = {};
        parts.forEach(part => {
            const match = part.match(/<b>(.+?)<\/b>: (.+)/);
            if (match) {
                const key = match[1].toLowerCase().replace(/ /g, '_');
                addressData[key] = match[2];
            }
        });
        return addressData;
    };

    const connection = mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'company_db',
    });

    connection.connect(err => {
        if (err) {
            console.error('Błąd połączenia z MySQL:', err);
            return;
        }
        console.log('Połączono z MySQL');
    });

    for (const folderName of folders) {
        const jsonDir = path.join(__dirname, folderName);
        try {
            const files = await fs.readdir(jsonDir);
            const jsonFiles = files.filter(file => file.endsWith('.json'));
            await processFilesInBatches(jsonFiles, jsonDir, connection, parseAddress);
        } catch (err) {
            console.error('Błąd odczytu katalogu:', err);
        }
    }

    process.on('exit', () => {
        connection.end();
    });
}

// Przetwarzanie plików w partiach
const BATCH_SIZE = 5;

async function processFilesInBatches(files, jsonDir, connection, parseAddress) {
    let index = 0;

    while (index < files.length) {
        const batch = files.slice(index, index + BATCH_SIZE);
        const promises = batch.map(async (file) => {
            const filePath = path.join(jsonDir, file);
            try {
                const rawData = await fs.readFile(filePath, 'utf-8');
                const jsonData = JSON.parse(rawData);

                if (jsonData.items && Array.isArray(jsonData.items)) {
                    for (const company of jsonData.items) {
                        const addressData = parseAddress(company.address_html);
                        const query = `
                            INSERT INTO companies 
                            (application_company_id, name, registration_number, nip, nip_eup, kraj, wojewodztwo, powiat, gmina, miejscowosc, ulica, kod_pocztowy, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;

                        const values = [
                            company.application_company_id,
                            company.name,
                            company.registration_number,
                            company.nip,
                            company.nip_eup,
                            addressData.kraj || null,
                            addressData.wojewodztwo || null,
                            addressData.powiat || null,
                            addressData.gmina || null,
                            addressData.miejscowosc || null,
                            addressData.ulica || null,
                            addressData.kod_pocztowy || null
                        ];

                        connection.query(query, values, async (err, results) => {
                            if (err) {
                                console.error(`Błąd przy wstawianiu danych dla ${company.name}:`, err);
                            } else {
                                console.log(`Dodano firmę: ${company.name}`);
                                
                                if (company.nip) {
                                    try {
                                        const contact = await fetchContactFromChatGPT(company.nip);
                                        const companyId = results.insertId;

                                        if (contact) {
                                            if (contact.phone) {
                                                connection.query(
                                                    'INSERT INTO company_contacts (company_id, telefon, zrodlo_danych, created_at) VALUES (?, ?, ?, NOW())',
                                                    [companyId, contact.phone, 'ChatGPT']
                                                );
                                            }

                                            if (contact.email) {
                                                connection.query(
                                                    'INSERT INTO company_contacts (company_id, email, zrodlo_danych, created_at) VALUES (?, ?, ?, NOW())',
                                                    [companyId, contact.email, 'ChatGPT']
                                                );
                                            }

                                            console.log(`Dodano kontakt z ChatGPT dla ${company.name}`);
                                        }
                                    } catch (e) {
                                        console.error(`Błąd pobierania danych ChatGPT dla ${company.name}:`, e.message);
                                    }
                                }
                            }
                        });
                    }
                } else {
                    console.log(`Brak tablicy "items" w pliku: ${file}`);
                }
            } catch (error) {
                console.error('Błąd przy odczycie lub parsowaniu pliku:', error);
            }
        });

        await Promise.all(promises);
        index += BATCH_SIZE;
    }
}

function deleteDatabaseData() {
    const connection = mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'company_db'
    });

    connection.connect((err) => {
        if (err) {
            console.error('Error connecting to the database:', err);
            return;
        }
        console.log('Connected to the database to delete data.');

        const sql = `DELETE FROM companies;`;

        connection.query(sql, (err, result) => {
            if (err) {
                console.error('Error executing the query:', err);
            } else {
                console.log('Data deleted successfully:', result);
            }

            connection.end((err) => {
                if (err) {
                    console.error('Error closing the connection:', err);
                } else {
                    console.log('Connection closed.');
                }
                rl.close();
                process.exit();
            });
        });
    });
}
