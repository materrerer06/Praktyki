const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

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
    console.log('Połączono z MySQL');
});

const jsonDir = path.join(__dirname, 'woj_lodzkie');

fs.readdir(jsonDir, (err, files) => {
    if (err) {
        console.error('Błąd odczytu katalogu:', err);
        return;
    }

    const jsonFiles = files.filter(file => file.endsWith('.json'));

    if (jsonFiles.length === 0) {
        console.log('Brak plików JSON do importu.');
        connection.end();
        return;
    }

    console.log(`Znaleziono ${jsonFiles.length} plików JSON. Rozpoczynam import...`);
    let allCompanies = [];

    jsonFiles.forEach(file => {
        const filePath = path.join(jsonDir, file);
        
        try {
            const rawData = fs.readFileSync(filePath);
            const jsonData = JSON.parse(rawData);

            if (jsonData.items && Array.isArray(jsonData.items)) {
                jsonData.items.forEach(company => {
                    const query = `
                        INSERT INTO woj_lodzkie (application_company_id, name, registration_number, nip, nip_eup, address_html)
                        VALUES (?, ?, ?, ?, ?, ?)`;

                    const values = [
                        company.application_company_id,
                        company.name,
                        company.registration_number,
                        company.nip,
                        company.nip_eup,
                        company.address_html
                    ];

                    connection.query(query, values, (err, results) => {
                        if (err) {
                            console.error(`Błąd przy wstawianiu danych dla ${company.name}:`, err);
                        } else {
                            console.log(`Dane firmy ${company.name} zostały dodane do bazy.`);
                        }
                    });
                });
            } else {
                console.log('Brak tablicy "items" w pliku:', file);
            }
        } catch (error) {
            console.error('Błąd przy odczycie lub parsowaniu pliku:', error);
        }
    });
});

process.on('exit', () => {
    connection.end();
});