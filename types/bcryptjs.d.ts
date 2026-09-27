declare module "bcryptjs" {
  export function hash(value: string, saltOrRounds: string | number): Promise<string>;
  export function compare(value: string, hash: string): Promise<boolean>;
}
