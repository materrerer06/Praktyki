var Client = require('./index');

const client = Client.createClient({
    key: "abcde12345abcde12345",
    sandbox: true,
    birVersion: '1.1'
});

const contactFieldMap = {
    'F': { phone: 'fiz_numerTelefonu', email: 'fiz_adresEmail' },
    'P': { phone: 'praw_numerTelefonu', email: 'praw_adresEmail' },
    'LP': { phone: 'lp_adres_telefon', email: 'lp_adres_email' },
    'LF': { phone: 'lp_adres_telefon', email: 'lp_adres_email' },

};

async function getCompanyData(nip) {
    try {
        const gus = await client;

        console.log("USED API KEY: ", gus.key);
        console.log("Sandbox: ", gus.sandbox);
        console.log("login GUS sessionID: ", gus.getSessionId());

        const searchResult = await gus.findByNip(nip);
        console.log("Firma znaleziona przez NIP:", searchResult);

        if (!searchResult || !searchResult.Regon) {
            throw new Error('Nie znaleziono firmy lub brak REGON');
        }

        const regon = searchResult.Regon;
        const typ = searchResult.Typ;
        const silosId = searchResult.SilosID;

        const report = await gus.getFullReport(regon, typ, silosId);
        console.log("Pełny raport:", report);

        const contactKeys = contactFieldMap[typ];

        if (!contactKeys) {
            throw new Error(`Brak zdefiniowanego mapowania kontaktu dla typu firmy: ${typ}`);
        }

        const rawPhone = report[contactKeys.phone];
        const rawEmail = report[contactKeys.email];
        
        const phone = typeof rawPhone === 'string' ? rawPhone : (rawPhone ? String(rawPhone) : null);
        const email = typeof rawEmail === 'string' ? rawEmail : (rawEmail ? String(rawEmail) : null);
        
        return { phone, email };
        

    } catch (error) {
        console.error(`Błąd przy pobieraniu danych z GUS dla NIP: ${nip}`, error.message);
        return { phone: null, email: null };
    }
}

module.exports = { getCompanyData };
