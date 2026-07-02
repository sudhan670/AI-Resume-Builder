const env = require("../config/env");
const ApiError = require("../utils/ApiError");

function notFound(req, res, next) {
  next(ApiError.notFound(`Route ${req.originalUrl} not found`));
}

function errorHandler(err, req, res, next) {
  let status = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let details = err.details;

  // different version type error handler using this process
  if (err.name === "ValidationError" && err.errors) {
    status = 400;
    message = "Validation failed";

    details = Object.fromEntries(
      Object.entries(err.errors).map(([key, value]) => [
        key,
        value.message,
      ])
    );
  } else if (err.name === "CastError") {
    status = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  } else if (err.code === 11000) {
    status = 409;
    message = "Duplicate key error";
  } else if (err.name === "ZodError") {
    status = 400;
    message = "Zod validation failed";
    details = err.issues;
  }

  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
  }

  // always default error handler
  res.status(status).json({
    error: {
      message,
      ...(details ? { details } : {}),
      ...(env.isProd ? {} : { stack: err.stack }),
    },
  });
}

module.exports = {
  notFound,
  errorHandler,
};