const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost', // Replace with your database host
    user: 'root', // Replace with your database username
    password: '', // Replace with your database password
    database: 'company_db' // Replace with your database name
});

// Connect to the database
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the database.');

    // SQL query to delete data from the table
    const sql = 'DELETE FROM `woj_lodzkie`;';

    // Execute the query
    connection.query(sql, (err, result) => {
        if (err) {
            console.error('Error executing the query:', err);
        } else {
            console.log('Data deleted successfully:', result);
        }

        // Close the connection
        connection.end((err) => {
            if (err) {
                console.error('Error closing the connection:', err);
            } else {
                console.log('Connection closed.');
            }
        });
    });
});