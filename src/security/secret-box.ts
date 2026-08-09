import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export class SecretBox {
  readonly #key: Buffer;

  constructor(masterKey: string) {
    this.#key = createHash('sha256').update(masterKey, 'utf8').digest();
  }

  encrypt(value: unknown): string {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.#key, nonce);
    const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([Buffer.from([1]), nonce, tag, encrypted]).toString('base64url');
  }

  decrypt(value: string): unknown {
    const payload = Buffer.from(value, 'base64url');
    if (payload[0] !== 1 || payload.length < 30) throw new Error('Invalid encrypted payload');
    const nonce = payload.subarray(1, 13);
    const tag = payload.subarray(13, 29);
    const encrypted = payload.subarray(29);
    const decipher = createDecipheriv('aes-256-gcm', this.#key, nonce);
    decipher.setAuthTag(tag);
    return JSON.parse(
      Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'),
    );
  }
}
