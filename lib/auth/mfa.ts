import * as OTPAuth from "otpauth";

const issuer = "Trợ lý phản hồi";

export function createTotp(label: string, secret?: OTPAuth.Secret) {
  return new OTPAuth.TOTP({
    issuer,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: secret ?? new OTPAuth.Secret({ size: 20 }),
  });
}

export function createTotpSecret() {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function verifyTotp(secret: string, code: string) {
  const totp = createTotp("user", OTPAuth.Secret.fromBase32(secret));
  const delta = totp.validate({ token: code, window: 1 });
  return delta === null ? null : totp.counter() + delta;
}

export function enrollmentUri(label: string, secret: string) {
  return createTotp(label, OTPAuth.Secret.fromBase32(secret)).toString();
}
