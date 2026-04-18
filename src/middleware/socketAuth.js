const { verifyToken } = require("../config/jwt");
const { bannedUserIds } = require("../runtime/sharedState");

/**
 * Socket.io middleware that validates a JWT token on every connection attempt.
 *
 * Clients must pass the token in the socket handshake:
 *   const socket = io("http://localhost:3000", {
 *     auth: { token: "<jwt>" }
 *   });
 *
 * The decoded user payload is attached to socket.user for use in event handlers.
 */
function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("Authentication required: no token provided."));
  }

  try {
    const decoded = verifyToken(token);
    if (bannedUserIds.has(decoded.sub)) {
      return next(new Error("Authentication failed: account is banned."));
    }
    socket.user = { id: decoded.sub, username: decoded.username };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new Error("Authentication failed: token has expired."));
    }
    return next(new Error("Authentication failed: invalid token."));
  }
}

module.exports = { socketAuthMiddleware };
