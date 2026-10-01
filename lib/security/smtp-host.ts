import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import net from "node:net";
import type { Socket } from "node:net";

type ResolvedSmtpHost = { address: string; family: 4 | 6 };

function smtpHostError() { return new Error("SMTP_UNSAFE_HOST"); }

export function normalizeSmtpHost(input: string) {
  const host = input.trim().toLowerCase().replace(/\.$/, "");
  if (!host || host.length > 253 || isIP(host) || host === "localhost" || host === "smtp.google.com" || host.endsWith(".local") || host.endsWith(".localhost") || host.endsWith(".test") || host.endsWith(".invalid")) throw smtpHostError();
  return host;
}

function unsafeIpv4(address: string) {
  const parts = address.split(".").map(Number);
  const [a, b] = parts;
  return parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
    || a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 0 || b === 168))
    || (a === 198 && (b === 18 || b === 19));
}

function unsafeIpv6(address: string) {
  const value = address.toLowerCase();
  if (value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb") || value.startsWith("ff")) return true;
  const mappedV4 = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return Boolean(mappedV4 && unsafeIpv4(mappedV4));
}

function unsafeAddress(address: string, family: number) {
  return family === 4 ? unsafeIpv4(address) : family === 6 ? unsafeIpv6(address) : true;
}

export async function resolveSafeSmtpHost(input: string): Promise<ResolvedSmtpHost> {
  const host = normalizeSmtpHost(input);
  const addresses = await lookup(host, { all: true, verbatim: true });
  const usable = addresses.find((entry) => !unsafeAddress(entry.address, entry.family));
  if (!usable) throw smtpHostError();
  return { address: usable.address, family: usable.family as 4 | 6 };
}

export async function assertSafeSmtpHost(input: string) {
  normalizeSmtpHost(input);
  await resolveSafeSmtpHost(input);
}

export function connectSafeSmtpSocket(host: string, port: number, timeoutMs: number) {
  return new Promise<Socket>((resolve, reject) => {
    let socket: Socket | undefined;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (error) {
        socket?.destroy();
        reject(error);
      } else if (socket) resolve(socket);
    };
    void resolveSafeSmtpHost(host).then(({ address, family }) => {
      socket = net.connect({ host: address, port, family });
      socket.setTimeout(timeoutMs, () => finish(new Error("SMTP_CONNECTION_TIMEOUT")));
      socket.once("error", finish);
      socket.once("connect", () => {
        socket?.setTimeout(0);
        socket?.removeListener("error", finish);
        finish();
      });
    }, (error: unknown) => finish(error instanceof Error ? error : smtpHostError()));
  });
}
