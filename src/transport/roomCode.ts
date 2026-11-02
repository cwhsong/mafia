// Letters only, with look-alikes removed (no I, L, O) so codes are easy to read aloud.
export const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ'
export const CODE_LENGTH = 6

const CODE_PATTERN = new RegExp(`^[${CODE_LETTERS}]{${CODE_LENGTH}}$`)

// A new random room code like 'KXQRTZ'.
export function generateRoomCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_LETTERS[Math.floor(random() * CODE_LETTERS.length)]
  }
  return code
}

// Cleans up what someone typed: ' kxq-rtz ' → 'KXQRTZ'
export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '')
}

export function isValidRoomCode(code: string): boolean {
  return CODE_PATTERN.test(code)
}

// Reads a code from a join link's hash: '#kxqrtz' → 'KXQRTZ', anything else → null
export function codeFromHash(hash: string): string | null {
  const code = normalizeRoomCode(hash.replace(/^#/, ''))
  return isValidRoomCode(code) ? code : null
}