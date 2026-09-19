import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface AccessSettings {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  OWNER_EMAIL?: string;
}

let cachedIssuer: string | undefined;
let cachedKeys: ReturnType<typeof createRemoteJWKSet> | undefined;

export async function verifyOwner(
  request: Request,
  settings: AccessSettings,
  testKeys?: JWTVerifyGetKey
): Promise<boolean> {
  const issuer = settings.ACCESS_TEAM_DOMAIN;
  const audience = settings.ACCESS_AUD;
  const owner = settings.OWNER_EMAIL;
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (
    !issuer ||
    !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer) ||
    !audience ||
    !owner ||
    !token ||
    token.length > 16384
  )
    return false;
  try {
    if (cachedIssuer !== issuer || !cachedKeys) {
      cachedIssuer = issuer;
      cachedKeys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), {
        timeoutDuration: 3000,
      });
    }
    const { payload } = await jwtVerify(token, testKeys ?? cachedKeys, {
      issuer,
      audience,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "email"],
    });
    return typeof payload.email === "string" && payload.email.toLowerCase() === owner.toLowerCase();
  } catch {
    return false;
  }
}
