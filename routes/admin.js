const { Router } = require("express");
const {
    fetchAllBooks,
  } = require("../controllers/books");
const promisePool = require("../config/database");

const router = Router();

router.get("/admin", (req, res) => {
    return res.render("adminhome");
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
        const [result] = await promisePool.query(query, [title, author, isbn, publication_year, available, bookId]);

        if (result.affectedRows === 0) {
            return res.redirect(`/admin/books?msg=Book_not_found&type=error`);
        }

        res.redirect(`/admin/books?msg=Book_updated_successfully&type=success`);
    } catch (error) {
        console.error("Error updating book:", error);
        res.redirect(`/admin/books?msg=Internal_server_error&type=error`);
    }
});

//DELETING A BOOK
router.post("/admin/delete/:bookid", async (req, res) => {
    const bookId = req.params.bookid;

    try {

        const deleteTransactionsQuery = "DELETE FROM transactions WHERE book_id = ?";
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


module.exports = router;