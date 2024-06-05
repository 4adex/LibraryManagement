const { createHmac, randomBytes } = require("crypto");
const promisePool = require("../config/database");
const { createTokenForUser, validateToken } = require("../authentication");

async function createNewUser(user, res) {
  // creating the salt and hashing the password
  try {
    const salt = randomBytes(16).toString("hex");
    const hashedPassword = createHmac("sha256", salt)
      .update(user.password)
      .digest("hex");
    const query = `
    INSERT INTO users (username, password, email, role, salt)
    VALUES (?, ?, ?, ?, ?)
  `;
    const [rows, fields] = await promisePool.query(query, [
      user.username,
      hashedPassword,
      user.email,
      user.role,
      salt,
    ]);
    // console.log(rows);
    return res.json({status: "User created successfully!"});

  } catch (error) {
    return res.json({status: "Error"});
  }
}

async function matchPasswordAndGenerateToken(email, password) {
  const query = "SELECT * FROM `users` WHERE `email` = ?";

  try {
    const [rows, fields] = await promisePool.query(query, [email]);
    const user = rows[0];

    if (!user) {
      throw new Error("User not found");
    }
    // console.log(user);
    const salt = user.salt;
    const hashedPassword = user.password;

    const userProvidedHash = createHmac("sha256", salt)
      .update(password)
      .digest("hex");

    if (hashedPassword !== userProvidedHash) {
      throw new Error("Incorrect Password");
    }

    const token = createTokenForUser(user);
    return token;
  } catch (err) {
    throw err;
  }
}

module.exports = { createNewUser, matchPasswordAndGenerateToken };
