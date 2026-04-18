const { verifyToken } = require("../config/jwt");

/**
 * Express middleware that validates the Authorization: Bearer <token> header.
 * Attaches the decoded payload to req.user on success.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header." });
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const decoded = verifyToken(token);
    req.user = { id: decoded.sub, username: decoded.username };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired." });
    }
    return res.status(401).json({ error: "Invalid token." });
  }
}

module.exports = { requireAuth };
