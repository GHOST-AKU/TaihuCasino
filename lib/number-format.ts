const wholeNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
})

const decimalNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
})

const wholeUsdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

const decimalUsdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
})

const shortTimeFormatter = new Intl.DateTimeFormat("en", {
  hour: "2-digit",
  minute: "2-digit",
})

export function formatAmount(value: number) {
  return (Number.isInteger(value) ? wholeNumberFormatter : decimalNumberFormatter).format(value)
}

export function formatUsd(value: number) {
  return (Number.isInteger(value) ? wholeUsdFormatter : decimalUsdFormatter).format(value)
}

export function formatShortTime(value: string) {
  return shortTimeFormatter.format(new Date(value))
}
