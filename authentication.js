const JWT = require("jsonwebtoken");

const secret = "hawkeye";

function createTokenForUser(user) {
  const payload = {
    email: user.email,
    username: user.username,
    role: user.role,
    id: user.id,
  };
  const token = JWT.sign(payload, secret);
  return token;
}

function validateToken(token) {
  const payload = JWT.verify(token, secret);
  return payload;
}

module.exports = {
  createTokenForUser,
  validateToken,
};
