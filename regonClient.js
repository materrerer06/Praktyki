const Client = require('./index');

const client = Client.createClient({
    key: "abcde12345abcde12345",
    sandbox: true,
    birVersion: '1.1'
});

// Funkcja, która przyjmuje NIP i zwraca dane kontaktowe
async function getCompanyData(nip) {
    try {
        const gus = await client;
        // Najpierw szukamy firmy po NIP
        const findCompanyByNip = await gus.findByNip(nip);

        // Jeśli nie znaleziono firmy, zwracamy null
        if (!findCompanyByNip || findCompanyByNip.ErrorCode) {
            return {
                phone: null,
                email: null
            };
        }

        // Pobieramy REGON i typ podmiotu z wyników wyszukiwania
        const company = Array.isArray(findCompanyByNip) ? findCompanyByNip[0] : findCompanyByNip;
        const regon = company.Regon;
        const typ = company.Typ; // "F" = fizyczna, "P" = prawna
        const silosId = company.SilosID;

        // Określamy typ raportu na podstawie typu podmiotu
        let reportType;
        if (typ === "F") {
            reportType = "BIR11OsFizycznaDaneOgolne";
        } else if (typ === "P") {
            reportType = "BIR11OsPrawna";
        } else {
            return {
                phone: null,
                email: null
            };
        }

        // Pobieramy pełny raport
        const fullReport = await gus.getFullReport(regon, reportType, silosId);

        // Wyciągamy numer telefonu i email z odpowiednich pól
        let phone = null;
        let email = null;
        if (typ === "F" && fullReport) {
            phone = fullReport.fiz_numerTelefonu || null;
            email = fullReport.fiz_adresEmail || null;
        } else if (typ === "P" && fullReport) {
            phone = fullReport.praw_numerTelefonu || null;
            email = fullReport.praw_adresEmail || null;
        }

        return {
            phone: phone,
            email: email
        };
    } catch (error) {
        console.error(`Błąd przy pobieraniu danych z GUS dla NIP: ${nip}`, error);
        throw error;
    }
}

module.exports = { getCompanyData };
