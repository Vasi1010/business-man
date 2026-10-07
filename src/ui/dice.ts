/** Two fair dice from the browser's crypto RNG. */
export function rollDice(): [number, number] {
  const buf = new Uint32Array(2)
  crypto.getRandomValues(buf)
  return [1 + (buf[0] % 6), 1 + (buf[1] % 6)]
}
