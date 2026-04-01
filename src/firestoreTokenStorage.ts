import { Firestore } from '@google-cloud/firestore';
import type { TokenStorage } from 'fastmcp/auth';

const COLLECTION = 'mcp-oauth-tokens';

/**
 * Firestore-backed TokenStorage for FastMCP's OAuth proxy.
 * Tokens survive container restarts and redeployments.
 * On Cloud Run, authentication is automatic via the service account.
 */
export class FirestoreTokenStorage implements TokenStorage {
  private db: Firestore;

  constructor(projectId?: string) {
    this.db = new Firestore({ projectId });
  }

  // #region agent log
  async save(key: string, value: unknown, _ttl?: number): Promise<void> {
    const encodedKey = encodeKey(key);
    const valueType = typeof value === 'string' ? `string(${value.length})` : typeof value;
    try {
      const doc = this.db.collection(COLLECTION).doc(encodedKey);
      await doc.set({ value, createdAt: Date.now() });
      console.error(
        `[DBG-326455] SAVE key=${key.slice(0, 40)} encoded=${encodedKey.slice(0, 40)} valueType=${valueType} OK`
      );
    } catch (err: any) {
      console.error(`[DBG-326455] SAVE key=${key.slice(0, 40)} FAILED: ${err.message}`);
      throw err;
    }
  }
  // #endregion

  // #region agent log
  async get(key: string): Promise<unknown | null> {
    const encodedKey = encodeKey(key);
    try {
      const doc = await this.db.collection(COLLECTION).doc(encodedKey).get();
      if (!doc.exists) {
        console.error(
          `[DBG-326455] GET key=${key.slice(0, 40)} encoded=${encodedKey.slice(0, 40)} NOT_FOUND`
        );
        return null;
      }
      const data = doc.data()!;
      const val = data.value;
      const valType = typeof val === 'string' ? `string(${val.length})` : typeof val;
      console.error(
        `[DBG-326455] GET key=${key.slice(0, 40)} encoded=${encodedKey.slice(0, 40)} FOUND valueType=${valType}`
      );
      return val;
    } catch (err: any) {
      console.error(`[DBG-326455] GET key=${key.slice(0, 40)} ERROR: ${err.message}`);
      throw err;
    }
  }
  // #endregion

  // #region agent log
  async delete(key: string): Promise<void> {
    try {
      await this.db.collection(COLLECTION).doc(encodeKey(key)).delete();
      console.error(`[DBG-326455] DELETE key=${key.slice(0, 40)} OK`);
    } catch (err: any) {
      console.error(`[DBG-326455] DELETE key=${key.slice(0, 40)} FAILED: ${err.message}`);
      throw err;
    }
  }
  // #endregion

  async cleanup(): Promise<void> {
    // FastMCP handles token expiry internally via delete() calls.
  }
}

function encodeKey(key: string): string {
  return key.replace(/\//g, '__');
}
