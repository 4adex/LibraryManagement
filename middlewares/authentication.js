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
    } catch (error) {
      req.user = null;
      req.session.msg = "Could not authenticate, login again.";
      req.session.type = "error";
      res.clearCookie(cookieName);
      return res.redirect("/login");
    }

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