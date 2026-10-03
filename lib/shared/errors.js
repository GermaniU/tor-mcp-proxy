// Errors that must never be retried: the input itself is the problem, so a
// different Tor circuit would produce the same outcome.

// Bad URL, forbidden destination, too many redirects, unsafe output path...
export class RequestValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "RequestValidationError";
  }
}

export class ResponseBodyTooLargeError extends Error {
  constructor(maxBytes) {
    super(`Response body exceeds the ${maxBytes.toLocaleString("en-US")} byte limit.`);
    this.name = "ResponseBodyTooLargeError";
    this.maxBytes = maxBytes;
  }
}
