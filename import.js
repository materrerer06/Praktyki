const mysql = require('mysql2');
const fs = require('fs').promises; // Używamy promises dla asynchronicznego odczytu plików
const path = require('path');
const readline = require('readline');

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
    // Filtrujemy foldery, których nazwa zaczyna się od "woj"
    const folders = await fs.readdir(__dirname);
    const wojFolders = await filterWojFolders(folders);
    await executeDatabaseImport(wojFolders); // Przechodzi przez wszystkie foldery zaczynające się od "woj"
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
        connectTimeout: 30000  // Zwiększenie czasu oczekiwania do 30 sekund
    });

    connection.connect(err => {
        if (err) {
            console.error('Błąd połączenia z MySQL:', err);
            return;
        }
        console.log('Połączono z MySQL');
    });

    // Przetwarzanie plików w partiach
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
const BATCH_SIZE = 5; // Maksymalna liczba plików do otwarcia na raz

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

                        connection.query(query, values, (err, results) => {
                            if (err) {
                                console.error(`Błąd przy wstawianiu danych dla ${company.name}:`, err);
                            } else {
                                console.log(`Dane firmy ${company.name} zostały dodane do bazy.`);
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
