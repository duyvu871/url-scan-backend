const express = require("express");
/**
 * Class for handling async middleware in Express.
 */
class AsyncMiddleware {
    /**
     * Wraps an async middleware function for error handling.
     * @param {function(express.Request, express.Response, express.NextFunction): Promise<void>} fn - The async middleware function.
     * @returns {function(express.Request, express.Response, express.NextFunction): void} - The wrapped middleware function.
     */
    static asyncHandler(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }
}

module.exports = AsyncMiddleware;