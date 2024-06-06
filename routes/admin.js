const { Router } = require("express");
const { fetchAllBooks } = require("../controllers/books");
const promisePool = require("../config/database");

const router = Router();

router.get("/admin", (req, res) => {
    const msg = req.session.msg;
    const type = req.session.type;
    req.session.msg = null;
  req.session.type = null;
  return res.render("adminhome", {msg,type});
});

router.get("/admin/viewbooks", async (req, res) => {
  const books = await fetchAllBooks();
  const msg = req.session.msg;
  const type = req.session.type;
  // Clear session variables after retrieving
  req.session.msg = null;
  req.session.type = null;
  return res.render("adminBooks", { books, msg, type });
});

router.get('/admin/update/:bookid', async (req, res) => {
    const bookId = req.params.bookid;
    try {
        const query = "SELECT * FROM books WHERE id = ?";
        const [rows, fields] = await promisePool.query(query, [bookId]);

        const book = rows[0];
        const msg = req.session.msg;
        const type = req.session.type;
        req.session.msg = null;
        req.session.type = null;
        res.render('updateBook', { book, msg, type});
    } catch (error) {
        console.error("Error fetching book:", error);
        req.session.msg = "Internal Server Error"
        req.session .type = "error"
        res.redirect('/admin/viewbooks');
    }
});



//UPDATING A BOOK
router.post("/admin/update/:bookid", async (req, res) => {
  const bookId = req.params.bookid;
  const { title, author, isbn, publication_year, available } = req.body;

  try {
    const query = `
            UPDATE books
            SET title = ?, author = ?, isbn = ?, publication_year = ?, available = ? 
            WHERE id = ?
        `;
    const [result] = await promisePool.query(query, [
      title,
      author,
      isbn,
      publication_year,
      available,
      bookId,
    ]);

    if (result.affectedRows === 0) {
        req.session.msg = "Book Not Found";
        req.session.type = "error";
      return res.redirect(`/admin/viewbooks`);
    }

    req.session.msg = "Book updated successfully";
    req.session.type = "success";
    res.redirect(`/admin/update/${bookId}`);
  } catch (error) {
    console.error("Error updating book:", error);
    req.session.msg = "Internal Server error";
    req.session.type = "error";
    res.redirect(`/admin/update/${bookId}`);
  }
});

//DELETING A BOOK
router.post("/admin/delete/:bookid", async (req, res) => {
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
    console.error("Error deleting book:", error);
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    res.redirect("/admin/viewbooks");
  }
});

router.get('/admin/viewrequests', async (req, res) => {
    try {
        const query = `
            SELECT t.*, b.title, b.author, u.username 
            FROM transactions t
            JOIN books b ON t.book_id = b.id
            JOIN users u ON t.user_id = u.id
            WHERE t.is_accepted = 'pending'
        `;
        const [requests] = await promisePool.query(query);
        const msg = req.session.msg;
        const type = req.session.type;
        req.session.msg = null;
        req.session.type = null;
        res.render('viewRequests', { requests, msg, type });
    } catch (error) {
        console.error("Error fetching requests:", error);
        req.session.msg = "Error fetching results";
        req.session.type = "error";
        res.redirect("/admin");
        // res.status(500).json({ message: "Internal server error" });
    }
});

router.post('/admin/transaction/:id/:action', async (req, res) => {
    const transactionId = req.params.id;
    const action = req.params.action;

    if (!['accepted', 'rejected'].includes(action)) {
        req.session.msg = "Invalid Action";
        req.session.type = "error";
        res.redirect("/admin/viewrequests");
        // return res.status(400).json({ message: "Invalid action" });
    }

    try {
        const query = 'UPDATE transactions SET is_accepted = ? WHERE id = ?';
        const [result] = await promisePool.query(query, [action, transactionId]);

        if (result.affectedRows === 0) {
            req.session.msg = "Transaction not found";
            req.session.type = "error";
            return res.redirect("/admin/viewrequests");
            // return res.status(404).json({ message: "Transaction not found" });
        }

        req.session.msg = "Transaction updated successfully";
        req.session.type = "success";
        res.redirect('/admin/viewrequests');
    } catch (error) {
        req.session.msg = "Error Updating Transaction";
        req.session.type = "error";
        console.error("Error updating transaction:", error);
        res.redirect("/admin/viewrequests");
        // res.status(500).json({ message: "Internal server error" });
    }
});





module.exports = router;
