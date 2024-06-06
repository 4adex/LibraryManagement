const promisePool = require("../config/database");

async function fetchAllBooks() {
  const query = "SELECT * FROM `books`";
  const [rows, fields] = await promisePool.query(query);
  return rows;
}

async function handlecheckoutrequest(req) {
  const bookid = req.params.id;
  const userid = req.user.id;
  const currentDatetime = new Date()
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  const query =
    "INSERT INTO `transactions`(`user_id`, `book_id`, `status`,`checkout_time`) VALUES (?,?,?,?)";
  const [rows, fields] = await promisePool.query(query, [
    userid,
    bookid,
    currentDatetime,
    "checkout",
  ]);
  return `Checkout request sent to admin successfully`;
}

async function fetchTransactionsByUserId(req) {
  const id = req.user.id;
  const query = `
    SELECT t.id, b.title, b.author, t.transaction_datetime, t.is_accepted, t.transaction_type 
    FROM transactions t 
    JOIN books b ON t.book_id = b.id 
    WHERE t.user_id = ?
`;
  const [rows, fields] = await promisePool.query(query, [id]);
  return rows;
}

async function fetchCheckedOutBooksByUserId(req) {
  const userId = req.user.id;
  const query = `
        SELECT t.id AS transaction_id, b.id AS book_id, b.title, b.author, t.transaction_datetime 
        FROM transactions t 
        JOIN books b ON t.book_id = b.id 
        WHERE t.user_id = ? AND t.transaction_type = 'checkout' AND t.is_accepted = 1
        AND NOT EXISTS (
            SELECT 1 FROM transactions t2
            WHERE t2.user_id = t.user_id AND t2.book_id = t.book_id AND t2.transaction_type = 'checkin' AND t2.is_accepted = 1 AND t2.transaction_datetime > t.transaction_datetime
        )
    `;
  const [rows, fields] = await promisePool.query(query, [userId]);
  return rows;
}

async function handlecheckinrequest(req) {
  const transactionId = req.params.transactionId;
  const userId = req.user.id;
  const currentDatetime = new Date()
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  const query = `
        INSERT INTO transactions (user_id, book_id, transaction_datetime, transaction_type, is_accepted) 
        SELECT user_id, book_id, ?, 'checkin', 0
        FROM transactions 
        WHERE id = ? AND user_id = ?
    `;
  await promisePool.query(query, [currentDatetime, transactionId, userId]);
  return "Success";
}

module.exports = {
  fetchAllBooks,
  handlecheckoutrequest,
  fetchTransactionsByUserId,
  fetchCheckedOutBooksByUserId,
  handlecheckinrequest
};
