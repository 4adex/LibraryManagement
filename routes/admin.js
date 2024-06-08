const { Router } = require("express");
const promisePool = require("../config/database");

const router = Router();

const ensureAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  req.session.msg = "Unauthorized Access";
  req.session.type = "error";
  return res.status(403).redirect('/');
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
    return res.status(500).redirect("/admin");
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
      return res.status(404).redirect("/admin/viewbooks");
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
    return res.status(500).redirect("/admin/viewbooks");
  }
});

router.post("/update/:bookid", async (req, res) => {
  const bookId = req.params.bookid;
  const { title, author, isbn, publication_year } = req.body;
  if (!title || !author || !isbn || !publication_year) {
    req.session.msg = "Parsed data is incomplete";
    req.session.type = "error";
    return res.status(400).redirect("/admin/viewbooks");
  }
  else if (isbn.length > 13) {
    req.session.msg = "Isbn entered is too long";
    req.session.type = "error";
    return res.status(400).redirect("/admin/viewbooks");
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
      return res.status(404).redirect(`/admin/viewbooks`);
    }

    req.session.msg = "Book updated successfully";
    req.session.type = "success";
    return res.status(200).redirect(`/admin/viewbooks`);
  } catch (error) {
    console.error("Error updating book:", error);
    req.session.msg = "Internal Server error";
    req.session.type = "error";
    return res.status(500).redirect(`/admin/viewbooks`);
  }
});

router.post("/delete/:bookid", async (req, res) => {
  const bookId = req.params.bookid;
  try {
    // Check if the book is currently checked out
    const checkQuery = "SELECT COUNT(*) AS count FROM transactions WHERE book_id = ? AND status = 'checkout_accepted'";
    const [checkResult] = await promisePool.query(checkQuery, [bookId]);

    if (checkResult[0].count > 0) {
      req.session.msg = "Cannot delete book that is currently checked out";
      req.session.type = "error";
      return res.status(400).redirect("/admin/viewbooks");
    }

    // Delete transactions related to the book
    const deleteTransactionsQuery = "DELETE FROM transactions WHERE book_id = ?";
    await promisePool.query(deleteTransactionsQuery, [bookId]);

    // Delete the book
    const query = "DELETE FROM books WHERE id = ?";
    const [result] = await promisePool.query(query, [bookId]);

    if (result.affectedRows === 0) {
      req.session.msg = "Book not found";
      req.session.type = "error";
      return res.status(404).redirect("/admin/viewbooks");
    }

    req.session.msg = "Book deleted successfully";
    req.session.type = "success";
    return res.status(200).redirect("/admin/viewbooks");
  } catch (error) {
    console.error("Error deleting book:", error);
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.status(500).redirect("/admin/viewbooks");
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
      WHERE t.status NOT IN ('checkout_rejected', 'checkin_rejected', 'returned', 'checkout_accepted');
    `;
    const [transactions] = await promisePool.query(query, [id]);
    const msg = req.session.msg;
    const type = req.session.type;
    req.session.msg = null;
    req.session.type = null;
    return res.render("viewrequests", { username, transactions, msg, type });
  } catch (error) {
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.status(500).redirect("/admin");
  }
});

router.post("/transaction/:id/:action", async (req, res) => {
  const transactionId = req.params.id;
  const action = req.params.action;

  if (!["accept", "reject"].includes(action)) {
    req.session.msg = "Invalid Action";
    req.session.type = "error";
    return res.status(400).redirect("/admin/viewrequests");
  }
  try {
    const query1 = "SELECT * from transactions WHERE `transaction_id`=?";
    const [transactions] = await promisePool.query(query1, [transactionId]);
    const transaction = transactions[0];
    let new_status = "";
    if (action === "accept") {
      let query2 = "";
      if (transaction.status == "checkout_requested") {
        new_status = "checkout_accepted";
        query2 = "UPDATE `books` SET available_copies=available_copies-1 WHERE `id`=?";
      } else if (transaction.status == "checkin_requested") {
        new_status = "returned";
        query2 = "UPDATE `books` SET available_copies=available_copies+1 WHERE `id`=?";
      } else {
        req.session.msg = "Not a valid action to do on transaction";
        req.session.type = "error";
        return res.status(400).redirect("/admin/viewrequests");
      }
      await promisePool.query(query2, [transaction.book_id]);
    } else {
      if (transaction.status == "checkout_requested") {
        new_status = "checkout_rejected";
      } else if (transaction.status == "checkin_requested") {
        new_status = "checkin_rejected";
      } else {
        req.session.msg = "Not a valid action to do on transaction";
        req.session.type = "error";
        return res.status(400).redirect("/admin/viewrequests");
      }
    }
    const query3 = "UPDATE transactions SET status = ? WHERE transaction_id = ?";
    const [result] = await promisePool.query(query3, [new_status, transactionId]);

    if (result.affectedRows === 0) {
      req.session.msg = "Transaction not found";
      req.session.type = "error";
      return res.status(404).redirect("/admin/viewrequests");
    }
    req.session.msg = "Transaction updated successfully";
    req.session.type = "success";
    return res.status(200).redirect("/admin/viewrequests");
  } catch (error) {
    req.session.msg = "Error Updating Transaction";
    req.session.type = "error";
    console.error("Error updating transaction:", error);
    return res.status(500).redirect("/admin/viewrequests");
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
    return res.status(500).redirect("/admin/viewbooks");
  }
});

router.post("/addbook", async (req, res) => {
  try {
    const { title, author, isbn, publication_year, total_copies } = req.body;

    // Validate each input and set appropriate error messages
    if (!title) {
      req.session.msg = "Title is required";
      req.session.type = "error";
      return res.status(400).redirect("/admin/addbook");
    }

    if (!author) {
      req.session.msg = "Author is required";
      req.session.type = "error";
      return res.status(400).redirect("/admin/addbook");
    }

    if (!isbn) {
      req.session.msg = "ISBN is required";
      req.session.type = "error";
      return res.status(400).redirect("/admin/addbook");
    } else if (isbn.length > 13) {
      req.session.msg = "ISBN entered is too long";
      req.session.type = "error";
      return res.status(400).redirect("/admin/addbook");
    }

    if (!publication_year) {
      req.session.msg = "Publication year is required";
      req.session.type = "error";
      return res.status(400).redirect("/admin/addbook");
    } else if (isNaN(publication_year) || publication_year < 1000 || publication_year > new Date().getFullYear()) {
      req.session.msg = "Invalid publication year";
      req.session.type = "error";
      return res.status(400).redirect("/admin/addbook");
    }

    if (!total_copies) {
      req.session.msg = "Total copies are required";
      req.session.type = "error";
      return res.status(400).redirect("/admin/addbook");
    } else if (isNaN(total_copies) || total_copies <= 0) {
      req.session.msg = "Total copies must be a positive number";
      req.session.type = "error";
      return res.status(400).redirect("/admin/addbook");
    }

    const query = `
      INSERT INTO books (title, author, isbn, publication_year, total_copies, available_copies)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await promisePool.query(query, [
      title,
      author,
      isbn,
      publication_year,
      total_copies,
      total_copies
    ]);

    req.session.msg = "Book added successfully";
    req.session.type = "success";
    return res.status(201).redirect("/admin/addbook");
  } catch (error) {
    console.error("Error adding book:", error);
    req.session.msg = "Internal Server Error (Error Adding Book)";
    req.session.type = "error";
    return res.status(500).redirect("/admin");
  }
});

router.get("/adminrequest", async (req, res) => {
  try {
    const query = `
      SELECT id, username, request_status
      FROM users
      WHERE role = 'client' AND request_status ="pending";
    `;
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
    return res.status(500).redirect("/admin");
  }
});

router.post("/adminrequest/accept/:id", async (req, res) => {
  try {
    
    const userId = req.params.id;

    const updateUserRoleQuery = "UPDATE users SET role = 'admin', request_status = 'accepted' WHERE id = ?";
    await promisePool.query(updateUserRoleQuery, [userId]);

    req.session.msg = "Admin access granted successfully";
    req.session.type = "success";
    return res.status(200).redirect("/admin/adminrequest");

  } catch (error) {
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.status(500).redirect("/admin/adminrequest");
  }
});

router.post("/adminrequest/decline/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    const updateRequestStatusQuery = "UPDATE users SET request_status = 'rejected' WHERE id = ?";
    await promisePool.query(updateRequestStatusQuery, [userId]);

    req.session.msg = "Admin request declined successfully";
    req.session.type = "success";
    return res.status(200).redirect("/admin/adminrequest");
  } catch (error) {
    console.error("Error declining admin request:", error);
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.status(500).redirect("/admin/adminrequest");
  }
});

module.exports = router;
