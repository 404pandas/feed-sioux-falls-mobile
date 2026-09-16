// Wraps an async route handler so a rejected promise is forwarded to
// Express's error-handling middleware via next(err) instead of becoming an
// unhandled rejection. Express 4 doesn't catch async errors on its own, and
// an unhandled rejection crashes the whole Node process (default since
// Node 15) - so every async handler in this app should be wrapped with this.
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
