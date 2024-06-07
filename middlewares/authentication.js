const { validateToken } = require("../authentication");

function checkForAuthenticationCookie(cookieName) {
  return (req, res, next) => {
    const tokenCookieValue = req.cookies[cookieName];
    if (!tokenCookieValue) {
      return next();
    }

    try {
      const userPayload = validateToken(tokenCookieValue);
      req.user = userPayload;
    } catch (error) {}

    return next();
  };
}

function checkAuthorization() {
  return (req, res, next) => {
    const role = req.user.role;
    if (role=="client") {
      return res.redirect("/");
    }
    else {
      return next();
    }
  };
}

module.exports = {
  checkForAuthenticationCookie,
  checkAuthorization
};