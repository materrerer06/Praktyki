const mysql = require('mysql2');
const fs = require('fs');
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

function runScript1() {
    console.log("Uruchamiam import danych...");
    executeDatabaseImport('woj_lodzkie');
    executeDatabaseImport('woj_dolnoslaskie');
}

function runScript2() {
    console.log("Usuwam dane z bazy...");
    deleteDatabaseData('woj_lodzkie');
    deleteDatabaseData('woj_dolnoslaskie');
}

function executeDatabaseImport(folderName) {
    const parseAddress = (str) => {
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
        database: 'company_db'
    });
    
    connection.connect(err => {
        if (err) {
            console.error('Błąd połączenia z MySQL:', err);
            return;
        }
        console.log(`Połączono z MySQL dla tabeli ${folderName}`);
    });
    
    const jsonDir = path.join(__dirname, folderName);
    
    fs.readdir(jsonDir, (err, files) => {
        if (err) {
            console.error('Błąd odczytu katalogu:', err);
            return;
        }
    
        const jsonFiles = files.filter(file => file.endsWith('.json'));
    
        if (jsonFiles.length === 0) {
            console.log(`Brak plików JSON do importu w katalogu ${folderName}.`);
            connection.end();
            return;
        }
    
        console.log(`Znaleziono ${jsonFiles.length} plików JSON w katalogu ${folderName}. Rozpoczynam import...`);
    
        jsonFiles.forEach(file => {
            const filePath = path.join(jsonDir, file);
            
            try {
                const rawData = fs.readFileSync(filePath);
                const jsonData = JSON.parse(rawData);
    
                if (jsonData.items && Array.isArray(jsonData.items)) {
                    jsonData.items.forEach(company => {
                        const addressData = parseAddress(company.address_html);
                        
                        const query = `
                            INSERT INTO ${folderName} 
                            (application_company_id, name, registration_number, nip, nip_eup, kraj, wojewodztwo, powiat, gmina, miejscowosc, ulica, kod_pocztowy)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
                        const values = [
                            company.application_company_id,
                            company.name,
                            company.registration_number,
                            company.nip,
                            company.nip_eup,
                            addressData.kraj || null,
                            addressData.Województwo || null,
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
                                console.log(`Dane firmy ${company.name} zostały dodane do bazy ${folderName}.`);
                            }
                        });
                    });
                } else {
                    console.log(`Brak tablicy "items" w pliku: ${file}`);
                }
            } catch (error) {
                console.error('Błąd przy odczycie lub parsowaniu pliku:', error);
            }
        });
    });
    
    process.on('exit', () => {
        connection.end();
    });
}

function deleteDatabaseData(tableName) {
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
        console.log(`Connected to the database to delete data from ${tableName}.`);

        const sql = `DELETE FROM \`${tableName}\`;`;

        connection.query(sql, (err, result) => {
            if (err) {
                console.error(`Error executing the query for ${tableName}:`, err);
            } else {
                console.log(`Data deleted successfully from ${tableName}:`, result);
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
