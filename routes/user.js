// There will be an login n sigup page n
const {
  createNewUser,
  matchPasswordAndGenerateToken,
} = require("../controllers/user");
const promisePool = require("../config/database");
const { createHmac, randomBytes } = require("crypto");
const { createTokenForUser, validateToken } = require("../authentication");
const { Router } = require("express");

const router = Router();

//This is the main dashboard that someone is trying to access if it is
router.get("/", (req, res) => {
  if (!req.user) {
    return res.redirect("/signin");
  } else if (req.user.role == "admin") {
    const username = req.user.username;
    return res.render("home", {username});
  } else {
    const username = req.user.username;
    const msg = req.session.msg;
    const type = req.session.type;
    req.session.msg = null;
    req.session.type = null;
    return res.render("home", {username, msg, type});
  }
});

router.get("/signin", (req, res) => {
  const msg = req.session.msg;
  const type = req.session.type;
  req.session.msg = null;
  req.session.type = null;
  return res.render("signin", {msg, type});
});

router.get("/signup", (req, res) => {
  const msg = req.session.msg;
  const type = req.session.type;
  req.session.msg = null;
  req.session.type = null;
  return res.render("signup", {msg,type});
});


//LOGOUT (simply deleting the cookie and redirecting)
router.get("/logout", (req, res) => {
  res.clearCookie("token").redirect("/");
});

// SIGNUP, Creating new user here
router.post("/signup", async (req, res) => {
  const body = req.body;
  if (!body.email){
    req.session.msg = "Please enter valid email";
    req.session.type = "error";
    return res.redirect("/signup");
  }
  else if (!body.username){
    req.session.msg = "Please enter username first";
    req.session.type = "error";
    return res.redirect("/signup");
  }
  else if (!body.password){
    req.session.msg = "Please enter password";
    req.session.type = "error";
    return res.redirect("/signup");
  }
  try {
    const salt = randomBytes(16).toString("hex");
    const hashedPassword = createHmac("sha256", salt)
      .update(body.password)
      .digest("hex");
    const query = `
    INSERT INTO users (username, password, email, role, salt)
    VALUES (?, ?, ?, ?, ?)
  `;
    const [rows, fields] = await promisePool.query(query, [
      body.username,
      hashedPassword,
      body.email,
      "client",
      salt,
    ]);

    req.session.msg = "User created successfully! You can login now"
    req.session.type = "success";
    return res.redirect("/signin");

  } catch (error) {
    req.session.msg = "Internal Server Error"
    req.session.type = "error";
    return res.redirect("/signup");
  }
});

// SIGNIN OR LOGIN, Making token for user and saving it in its cookies
router.post("/signin", async (req, res) => {
  const { email, password } = req.body;
  if (!email){
    req.session.msg = "Please enter valid email";
    req.session.type = "error";
    return res.redirect("/signin");
  }
  else if (!password){
    req.session.msg = "Please enter password";
    req.session.type = "error";
    return res.redirect("/signin");
  }
  const query = "SELECT * FROM `users` WHERE `email` = ?";

  try {
    const [rows, fields] = await promisePool.query(query, [email]);
    const user = rows[0];
    if (!user) {
      // throw new Error("User not found");
      req.session.msg = "User not found";
      req.session.type = "error";
      return res.redirect("/signin");
    }
    // console.log(user);
    const salt = user.salt;
    const hashedPassword = user.password;

    const userProvidedHash = createHmac("sha256", salt)
      .update(password)
      .digest("hex");

    if (hashedPassword !== userProvidedHash) {
      req.session.msg = "Incorrect Password";
      req.session.type = "error";
      return res.redirect("/signin");
    }

    const token = createTokenForUser(user);
    return res.cookie("token", token).redirect("/");
  } catch (err) {
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.redirect("/signin");
  }
  
});

module.exports = router;
