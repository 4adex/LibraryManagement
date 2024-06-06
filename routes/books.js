const { Router } = require("express");
const router = Router();
const {
  fetchAllBooks,
  fetchCheckedOutBooksByUserId,
  handlecheckinrequest,
} = require("../controllers/books");
const promisePool = require("../config/database");

//This route is completed
router.get("/viewBooks", async (req, res) => {
  try {
    const query = "SELECT * FROM `books`";
    const [books] = await promisePool.query(query);
    const username = req.user.username;
    const msg = req.session.msg;
    const type = req.session.type;
    req.session.msg = null;
    req.session.type = null;
    res.render("viewBooks", { books, msg, type, username });
  } catch (error) {
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.redirect("/");
  }
});

//Route was for testing purposes
router.get("/bookstest", async (req, res) => {
  const books = await fetchAllBooks();
  const msg = null;
  const username = req.user.username;
  res.render("home2", { books, msg, username });
});

//This route is also done now
router.post("/checkout/:id", async (req, res) => {
  // const books = await fetchAllBooks();
  const bookid = req.params.id;
  const userid = req.user.id;
  const currentDatetime = new Date()
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  try {
    const query =
      "INSERT INTO `transactions`(`user_id`, `book_id`, `status`,`checkout_time`) VALUES (?,?,?,?)";
    const [rows, fields] = await promisePool.query(query, [
      userid,
      bookid,
      "checkout_requested",
      currentDatetime,
    ]);
    req.session.msg = "Checkout requested successfully for book";
    req.session.type = "success";
    return res.redirect("/viewBooks");
  } catch (error) {
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.redirect("/viewBooks");
  }
});

router.get("/history", async (req, res) => {
  try {
    const id = req.user.id;
    const username = req.user.username;
    const query = `
    SELECT t.transaction_id, b.title AS title, t.status AS status, t.checkout_time, t.checkin_time
    FROM transactions t
    JOIN books b ON t.book_id = b.id
    WHERE t.user_id = ?;`;
    const [transactions] = await promisePool.query(query, [id]);
    const msg = req.session.msg;
    const type = req.session.type;
    req.session.msg = null;
    req.session.type = null;
    return res.render("home2", { username, transactions, msg, type });
  } catch (error) {
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.redirect("/");
  }
  // const transactions = await fetchTransactionsByUserId(req);
  // res.render("viewhistory", { transactions });
});

router.get("/viewholdings", async (req, res) => {
  const holdings = await fetchCheckedOutBooksByUserId(req);
  res.render("viewholdings", { holdings });
});

router.post("/checkin/:transactionId", async (req, res) => {
  try {
    const transactionId = req.params.transactionId;
    const query1 = "SELECT * FROM `transactions` WHERE `transaction_id`=?";
    const [transactions] = await promisePool.query(query1, [transactionId]);
    if (transactions.length === 0) {
      req.session.msg = "Transaction not found";
      req.session.type = "error";
      return res.redirect("/");
    } else if (transactions[0].status != "checkout_accepted") {
      req.session.msg = "Transaction must be checked in first";
      req.session.type = "error";
      return res.redirect("/");
    }
    const userId = req.user.id;
    const currentDatetime = new Date()
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
    const query = "UDATE `transactions` SET `status` = ?, `checkin_time` = ? WHERE `transaction_id` = ?";
    const [rows,fields] = await promisePool.query(query, ['checkin_requested', currentDatetime, transactionId]);
    
  } catch (error) {}
});

module.exports = router;
