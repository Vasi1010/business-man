/** Group digits Indian style: 150000 -> "1,50,000". */
export function groupIndian(n: number): string {
  const digits = Math.trunc(Math.abs(n)).toString()
  if (digits.length <= 3) return digits
  const last3 = digits.slice(-3)
  const rest = digits.slice(0, -3)
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3
}

/** Format rupees Indian style: 150000 -> "₹1,50,000", -500 -> "-₹500". */
export function formatMoney(n: number): string {
  return (n < 0 ? '-' : '') + '₹' + groupIndian(n)
}
