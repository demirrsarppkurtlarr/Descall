const { verifyToken } = require("../config/jwt");

function requireAuth(req, res, next) {
  console.log("[AUTH-MW] Checking auth for:", req.method, req.path);
  
  const authHeader = req.headers.authorization;
  console.log("[AUTH-MW] Auth header present:", !!authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("[AUTH-MW] REJECTED: Missing or malformed Authorization header");
    return res.status(401).json({ error: "Missing or malformed Authorization header." });
  }

  const token = authHeader.slice(7);
  console.log("[AUTH-MW] Token extracted, length:", token?.length);

  try {
    const decoded = verifyToken(token);
    console.log("[AUTH-MW] Token decoded:", { id: decoded?.sub, username: decoded?.username });
    req.user = { id: decoded.sub, username: decoded.username };
    console.log("[AUTH-MW] ACCEPTED - proceeding to route handler");
    next();
  } catch (err) {
    console.error("[AUTH-MW] Token verification failed:", err.name, err.message);
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired." });
    }
    return res.status(401).json({ error: "Invalid token." });
  }
}

module.exports = { requireAuth };
