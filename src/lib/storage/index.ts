import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { AwsClient } from "aws4fetch";
import { env } from "@/lib/env";
import { randomToken } from "@/lib/security/crypto";

export interface StorageDriver {
  readonly name: string;
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9/_.-]{0,500}$/;

function assertSafeKey(key: string): void {
  if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error("Invalid storage key");
}

/** S3-compatible object storage (Cloudflare R2 by default), signed with AWS SigV4. */
class S3Driver implements StorageDriver {
  readonly name = "s3";
  private readonly client: AwsClient;

  constructor(
    private readonly endpoint: string,
    private readonly bucket: string,
    accessKeyId: string,
    secretAccessKey: string,
    region: string,
  ) {
    this.client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region });
  }

  private url(key: string): string {
    return `${this.endpoint.replace(/\/+$/, "")}/${this.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    assertSafeKey(key);
    const response = await this.client.fetch(this.url(key), {
      method: "PUT",
      body: body as unknown as BodyInit,
      headers: { "content-type": contentType },
    });
    if (!response.ok) throw new Error(`Object storage PUT failed (${response.status})`);
  }

  async get(key: string): Promise<Uint8Array> {
    assertSafeKey(key);
    const response = await this.client.fetch(this.url(key));
    if (!response.ok) throw new Error(`Object storage GET failed (${response.status})`);
    return new Uint8Array(await response.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    const response = await this.client.fetch(this.url(key), { method: "DELETE" });
    if (!response.ok && response.status !== 404) throw new Error(`Object storage DELETE failed (${response.status})`);
  }
}

/** Development/test only: files under ./.data/storage. Refuses to run in production. */
class LocalDriver implements StorageDriver {
  readonly name = "local";
  private readonly root = path.join(process.cwd(), ".data", "storage");

  private resolve(key: string): string {
    assertSafeKey(key);
    if (env().NODE_ENV === "production") throw new Error("Object storage is not configured (OBJECT_STORAGE_* missing).");
    return path.join(this.root, ...key.split("/"));
  }

  async put(key: string, body: Uint8Array): Promise<void> {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }

  async get(key: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(this.resolve(key)));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

let driver: StorageDriver | undefined;

export function storage(): StorageDriver {
  if (!driver) {
    const config = env();
    driver =
      config.OBJECT_STORAGE_ENDPOINT && config.OBJECT_STORAGE_BUCKET && config.OBJECT_STORAGE_ACCESS_KEY && config.OBJECT_STORAGE_SECRET_KEY
        ? new S3Driver(
            config.OBJECT_STORAGE_ENDPOINT,
            config.OBJECT_STORAGE_BUCKET,
            config.OBJECT_STORAGE_ACCESS_KEY,
            config.OBJECT_STORAGE_SECRET_KEY,
            config.OBJECT_STORAGE_REGION,
          )
        : new LocalDriver();
  }
  return driver;
}

/** Tenant-prefixed, collision-free object key: "<businessId>/<kind>/<random>-<safe-name>". */
export function buildObjectKey(businessId: string, kind: string, fileName: string): string {
  const safeName =
    fileName
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/\.{2,}/g, ".")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(-80) || "file";
  const random = randomToken(9).replace(/[^A-Za-z0-9]/g, "x");
  return `${businessId}/${kind}/${random}-${safeName}`;
}
