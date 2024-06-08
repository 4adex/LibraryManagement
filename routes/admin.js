const { Router } = require("express");
const promisePool = require("../config/database");

const router = Router();

const ensureAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  req.session.msg = "Unauthorized Access";
  req.session.type = "error";
  return res.redirect('/');
};
router.use(ensureAdmin);

router.get("/", (req, res) => {
  const username = req.user.username;
  const msg = req.session.msg;
  const type = req.session.type;
  req.session.msg = null;
  req.session.type = null;
  return res.render("adminhome", { msg, type, username });
});

router.get("/viewbooks", async (req, res) => {
  try {
    const query = "SELECT * FROM `books`";
    const [books] = await promisePool.query(query);
    const username = req.user.username;
    const msg = req.session.msg;
    const type = req.session.type;
    req.session.msg = null;
    req.session.type = null;
    return res.render("adminBooks", { books, msg, type, username });
  } catch (error) {
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.redirect("/admin");
  }
});

router.get("/update/:bookid", async (req, res) => {
  const bookId = req.params.bookid;
  try {
    const query = "SELECT * FROM books WHERE id = ?";
    const [rows, fields] = await promisePool.query(query, [bookId]);
    if (rows.length === 0) {
      res.session.msg = "Book not found";
      res.session.type = "error";
      return res.redirect("/admin/viewbooks");
    }
    const username = req.user.username;
    const book = rows[0];
    const msg = req.session.msg;
    const type = req.session.type;
    req.session.msg = null;
    req.session.type = null;
    return res.render("updateBook", { book, msg, type, username });
  } catch (error) {
    console.error("Error fetching book:", error);
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.redirect("/admin/viewbooks");
  }
});

//UPDATING A BOOK
router.post("/update/:bookid", async (req, res) => {
  const bookId = req.params.bookid;
  const { title, author, isbn, publication_year } = req.body;
  if (!title || !author || !isbn || !publication_year) {
    req.session.msg = "Parsed data is incomplete";
    req.session.type = "error";
    return res.redirect("/admin/viewbooks");
  }
  else if (isbn.length>13){
    req.session.msg = "Isbn entered is too long";
    req.session.type = "error";
    return res.redirect("/admin/viewbooks");
  }
  try {
    const query = `
            UPDATE books
            SET title = ?, author = ?, isbn = ?, publication_year = ? 
            WHERE id = ?
        `;
    const [result] = await promisePool.query(query, [
      title,
      author,
      isbn,
      publication_year,
      bookId,
    ]);

    if (result.affectedRows === 0) {
      req.session.msg = "Book Not Found";
      req.session.type = "error";
      return res.redirect(`/admin/viewbooks`);
    }

    req.session.msg = "Book updated successfully";
    req.session.type = "success";
    res.redirect(`/admin/viewbooks`);
  } catch (error) {
    console.error("Error updating book:", error);
    req.session.msg = "Internal Server error";
    req.session.type = "error";
    res.redirect(`/admin/viewbooks`);
  }
});

//DELETING A BOOK
router.post("/delete/:bookid", async (req, res) => {
  const bookId = req.params.bookid;
  try {
    const deleteTransactionsQuery =
      "DELETE FROM transactions WHERE book_id = ?";
    await promisePool.query(deleteTransactionsQuery, [bookId]);

    const query = "DELETE FROM books WHERE id = ?";
    const [result] = await promisePool.query(query, [bookId]);

    if (result.affectedRows === 0) {
      req.session.msg = "Book not found";
      req.session.type = "error";
      return res.redirect("/admin/viewbooks");
    }

    req.session.msg = "Book deleted successfully";
    req.session.type = "success";
    return res.redirect("/admin/viewbooks");
  } catch (error) {
    // console.error("Error deleting book:", error);
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    res.redirect("/admin/viewbooks");
  }
});

router.get("/viewrequests", async (req, res) => {
  try {
    const id = req.user.id;
    const username = req.user.username;
    const query = `
    SELECT t.transaction_id, b.title, t.status, t.checkout_time, t.checkin_time
    FROM transactions t
    JOIN books b ON t.book_id = b.id
    WHERE t.status NOT IN ('checkout_rejected','checkin_rejected','returned', 'checkout_accepted');`;
    const [transactions] = await promisePool.query(query, [id]);
    const msg = req.session.msg;
    const type = req.session.type;
    req.session.msg = null;
    req.session.type = null;
    return res.render("viewrequests", { username, transactions, msg, type });
  } catch (error) {
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.redirect("/admin");
  }
});

router.post("/transaction/:id/:action", async (req, res) => {
  const transactionId = req.params.id;
  const action = req.params.action;

  if (!["accept", "reject"].includes(action)) {
    req.session.msg = "Invalid Action";
    req.session.type = "error";
    return res.redirect("/admin/viewrequests");
  }
  try {
    const query1 = "SELECT * from transactions WHERE `transaction_id`=?";
    const [transactions] = await promisePool.query(query1,[transactionId]);
    const transaction = transactions[0];
    var new_status ="";
    if (action=="accept"){
      var query2="";
      if (transaction.status =="checkout_requested") {
        new_status = "checkout_accepted";
        query2 = "UPDATE `books` SET available_copies=available_copies-1 WHERE `id`=?";
      }
      else if (transaction.status == "checkin_requested") {
        new_status = "returned";
        query2 = "UPDATE `books` SET available_copies=available_copies+1 WHERE `id`=?";
      }
      else{
        req.session.msg = "Not a valid action to do on transaction"
        req.session.type = "error"
        return res.redirect("/admin/viewrequests");
      }
      const [rows,fields] = await promisePool.query(query2,[transaction.book_id]);
    }
    else {
      if (transaction.status =="checkout_requested") {
        new_status = "checkout_rejected";
      }
      else if (transaction.status == "checkin_requested") {
        new_status = "checkin_rejected";
      }
      else{
        req.session.msg = "Not a valid action to do on transaction"
        req.session.msg = "error"
        return res.redirect("/admin/viewrequests");
      }
    }
    const query3 = "UPDATE transactions SET status = ? WHERE transaction_id = ?";
    const [result] = await promisePool.query(query3, [new_status, transactionId]);

    if (result.affectedRows === 0) {
      req.session.msg = "Transaction not found";
      req.session.type = "error";
      return res.redirect("/admin/viewrequests");
    }
    req.session.msg = "Transaction updated successfully";
    req.session.type = "success";
    return res.redirect("/admin/viewrequests");
  } catch (error) {
    req.session.msg = "Error Updating Transaction";
    req.session.type = "error";
    console.error("Error updating transaction:", error);
    res.redirect("/admin/viewrequests");
    // res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/addbook", async (req, res) => {
  try {
    const username = req.user.username;
    const msg = req.session.msg;
    const type = req.session.type;
    req.session.msg = null;
    req.session.type = null;
    return res.render("addbook", { msg, type, username });
  } catch (error) {
    console.error("Error fetching book:", error);
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.redirect("/admin/viewbooks");
  }
});

router.post("/addbook", async (req, res) => {
  try {
    const { title, author, isbn, publication_year, total_copies } = req.body;
    if (!title || !author || !isbn || !publication_year || !total_copies) {
      req.session.msg = "Parsed data is incomplete";
      req.session.type = "error";
      return res.redirect("/admin/addbook");
    }
    else if (isbn.length>13){
      req.session.msg = "Isbn entered is too long";
      req.session.type = "error";
      return res.redirect("/admin/viewbooks");
    }
    const query =
      "INSERT INTO books (title, author, isbn, publication_year, total_copies, available_copies) VALUES (?, ?, ?, ?, ?, ?);";
    const [result] = await promisePool.query(query, [
      title,
      author,
      isbn,
      publication_year,
      total_copies,
      total_copies,
    ]);
    req.session.msg = "Book Added successfully";
    req.session.type = "success";
    return res.redirect("/admin/addbook");
  } catch (error) {
    // console.error("Error fetching book:", error);
    req.session.msg = "Internal Server Error (Error Adding Book)";
    req.session.type = "error";
    return res.redirect("/admin");
  }
});

router.get("/adminrequest", async (req, res) => {
  try {
    const query = `SELECT admin_requests.id, admin_requests.user_id, admin_requests.status, users.username
    FROM admin_requests
    INNER JOIN users ON admin_requests.user_id = users.id;`;
    const [requests] = await promisePool.query(query);
    const username = req.user.username;
    const msg = req.session.msg;
    const type = req.session.type;
    req.session.msg = null;
    req.session.type = null;
    return res.render("adminrequest", { requests, msg, type, username });
  } catch (error) {
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.redirect("/admin");
  }
});

router.post("/adminrequest/accept/:id", async (req, res) => {
  try {
    const requestId = req.params.id;

    const getUserQuery = "SELECT user_id FROM `admin_requests` WHERE `id`=?";
    const [userResult] = await promisePool.query(getUserQuery, [requestId]);
    if (userResult.length === 0) {
      req.session.msg = "Admin request not found";
      req.session.type = "error";
      return res.redirect("/admin/adminrequest");
    }
    const userId = userResult[0].user_id;

    const updateUserRoleQuery = "UPDATE `users` SET `role`='admin' WHERE `id`=?";
    await promisePool.query(updateUserRoleQuery, [userId]);

    const deleteRequestQuery = "DELETE FROM `admin_requests` WHERE `id`=?";
    await promisePool.query(deleteRequestQuery, [requestId]);

    req.session.msg = "Admin access granted successfully";
    req.session.type = "success";
    return res.redirect("/admin/adminrequest");
  } catch (error) {
    console.error("Error granting admin access:", error);
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.redirect("/admin/adminrequest");
  }
});

// Declining the admin request
router.post("/adminrequest/decline/:id", async (req, res) => {
  try {
    const requestId = req.params.id;

    const deleteRequestQuery = "DELETE FROM `admin_requests` WHERE `id`=?";
    const [result] = await promisePool.query(deleteRequestQuery, [requestId]);

    if (result.affectedRows === 0) {
      req.session.msg = "Admin request not found";
      req.session.type = "error";
      return res.redirect("/admin/adminrequest");
    }

    req.session.msg = "Admin request declined successfully";
    req.session.type = "success";
    return res.redirect("/admin/adminrequest");
  } catch (error) {
    console.error("Error declining admin request:", error);
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.redirect("/admin/adminrequest");
  }
});


module.exports = router;
