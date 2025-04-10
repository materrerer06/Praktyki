var Client = require('./index');

var client = Client.createClient({
    key: "abcde12345abcde12345",
    sandbox: true,
    birVersion: '1.1'
});

// Funkcja, która przyjmuje NIP i zwraca dane kontaktowe
async function getCompanyData(nip) {
    try {
        const gus = await client;
        console.log("USED API KEY: ", gus.key);
        console.log("Sandbox: ", gus.sandbox);
        console.log("login GUS sessionID: ", gus.getSessionId());

        const findCompanyByNip = await gus.findByNip(nip);
        console.log("Firma znaleziona przez NIP: ", findCompanyByNip);

        // Zwracamy dane kontaktowe
        return {
            phone: findCompanyByNip.telephone || null,
            email: findCompanyByNip.email || null
        };
    } catch (error) {
        console.error(`Błąd przy pobieraniu danych z GUS dla NIP: ${nip}`, error);
        throw error;
    }
}

module.exports = { getCompanyData };
