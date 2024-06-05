const mysql = require("mysql2");

// const connection = mysql.createConnection({
//   host: "localhost",
//   user: "root",
//   database: "library_management",
//   // port: 3306,
//   password: "HolmesS123",
// });
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    database: 'library_management',
    password: 'HolmesS123'
  });

const promisePool = pool.promise();

// connection.connect(function (err) {
//   if (err) {
//     console.log("error");
//   } else {
//     console.log("DB Connected!");
//   }
// });

module.exports = promisePool;
