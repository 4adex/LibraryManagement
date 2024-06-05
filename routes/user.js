// There will be an login n sigup page n
const {
  createNewUser,
  matchPasswordAndGenerateToken,
} = require("../controllers/user");
const { Router } = require("express");

const router = Router();

//This is the main dashboard that someone is trying to access if it is
router.get("/", (req, res) => {
  if (!req.user) {
    return res.redirect("/signin");
  } else if (req.user.role == "admin") {
    return res.render("home");
  } else {
    return res.render("home");
  }
});

router.get("/signin", (req, res) => {
  return res.render("signin");
});

router.get("/signup", (req, res) => {
  return res.render("signup");
});

router.get("/logout", (req, res) => {
  res.clearCookie("token").redirect("/");
});

// SIGNUP, Creating new user here
router.post("/signup", async (req, res) => {
  const body = req.body;
  createNewUser(body, res);
  // return res.redirect("/");
});

// SIGNIN OR LOGIN, Making token for user and saving it in its cookies
router.post("/signin", async (req, res) => {
  const { email, password } = req.body;
  const token = await matchPasswordAndGenerateToken(email, password);
  return res.cookie("token", token).redirect("/");
});

module.exports = router;
