import JsBarcode from 'jsbarcode'
import { useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

import { AuthedImage } from '@/components/AuthedImage'
import { QrImage } from '@/components/QrImage'
import type { StockItemDto, TagElement, TagField, TagTemplateDto } from '@/shared'

/** Template fields a label can print, from a stock item (+ the shop name). */
function fieldValue(field: TagField | undefined, item: StockItemDto, shopName: string): string {
  switch (field) {
    case 'huid': return item.huid ?? ''
    case 'itemName': return item.itemName.name
    case 'karat': return item.karatCode ?? ''
    case 'gross': return `${item.gross}g`
    case 'net': return `${item.net}g`
    case 'fine': return `${item.fine}g`
    case 'rate': return item.rate ?? ''
    case 'shopName': return shopName
    case 'epcCode': return item.epcCode ?? ''
    default: return item.tagNo ?? ''
  }
}

/** CODE128 barcode stretched to fill its element box (no human-readable text; add a field element for that). */
function FillBarcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current || !value) return
    JsBarcode(ref.current, value, { format: 'CODE128', displayValue: false, margin: 0, height: 40, width: 1 })
    ref.current.setAttribute('preserveAspectRatio', 'none')
  }, [value])
  return <svg ref={ref} style={{ width: '100%', height: '100%' }} />
}

/** Editor-only hooks (selection outline, drag/resize). Omitted when printing, so print output is unchanged. */
export interface TagLabelEdit {
  selectedId: string | null
  /** on-screen size of the resize handle, in label mm */
  handleMm: number
  onPointerDown: (e: ReactPointerEvent, el: TagElement, mode: 'move' | 'resize') => void
}

function Element({ el, item, shopName, edit }: { el: TagElement; item: StockItemDto; shopName: string; edit?: TagLabelEdit }) {
  const selected = edit?.selectedId === el.id
  const style: CSSProperties = {
    position: 'absolute',
    left: `${el.x}mm`,
    top: `${el.y}mm`,
    width: `${el.w}mm`,
    height: `${el.h}mm`,
    transform: el.angle ? `rotate(${el.angle}deg)` : undefined,
    opacity: el.opacity ?? 1,
    color: el.colour ?? '#000000',
    fontSize: `${el.fontSize ?? 6}pt`,
    fontWeight: el.bold ? 700 : 400,
    lineHeight: 1.1,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    ...(edit && {
      cursor: 'move',
      touchAction: 'none',
      userSelect: 'none',
      // Drawn inside the box so the label's overflow:hidden never clips it.
      outline: selected ? `${edit.handleMm / 4}mm solid #2563eb` : `${edit.handleMm / 8}mm dashed rgba(0,0,0,0.3)`,
      outlineOffset: `-${selected ? edit.handleMm / 4 : edit.handleMm / 8}mm`,
    }),
  }
  let content: ReactNode
  if (el.type === 'barcode') content = <FillBarcode value={fieldValue(el.field ?? 'tagNo', item, shopName)} />
  // QR is square: the smaller side of the element box, mm → CSS px (96 dpi), like the barcode fills its mm box.
  else if (el.type === 'qr') {
    const value = fieldValue(el.field ?? 'tagNo', item, shopName)
    content = value && <QrImage text={value} size={Math.max(8, Math.round((Math.min(el.w, el.h) * 96) / 25.4))} />
  }
  // shortcut: each image element fetches the logo blob itself; share one object URL if sheets get large.
  else if (el.type === 'image') content = <AuthedImage path="/app/files/invoice/logo" alt="Shop logo" className="h-full w-full object-contain" />
  else content = el.type === 'text' ? (el.text ?? '') : fieldValue(el.field, item, shopName)
  return (
    <div
      style={style}
      onPointerDown={edit && ((e) => edit.onPointerDown(e, el, 'move'))}
      onDragStart={edit && ((e) => e.preventDefault())}
    >
      {content}
      {edit && selected && (
        <div
          aria-hidden
          className="absolute bottom-0 right-0 bg-blue-600"
          style={{ width: `${edit.handleMm}mm`, height: `${edit.handleMm}mm`, cursor: 'nwse-resize' }}
          onPointerDown={(e) => { e.stopPropagation(); edit.onPointerDown(e, el, 'resize') }}
        />
      )}
    </div>
  )
}

/**
 * One label drawn from a template in real mm. VERTICAL rotates the whole design 90° (outer box swaps W × H).
 * BUTTERFLY marks the fold neck in the middle on screen only.
 */
export function TagLabel({ template, item, shopName, edit }: { template: Pick<TagTemplateDto, 'widthMm' | 'heightMm' | 'shape' | 'direction' | 'neckWidthMm' | 'elements'>; item: StockItemDto; shopName: string; edit?: TagLabelEdit }) {
  const { widthMm: w, heightMm: h } = template
  const vertical = template.direction === 'VERTICAL'
  const neck = template.shape === 'BUTTERFLY' ? (template.neckWidthMm ?? 0) : 0
  return (
    <div
      className="relative overflow-hidden border border-black/40 bg-white text-black"
      style={{ width: `${vertical ? h : w}mm`, height: `${vertical ? w : h}mm`, borderRadius: template.shape === 'ROUNDED' ? '2mm' : template.shape === 'BUTTERFLY' ? '3mm' : 0 }}
    >
      <div className="absolute left-0 top-0" style={{ width: `${w}mm`, height: `${h}mm`, transform: vertical ? `translateX(${h}mm) rotate(90deg)` : undefined, transformOrigin: 'top left' }}>
        {neck > 0 && <div aria-hidden className="absolute top-0 h-full border-x border-dashed border-black/30 print:hidden" style={{ left: `${(w - neck) / 2}mm`, width: `${neck}mm` }} />}
        {template.elements.map((el) => <Element key={el.id} el={el} item={item} shopName={shopName} edit={edit} />)}
      </div>
    </div>
  )
}
