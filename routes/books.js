const { Router } = require("express");
const router = Router();
const promisePool = require("../config/database");

router.get("/viewBooks", async (req, res) => {
  try {
    const query = "SELECT * FROM `books`";
    const [books] = await promisePool.query(query);
    const username = req.user.username;
    const msg = req.session.msg;
    const type = req.session.type;
    req.session.msg = null;
    req.session.type = null;
    res.status(200).render("viewBooks", { books, msg, type, username });
  } catch (error) {
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.status(500).redirect("/");
  }
});

router.post("/checkout/:id", async (req, res) => {
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
    return res.status(201).redirect("/viewBooks");
  } catch (error) {
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.status(500).redirect("/viewBooks");
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
    return res.status(200).render("viewhistory", { username, transactions, msg, type });
  } catch (error) {
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.status(500).redirect("/");
  }
});

router.get("/viewholdings", async (req, res) => {
  try {
    const userId = req.user.id;
    const username = req.user.username;
    const query = `SELECT t.transaction_id, b.title, b.author, t.checkout_time
    FROM books b
    JOIN transactions t ON b.id = t.book_id
    WHERE t.status IN ('checkout_accepted', 'checkin_requested') AND t.user_id = ?;`
    const [transactions] = await promisePool.query(query, [userId]);
    const msg = req.session.msg;
    const type = req.session.type;
    req.session.msg = null;
    req.session.type = null;
    return res.status(200).render("viewholdings", { transactions, msg, type, username });
  } catch (error) {
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.status(500).redirect("/");
  }
});

router.post("/checkin/:transactionId", async (req, res) => {
  try {
    const transactionId = req.params.transactionId;
    const query1 = "SELECT * FROM `transactions` WHERE `transaction_id`=?";
    const [transactions] = await promisePool.query(query1, [transactionId]);
    if (transactions.length === 0) {
      req.session.msg = "Transaction not found";
      req.session.type = "error";
      return res.status(404).redirect("/");
    } else if (transactions[0].status == "checkin_requested") {
      req.session.msg = "Checkin is already requested for this transaction";
      req.session.type = "error";
      return res.status(400).redirect("/");
    } else if (transactions[0].status == "checkin_accepted") {
      req.session.msg = "Checkin is already accepted for this transaction";
      req.session.type = "error";
      return res.status(400).redirect("/");
    } else if (transactions[0].status != "checkout_accepted") {
      req.session.msg = "Transaction must be checked out first";
      req.session.type = "error";
      return res.status(400).redirect("/");
    } 
    const userId = req.user.id;
    const currentDatetime = new Date()
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
    const query = "UPDATE `transactions` SET `status` = ?, `checkin_time` = ? WHERE `transaction_id` = ?";
    const [rows,fields] = await promisePool.query(query, ['checkin_requested', currentDatetime, transactionId]);
    req.session.msg = "Checkin request sent successfully";
    req.session.type = "success";
    return res.status(200).redirect("/");
  } catch (error) {
    console.log(error);
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.status(500).redirect("/");
  }
});

router.post("/reqadmin", async (req, res) => {
  try {
    const userId = req.user.id;

    // Check the user's request status
    const checkRequestQuery = "SELECT role, request_status FROM users WHERE id = ?";
    const [rows] = await promisePool.query(checkRequestQuery, [userId]);
    if (rows[0].role === "admin") {
      req.session.msg = "You are already an admin";
      req.session.type = "error";
      return res.status(201).redirect("/");
    }
    // If the request status is 'rejected' or 'not_requested', allow the user to submit a new request
    if (rows[0].request_status === 'rejected' || rows[0].request_status === 'not_requested') {
      // Update the request status to 'pending' in the users table
      const updateRequestQuery = "UPDATE users SET request_status = 'pending' WHERE id = ?";
      await promisePool.query(updateRequestQuery, [userId]);

      req.session.msg = "Admin request sent successfully";
      req.session.type = "success";
      return res.status(201).redirect("/");
    }

    // If the request status is 'pending' or 'accepted', inform the user that a request is already pending or has been accepted
    req.session.msg = "Admin request already exists or has been accepted";
    req.session.type = "error";
    return res.status(400).redirect("/");
  } catch (error) {
    console.error("Error sending admin request:", error);
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.status(500).redirect("/");
  }
});

router.get("/reqadmin", async (req, res) => {
  try {
    const userId = req.user.id;
    const username = req.user.username;
    const msg = req.session.msg;
    const type = req.session.type;

    const checkRequestQuery = "SELECT request_status FROM users WHERE id = ?";
    const [rows] = await promisePool.query(checkRequestQuery, [userId]);

    if (rows[0].request_status === 'rejected' || rows[0].request_status === 'not_requested') {
      return res.render("reqadmin", { username, msg, type });
    }

    req.session.msg = "Admin request already exists or has been accepted";
    req.session.type = "error";
    return res.status(400).redirect("/");
  } catch (error) {
    console.error("Error handling admin request:", error);
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.status(500).redirect("/");
  }
});

module.exports = router;
