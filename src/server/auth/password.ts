import "server-only";
import bcrypt from "bcryptjs";

const ROUNDS = 11;
// A real hash of a random string, so unknown-email logins take the same time as wrong passwords.
const DUMMY_HASH = "$2b$11$C6UzMDM.H6dfI/f/IKcEeO5lXn7sF0bHk7m8VnZtQkqv1yJm6bUoW";

export const hashPassword = (plain: string) => bcrypt.hash(plain, ROUNDS);

export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash ?? DUMMY_HASH);
  } catch {
    return false;
  }
}
