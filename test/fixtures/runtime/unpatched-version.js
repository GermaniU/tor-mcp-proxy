// Preload (--import) for entrypoint tests: reports an unpatched Node.js
// version so index.js must refuse to start. Test-only; never shipped.
Object.defineProperty(process, "versions", { value: Object.freeze({ ...process.versions, node: "24.21.0" }) });
