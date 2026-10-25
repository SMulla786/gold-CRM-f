// Indian-numbering amount in words (crore/lakh/thousand) for printed invoices.
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function below100(n: number): string {
  if (n < 20) return ONES[n]
  return (TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '')).trim()
}
function below1000(n: number): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  return [h ? ONES[h] + ' Hundred' : '', r ? below100(r) : ''].filter(Boolean).join(' ')
}

function intInWords(n: number): string {
  if (n === 0) return 'Zero'
  const crore = Math.floor(n / 10000000); n %= 10000000
  const lakh = Math.floor(n / 100000); n %= 100000
  const thousand = Math.floor(n / 1000); n %= 1000
  return [
    crore ? below1000(crore) + ' Crore' : '',
    lakh ? below100(lakh) + ' Lakh' : '',
    thousand ? below100(thousand) + ' Thousand' : '',
    n ? below1000(n) : '',
  ].filter(Boolean).join(' ')
}

/** "₹4,500.50" → "Four Thousand Five Hundred Rupees and Fifty Paise Only" */
export function amountInWords(amount: number | string): string {
  const cents = Math.round(Math.abs(Number(amount) || 0) * 100)
  const rupees = Math.floor(cents / 100)
  const paise = cents % 100
  const words = intInWords(rupees) + ' Rupees' + (paise ? ' and ' + below100(paise) + ' Paise' : '')
  return words + ' Only'
}
