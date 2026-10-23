import type { AbiInput } from './types/member2'

/** Validation preserves decimal integers as strings, including full uint256 values. */
export function parameterError(
  input: AbiInput,
  raw: string
): string | undefined {
  const array = /^(.*)\[(\d*)\]$/.exec(input.type)
  if (array) {
    let values: unknown
    try {
      values = JSON.parse(raw)
    } catch {
      return 'Enter a JSON array.'
    }
    if (!Array.isArray(values)) return 'Enter a JSON array.'
    if (array[2] && values.length !== Number(array[2]))
      return `Enter exactly ${array[2]} items.`
    for (const item of values) {
      if (typeof item === 'number' && !Number.isSafeInteger(item))
        return 'Quote large integers to preserve their precision.'
      const error = parameterError(
        { ...input, type: array[1] },
        typeof item === 'object' ? JSON.stringify(item) : String(item)
      )
      if (error) return error
    }
    return
  }
  if (input.type === 'address')
    return /^0x[\da-f]{40}$/i.test(raw)
      ? undefined
      : 'Enter a valid 42-character Ethereum address.'
  if (input.type === 'bool')
    return /^(true|false)$/.test(raw) ? undefined : 'Enter true or false.'
  const integer = /^(u?int)(\d*)$/.exec(input.type)
  if (integer) {
    const bits = Number(integer[2] || 256)
    if (bits < 8 || bits > 256 || bits % 8) return 'Unsupported integer type.'
    if (!/^-?(0|[1-9]\d*)$/.test(raw)) return 'Enter a whole decimal integer.'
    const value = BigInt(raw),
      unsigned = integer[1] === 'uint'
    const minimum = unsigned ? 0n : -(1n << BigInt(bits - 1))
    const maximum = (1n << BigInt(unsigned ? bits : bits - 1)) - 1n
    return value < minimum || value > maximum
      ? `Value must be between ${minimum} and ${maximum}.`
      : undefined
  }
  const bytes = /^bytes(\d*)$/.exec(input.type)
  if (bytes) {
    const size = bytes[1] ? Number(bytes[1]) : undefined
    return !/^0x([\da-f]{2})*$/i.test(raw) ||
      (size && (size > 32 || raw.length !== 2 + size * 2))
      ? `Enter ${size ? `${size} bytes of` : 'even-length'} hexadecimal data beginning with 0x.`
      : undefined
  }
  if (input.type === 'string') return
  return `The ${input.type} ABI type is not supported for deployment yet.`
}

export function validateParameters(
  inputs: AbiInput[],
  values: string[]
): Record<number, string> {
  const errors: Record<number, string> = {}
  inputs.forEach((input, i) => {
    const error = parameterError(input, values[i] ?? '')
    if (error) errors[i] = error
  })
  return errors
}
