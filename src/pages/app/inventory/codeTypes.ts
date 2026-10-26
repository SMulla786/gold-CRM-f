// TASK-98: label code types (Barcode / QR / RFID) shared by the inventory pages. Values are i18n keys, translated at render.
import { STOCK_CODE_TYPES, type StockCodeType } from '@/shared'

export const CODE_TYPE_LABEL: Record<StockCodeType, string> = { BARCODE: 'inv.editor.type_barcode', QR: 'inv.editor.type_qr', RFID: 'inv.code.rfid' }
export const CODE_TYPES = STOCK_CODE_TYPES

/** Same rule as the contract's epcCode: 8-64 hex characters (input is upper-cased before checking). */
export const isEpc = (s: string) => /^[0-9A-F]{8,64}$/.test(s.trim().toUpperCase())
