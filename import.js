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
                            await processCompanyData(company, connection);
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

async function processCompanyData(company, connection) {
    try {
        // Dodaj opóźnienie 30 sekund między zapytaniami
        await new Promise(resolve => setTimeout(resolve, 30000));

        // Pobierz dane kontaktowe z Gemini
        const contacts = await getCompanyDetails(company.nip);

        if (contacts) {
            // Wstaw dane do tabeli company_contacts
            const contactQuery = `
                INSERT INTO company_contacts 
                (company_nip, phone, email)
                VALUES (?, ?, ?)`;

            await connection.promise().execute(contactQuery, [
                company.nip,
                contacts.phone || null,
                contacts.email || null
            ]);
            
            console.log(`Dane kontaktowe dla firmy ${company.name} zostały zapisane.`);
        }
    } catch (error) {
        console.error(`Błąd przetwarzania firmy ${company.name}:`, error);

        // Zapis błędu do tabeli failed_requests
        const logQuery = `
            INSERT INTO failed_requests 
            (nip, error)
            VALUES (?, ?)`;

        await connection.promise().execute(logQuery, [company.nip, error.message]);
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

        const sqlCompanies = `DELETE FROM companies;`;
        const sqlContacts = `DELETE FROM company_contacts;`;

        connection.query(sqlCompanies, (err, result) => {
            if (err) console.error('Error deleting companies:', err);

            connection.query(sqlContacts, (err, result) => {
                if (err) console.error('Error deleting company contacts:', err);

                connection.end(() => rl.close());
                console.log('Dane zostały usunięte.');
            });
        });
    });
}
