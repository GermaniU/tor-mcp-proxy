// Preload (--import) for entrypoint tests: makes `node:tls` expose a root
// store that still contains "emSign ECC Root CA - G3" (public certificate,
// as bundled by unpatched Node.js 22.23.2), so index.js must refuse to start
// even on a patched Node.js version. Test-only; never shipped.
import { registerHooks } from "node:module";

const EMSIGN_ECC_ROOT_G3 = `-----BEGIN CERTIFICATE-----
MIICTjCCAdOgAwIBAgIKPPYHqWhwDtqLhDAKBggqhkjOPQQDAzBrMQswCQYDVQQGEwJJTjET
MBEGA1UECxMKZW1TaWduIFBLSTElMCMGA1UEChMcZU11ZGhyYSBUZWNobm9sb2dpZXMgTGlt
aXRlZDEgMB4GA1UEAxMXZW1TaWduIEVDQyBSb290IENBIC0gRzMwHhcNMTgwMjE4MTgzMDAw
WhcNNDMwMjE4MTgzMDAwWjBrMQswCQYDVQQGEwJJTjETMBEGA1UECxMKZW1TaWduIFBLSTEl
MCMGA1UEChMcZU11ZGhyYSBUZWNobm9sb2dpZXMgTGltaXRlZDEgMB4GA1UEAxMXZW1TaWdu
IEVDQyBSb290IENBIC0gRzMwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAAQjpQy4LRL1KPOxst3i
AhKAnjlfSU2fySU0WXTsuwYc58Byr+iuL+FBVIcUqEqy6HyC5ltqtdyzdc6LBtCGI79G1Y4P
PwT01xySfvalY8L1X44uT6EYGQIrMgqCZH0Wk9GjQjBAMB0GA1UdDgQWBBR8XQKEE9TMipuB
zhccLikenEhjQjAOBgNVHQ8BAf8EBAMCAQYwDwYDVR0TAQH/BAUwAwEB/zAKBggqhkjOPQQD
AwNpADBmAjEAvvNhzwIQHWSVB7gYboiFBS+DCBeQyh+KTOgNG3qxrdWBCUfvO6wIBHxcmbHt
RwfSAjEAnbpV/KlK6O3t5nYBQnvI+GDZjVGLVTv7jHvrZQnD+JbNR6iC8hZVdyR+EhCVBCyj
-----END CERTIFICATE-----`;

const FAKE_TLS =
  "data:text/javascript," +
  encodeURIComponent(
    'import tls from "node:tls"; export * from "node:tls"; export default tls; ' +
      `export const rootCertificates = Object.freeze([...tls.rootCertificates, ${JSON.stringify(EMSIGN_ECC_ROOT_G3)}]);`
  );

registerHooks({
  resolve(specifier, context, nextResolve) {
    const fromFake = context.parentURL?.startsWith("data:");
    if ((specifier === "node:tls" || specifier === "tls") && !fromFake) return { url: FAKE_TLS, shortCircuit: true };
    return nextResolve(specifier, context);
  }
});
