const mysql = require('mysql2');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const { getCompanyDetails } = require('./gemini-client');

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

async function executeDatabaseImport(folders) {
    const connection = mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'company_db',
        connectTimeout: 30000
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

            for (const file of jsonFiles) {
                const filePath = path.join(jsonDir, file);
                try {
                    const rawData = await fs.readFile(filePath, 'utf-8');
                    const jsonData = JSON.parse(rawData);

                    if (jsonData.items && Array.isArray(jsonData.items)) {
                        for (const company of jsonData.items) {
                            await insertCompanyData(company, connection);
                            await insertContactData(company, connection);
                        }
                    } else {
                        console.log(`Brak tablicy "items" w pliku: ${file}`);
                    }
                } catch (error) {
                    console.error('Błąd przy odczycie lub parsowaniu pliku:', error);
                }
            }
        } catch (err) {
            console.error('Błąd odczytu katalogu:', err);
        }
    }

    process.on('exit', () => {
        connection.end();
    });
}

async function insertCompanyData(company, connection) {
    const address = parseAddress(company.address_html);

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
        address.kraj || null,
        address.wojewodztwo || null,
        address.powiat || null,
        address.gmina || null,
        address.miejscowosc || null,
        address.ulica || null,
        address.kod_pocztowy || null
    ];

    try {
        await connection.promise().execute(query, values);
        console.log(`Dodano firmę: ${company.name}`);
    } catch (err) {
        console.error(`Błąd dodawania firmy ${company.name}:`, err.message);
    }
}

async function insertContactData(company, connection) {
    try {
        await new Promise(resolve => setTimeout(resolve, 5000));
        const contacts = await getCompanyDetails(company.name);

        if (contacts) {
            const contactQuery = `
                INSERT INTO company_contacts 
                (company_nip, phone, email)
                VALUES (?, ?, ?)`;

            await connection.promise().execute(contactQuery, [
                company.nip,
                contacts.phone || null,
                contacts.email || null
            ]);
            console.log(`Dane kontaktowe zapisane: ${company.name}`);
        }
    } catch (error) {
        console.error(`Błąd pobierania kontaktów dla ${company.name}:`, error.message);

        const logQuery = `
            INSERT INTO failed_requests 
            (nip, error)
            VALUES (?, ?)`;

        await connection.promise().execute(logQuery, [company.nip, error.message]);
    }
}

function parseAddress(str) {
    if (!str) return {};
    const parts = str.split(', ');
    const data = {};
    parts.forEach(part => {
        const match = part.match(/<b>(.+?)<\/b>: (.+)/);
        if (match) {
            const key = match[1].toLowerCase().replace(/ /g, '_');
            data[key] = match[2];
        }
    });
    return data;
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
            console.error('Błąd połączenia z bazą:', err);
            return;
        }
        console.log('Połączono z bazą danych.');

        const queries = [
            `DELETE FROM companies;`,
            `DELETE FROM company_contacts;`,
            `DELETE FROM failed_requests;`
        ];

        let i = 0;

        function runNextQuery() {
            if (i >= queries.length) {
                connection.end(() => {
                    rl.close();
                    console.log('Wszystkie dane zostały usunięte.');
                });
                return;
            }

            connection.query(queries[i], (err, result) => {
                if (err) {
                    console.error(`Błąd przy zapytaniu: ${queries[i]}`, err);
                } else {
                    console.log(`Usunięto dane z: ${queries[i].match(/FROM (\w+)/)[1]}`);
                }
                i++;
                runNextQuery();
            });
        }

        runNextQuery();
    });
}
