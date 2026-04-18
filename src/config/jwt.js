const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET in environment variables.");
}

/**
 * Sign a JWT for a given user payload.
 * @param {{ id: string, username: string }} payload
 * @returns {string} signed token
 */
function signToken(payload) {
  return jwt.sign(
    { sub: payload.id, username: payload.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify and decode a JWT.
 * Throws if the token is invalid or expired.
 * @param {string} token
 * @returns {{ sub: string, username: string, iat: number, exp: number }}
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { signToken, verifyToken };
