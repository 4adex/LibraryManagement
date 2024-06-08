// There will be an login n sigup page n
const promisePool = require("../config/database");
const { createHmac, randomBytes } = require("crypto");
const { createTokenForUser} = require("../authentication");
const { Router } = require("express");

const router = Router();

// Main dashboard route
router.get("/", (req, res) => {
  if (!req.user) {
    return res.status(401).redirect("/signin");
  } else {
    const username = req.user.username;
    const msg = req.session.msg;
    const type = req.session.type;
    const role = req.user.role;
    req.session.msg = null;
    req.session.type = null;
    return res.status(200).render("home", { role, username, msg, type });
  }
});

// Signin page route
router.get("/signin", (req, res) => {
  const msg = req.session.msg;
  const type = req.session.type;
  req.session.msg = null;
  req.session.type = null;
  return res.status(200).render("signin", { msg, type });
});

// Signup page route
router.get("/signup", (req, res) => {
  const msg = req.session.msg;
  const type = req.session.type;
  req.session.msg = null;
  req.session.type = null;
  return res.status(200).render("signup", { msg, type });
});


// Logout route
router.get("/logout", (req, res) => {
  res.clearCookie("token").status(200).redirect("/");
});

// Signup route
router.post("/signup", async (req, res) => {
  const body = req.body;
  if (!body.email) {
    req.session.msg = "Please enter a valid email";
    req.session.type = "error";
    return res.status(400).redirect("/signup");
  } else if (!body.username) {
    req.session.msg = "Please enter a username";
    req.session.type = "error";
    return res.status(400).redirect("/signup");
  } else if (!body.password) {
    req.session.msg = "Please enter a password";
    req.session.type = "error";
    return res.status(400).redirect("/signup");
  }
  try {
    // Check if username or email is already taken
    const checkQuery = "SELECT * FROM users WHERE username = ? OR email = ?";
    const [existingUsers] = await promisePool.query(checkQuery, [
      body.username,
      body.email,
    ]);

    if (existingUsers.length > 0) {
      req.session.msg = "Username or email already in use";
      req.session.type = "error";
      return res.status(409).redirect("/signup");
    }

    // Check if there are any existing users
    const countQuery = "SELECT COUNT(*) AS userCount FROM users";
    const [countResult] = await promisePool.query(countQuery);
    const userCount = countResult[0].userCount;

    // Determine the role for the new user
    const role = userCount === 0 ? "admin" : "client";

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
      role,
      salt,
    ]);

    req.session.msg = "User created successfully! You can login now";
    req.session.type = "success";
    return res.status(201).redirect("/signin");
  } catch (error) {
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.status(500).redirect("/signup");
  }
});

// Signin route
router.post("/signin", async (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    req.session.msg = "Please enter a valid email";
    req.session.type = "error";
    return res.status(400).redirect("/signin");
  } else if (!password) {
    req.session.msg = "Please enter a password";
    req.session.type = "error";
    return res.status(400).redirect("/signin");
  }
  const query = "SELECT * FROM `users` WHERE `email` = ?";

  try {
    const [rows, fields] = await promisePool.query(query, [email]);
    const user = rows[0];
    if (!user) {
      req.session.msg = "User not found";
      req.session.type = "error";
      return res.status(404).redirect("/signin");
    }

    const salt = user.salt;
    const hashedPassword = user.password;
    const userProvidedHash = createHmac("sha256", salt)
      .update(password)
      .digest("hex");

    if (hashedPassword !== userProvidedHash) {
      req.session.msg = "Incorrect Password";
      req.session.type = "error";
      return res.status(401).redirect("/signin");
    }

    const token = createTokenForUser(user);
    return res.status(200).cookie("token", token).redirect("/");
  } catch (err) {
    req.session.msg = "Internal Server Error";
    req.session.type = "error";
    return res.status(500).redirect("/signin");
  }
});

module.exports = router;
