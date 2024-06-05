const { Router } = require("express");
const router = Router();
const {
  fetchAllBooks,
  handlecheckoutrequest,
  fetchTransactionsByUserId,
  fetchCheckedOutBooksByUserId,
  handlecheckinrequest,
} = require("../controllers/books");

router.get("/viewBooks", async (req, res) => {
  const books = await fetchAllBooks();
  const msg = null;
  res.render("viewBooks", { books, msg });
});

router.post("/checkout/:id", async (req, res) => {
  const books = await fetchAllBooks();
  const msg = await handlecheckoutrequest(req);
  console.log(msg);
  bookid = req.params.id;
  res.render("viewBooks", { books, msg, bookid }); //This is not working currently
});

router.get("/history", async (req, res) => {
  const transactions = await fetchTransactionsByUserId(req);
  res.render("viewhistory", { transactions });
});

router.get("/viewholdings", async (req, res) => {
  const holdings = await fetchCheckedOutBooksByUserId(req);
  res.render("viewholdings", { holdings });
});

router.post("/checkin/:transactionId", async (req, res) => {
  const msg = handlecheckinrequest(req);
  res.redirect("/viewholdings");
});



module.exports = router;
