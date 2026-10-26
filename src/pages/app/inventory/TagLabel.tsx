import JsBarcode from 'jsbarcode'
import { useEffect, useRef, type CSSProperties } from 'react'

import { AuthedImage } from '@/components/AuthedImage'
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

function Element({ el, item, shopName }: { el: TagElement; item: StockItemDto; shopName: string }) {
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
  }
  if (el.type === 'barcode') return <div style={style}><FillBarcode value={fieldValue(el.field ?? 'tagNo', item, shopName)} /></div>
  // shortcut: each image element fetches the logo blob itself; share one object URL if sheets get large.
  if (el.type === 'image') return <div style={style}><AuthedImage path="/app/files/invoice/logo" alt="Shop logo" className="h-full w-full object-contain" /></div>
  return <div style={style}>{el.type === 'text' ? (el.text ?? '') : fieldValue(el.field, item, shopName)}</div>
}

/**
 * One label drawn from a template in real mm. VERTICAL rotates the whole design 90° (outer box swaps W × H).
 * BUTTERFLY marks the fold neck in the middle on screen only.
 */
export function TagLabel({ template, item, shopName }: { template: Pick<TagTemplateDto, 'widthMm' | 'heightMm' | 'shape' | 'direction' | 'neckWidthMm' | 'elements'>; item: StockItemDto; shopName: string }) {
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
        {template.elements.map((el) => <Element key={el.id} el={el} item={item} shopName={shopName} />)}
      </div>
    </div>
  )
}
