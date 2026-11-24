import { CUSTOMERS } from './customers'
import { ORDERS } from './orders'
import { PRODUCTS } from './products'
import type { Localized, Shipment, ShipmentEvent } from './types'

const DC = 'Northstar Distribution Centre, Poznań, PL'
const PARTS = 'Northstar Parts Centre, Łódź, PL'
const PL_HUB = 'Sorting hub, Stryków, PL'

const COUNTRY_CODE: Record<string, string> = {
  Poland: 'PL', France: 'FR', Italy: 'IT', Czechia: 'CZ', Germany: 'DE', Spain: 'ES', Netherlands: 'NL', Denmark: 'DK',
  Austria: 'AT', Ireland: 'IE', 'United Kingdom': 'UK', Romania: 'RO', Sweden: 'SE', Belgium: 'BE',
}
/** Last sorting hub before delivery, by destination country. */
const HUB: Record<string, string> = {
  PL: PL_HUB, FR: 'NorthLink hub, Mâcon, FR', IT: 'NorthLink hub, Bologna, IT', CZ: 'NorthLink hub, Prague, CZ',
  DE: 'NorthLink hub, Kassel, DE', ES: 'NorthLink hub, Madrid, ES', NL: 'NorthLink hub, Utrecht, NL', DK: 'NorthLink hub, Kolding, DK',
  AT: 'NorthLink hub, Linz, AT', IE: 'NorthLink hub, Dublin, IE', UK: 'NorthLink hub, Coventry, UK', RO: 'NorthLink hub, Bucharest, RO',
  SE: 'NorthLink hub, Jönköping, SE', BE: 'NorthLink hub, Mechelen, BE',
}

const CUSTOMER = new Map(CUSTOMERS.map((c) => [c.id, c]))
const ORDER = new Map(ORDERS.map((o) => [o.id, o]))
const MODEL = new Map(PRODUCTS.map((p) => [p.id, p.model]))

function country(customerId: string): string {
  const c = CUSTOMER.get(customerId)
  if (!c) throw new Error(`shipments: unknown customer ${customerId}`)
  return COUNTRY_CODE[c.address.country]
}
function destination(customerId: string): string {
  const c = CUSTOMER.get(customerId)!
  return `${c.address.city}, ${country(customerId)}`
}
function carrierFor(customerId: string): string {
  return country(customerId) === 'PL' ? 'SwiftParcel' : 'NorthLink Express'
}
function tracking(id: string, carrier: string): string {
  const [, year, num] = id.split('-')
  const n = Number(num)
  const check = String((n * 7919 + Number(year)) % 1000).padStart(3, '0')
  return `${carrier === 'SwiftParcel' ? 'SWP' : 'NLX'}${year.slice(2)}0${num}${check}`
}
function prevDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
function hhmm(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

const T = {
  label: { en: 'Shipping label created; parcel prepared for dispatch.', pl: 'Utworzono etykietę; paczka przygotowana do wysyłki.' },
  picked: { en: 'Picked up by the carrier.', pl: 'Odebrana przez przewoźnika.' },
  hub: { en: 'Arrived at the sorting hub.', pl: 'Dotarła do sortowni.' },
  departed: { en: 'Left the sorting hub.', pl: 'Wyjechała z sortowni.' },
  out: { en: 'Out for delivery.', pl: 'Wydana kurierowi do doręczenia.' },
  delivered: { en: 'Delivered to the recipient.', pl: 'Doręczona do odbiorcy.' },
  dropped: { en: 'Handed in by the customer at a drop-off point.', pl: 'Nadana przez klienta w punkcie nadań.' },
  received: { en: 'Received at the Northstar warehouse and checked.', pl: 'Przyjęta w magazynie Northstar i sprawdzona.' },
} satisfies Record<string, Localized>

function ev(at: string, location: string, code: ShipmentEvent['code'], description: Localized): ShipmentEvent {
  return { at, location, code, description }
}

/** Standard dated events of a delivered parcel. */
function deliveredEvents(id: string, shipped: string, delivered: string, from: string, to: string, hub: string): ShipmentEvent[] {
  const m = Number(id.slice(-3))
  const hubAt = prevDay(delivered) > shipped ? `${prevDay(delivered)}T${hhmm(21, 10 + m)}` : `${delivered}T${hhmm(5, 5 + m)}`
  return [
    ev(`${shipped}T${hhmm(9, m)}`, from, 'label_created', T.label),
    ev(`${shipped}T${hhmm(16, 20 + m)}`, from, 'picked_up', T.picked),
    ev(hubAt, hub, 'arrived_hub', T.hub),
    ev(`${delivered}T${hhmm(8, m)}`, to, 'out_for_delivery', T.out),
    ev(`${delivered}T${hhmm(13, 7 + m)}`, to, 'delivered', T.delivered),
  ]
}

function orderContents(orderId: string): Localized {
  const order = ORDER.get(orderId)
  if (!order) throw new Error(`shipments: unknown order ${orderId}`)
  const text = order.lines.map((l) => `${l.quantity} × ${MODEL.get(l.productId)}`).join(', ')
  return { en: text, pl: text }
}

/** An order delivery that arrived. */
function delivery(id: string, orderId: string, shipped: string, delivered: string): Shipment {
  const order = ORDER.get(orderId)
  if (!order) throw new Error(`shipments: unknown order ${orderId}`)
  const to = destination(order.customerId)
  const carrier = carrierFor(order.customerId)
  return {
    id, customerId: order.customerId, type: 'order_delivery', orderId, caseId: null, carrier, trackingNumber: tracking(id, carrier),
    status: 'delivered', contents: orderContents(orderId), from: DC, to, shippedDate: shipped, estimatedDelivery: delivered, deliveredDate: delivered,
    events: deliveredEvents(id, shipped, delivered, DC, to, HUB[country(order.customerId)]),
  }
}

/** A replacement part sent to the customer for a service case, and delivered. */
function part(id: string, orderId: string, caseId: string, contents: Localized, shipped: string, delivered: string): Shipment {
  const order = ORDER.get(orderId)!
  const to = destination(order.customerId)
  const carrier = carrierFor(order.customerId)
  return {
    id, customerId: order.customerId, type: 'replacement_part', orderId, caseId, carrier, trackingNumber: tracking(id, carrier),
    status: 'delivered', contents, from: PARTS, to, shippedDate: shipped, estimatedDelivery: delivered, deliveredDate: delivered,
    events: deliveredEvents(id, shipped, delivered, PARTS, to, HUB[country(order.customerId)]),
  }
}

/** A return from the customer to the warehouse (completed: status returned). */
function returned(id: string, orderId: string, dropped: string, received: string, dropPoint: string): Shipment {
  const order = ORDER.get(orderId)!
  const carrier = carrierFor(order.customerId)
  const pl = country(order.customerId) === 'PL'
  return {
    id, customerId: order.customerId, type: 'return', orderId, caseId: null, carrier, trackingNumber: tracking(id, carrier),
    status: 'returned', contents: orderContents(orderId), from: destination(order.customerId), to: DC, shippedDate: dropped,
    estimatedDelivery: received, deliveredDate: received,
    events: [
      ev(`${dropped}T11:24`, dropPoint, 'dropped_off', T.dropped),
      ev(`${dropped}T17:50`, dropPoint, 'picked_up', T.picked),
      ev(`${prevDay(received)}T${pl ? '02:15' : '20:40'}`, PL_HUB, 'arrived_hub', T.hub),
      ev(`${received}T10:05`, DC, 'received_at_warehouse', T.received),
    ],
  }
}

/** 39 shipments: order deliveries, replacement parts and returns. */
export const SHIPMENTS: Shipment[] = [
  // 2024
  delivery('SHIP-2024-054', 'ORD-2024-0434', '2024-06-17', '2024-06-19'),
  delivery('SHIP-2024-103', 'ORD-2024-0832', '2024-11-18', '2024-11-19'),
  delivery('SHIP-2024-107', 'ORD-2024-0876', '2024-12-03', '2024-12-06'),

  // 2025
  delivery('SHIP-2025-015', 'ORD-2025-0117', '2025-02-17', '2025-02-20'),
  delivery('SHIP-2025-040', 'ORD-2025-0325', '2025-05-06', '2025-05-08'),
  returned('SHIP-2025-042', 'ORD-2025-0325', '2025-05-12', '2025-05-15', 'NorthLink drop-off point, Rue de Flandre, Brussels, BE'),
  part('SHIP-2025-049', 'ORD-2024-0107', 'CASE-2025-017',
    { en: 'Replacement 5 l basket for AirCrisp 5 (part AF5-BK-05)', pl: 'Zamienny kosz 5 l do AirCrisp 5 (część AF5-BK-05)' },
    '2025-06-04', '2025-06-07'),
  delivery('SHIP-2025-053', 'ORD-2025-0429', '2025-06-16', '2025-06-19'),
  delivery('SHIP-2025-061', 'ORD-2025-0494', '2025-07-10', '2025-07-14'),
  delivery('SHIP-2025-069', 'ORD-2025-0559', '2025-08-04', '2025-08-07'),
  delivery('SHIP-2025-075', 'ORD-2025-0608', '2025-08-25', '2025-08-27'),
  delivery('SHIP-2025-086', 'ORD-2025-0702', '2025-09-29', '2025-09-30'),
  delivery('SHIP-2025-092', 'ORD-2025-0751', '2025-10-17', '2025-10-20'),
  delivery('SHIP-2025-106', 'ORD-2025-0863', '2025-12-01', '2025-12-04'),

  // 2026
  delivery('SHIP-2026-013', 'ORD-2026-0101', '2026-02-09', '2026-02-10'),
  delivery('SHIP-2026-019', 'ORD-2026-0151', '2026-03-02', '2026-03-05'),
  delivery('SHIP-2026-023', 'ORD-2026-0187', '2026-03-13', '2026-03-17'),
  delivery('SHIP-2026-033', 'ORD-2026-0260', '2026-04-13', '2026-04-16'),
  delivery('SHIP-2026-034', 'ORD-2026-0273', '2026-04-16', '2026-04-18'),
  delivery('SHIP-2026-042', 'ORD-2026-0335', '2026-05-11', '2026-05-13'),
  delivery('SHIP-2026-053', 'ORD-2026-0424', '2026-06-15', '2026-06-17'),
  delivery('SHIP-2026-058', 'ORD-2026-0471', '2026-07-01', '2026-07-03'),
  delivery('SHIP-2026-059', 'ORD-2026-0473', '2026-07-02', '2026-07-06'),
  delivery('SHIP-2026-064', 'ORD-2026-0523', '2026-07-21', '2026-07-24'),
  delivery('SHIP-2026-073', 'ORD-2026-0588', '2026-08-17', '2026-08-20'),
  delivery('SHIP-2026-077', 'ORD-2026-0624', '2026-08-31', '2026-09-02'),
  part('SHIP-2026-082', 'ORD-2025-0751', 'CASE-2026-028',
    { en: 'Replacement bean hopper lid for Barista Compact 200 (part BC2-HL-01)', pl: 'Zamienna pokrywa pojemnika na ziarna do Barista Compact 200 (część BC2-HL-01)' },
    '2026-09-17', '2026-09-19'),
  {
    id: 'SHIP-2026-084', customerId: 'CUST-1038', type: 'order_delivery', orderId: 'ORD-2026-0689', caseId: null, carrier: 'SwiftParcel',
    trackingNumber: tracking('SHIP-2026-084', 'SwiftParcel'), status: 'returned', contents: orderContents('ORD-2026-0689'),
    from: DC, to: 'SwiftParcel locker POZ-118, Półwiejska, Poznań, PL', shippedDate: '2026-09-23', estimatedDelivery: '2026-09-24', deliveredDate: null,
    events: [
      ev('2026-09-23T09:31', DC, 'label_created', T.label),
      ev('2026-09-23T16:52', DC, 'picked_up', T.picked),
      ev('2026-09-24T03:40', PL_HUB, 'arrived_hub', T.hub),
      ev('2026-09-24T10:02', 'SwiftParcel locker POZ-118, Półwiejska, Poznań, PL', 'ready_for_pickup', {
        en: 'Ready for pickup at parcel locker POZ-118. Collect within 48 hours.',
        pl: 'Gotowa do odbioru w paczkomacie POZ-118. Odbiór w ciągu 48 godzin.',
      }),
      ev('2026-09-27T10:05', 'SwiftParcel locker POZ-118, Półwiejska, Poznań, PL', 'not_collected', {
        en: 'Not collected within the pickup period; parcel removed from the locker.',
        pl: 'Paczka nie została odebrana w terminie; wyjęta z paczkomatu.',
      }),
      ev('2026-09-29T09:20', DC, 'returned_to_sender', { en: 'Returned to the sender.', pl: 'Zwrócona do nadawcy.' }),
    ],
  },
  delivery('SHIP-2026-087', 'ORD-2026-0689', '2026-09-30', '2026-10-01'),
  delivery('SHIP-2026-089', 'ORD-2026-0728', '2026-10-08', '2026-10-12'),
  part('SHIP-2026-091', 'ORD-2026-0187', 'CASE-2026-031',
    { en: 'Replacement steam wand nozzle for Barista Pro 500 (part BP5-SW-02)', pl: 'Zamienna końcówka dyszy parowej do Barista Pro 500 (część BP5-SW-02)' },
    '2026-10-13', '2026-10-15'),
  delivery('SHIP-2026-097', 'ORD-2026-0790', '2026-11-02', '2026-11-05'),
  delivery('SHIP-2026-098', 'ORD-2026-0796', '2026-11-03', '2026-11-04'),
  {
    id: 'SHIP-2026-100', customerId: 'CUST-1017', type: 'replacement_part', orderId: 'ORD-2025-0608', caseId: 'CASE-2026-034', carrier: 'NorthLink Express',
    trackingNumber: tracking('SHIP-2026-100', 'NorthLink Express'), status: 'delayed',
    contents: { en: 'Brush motor module for RoboClean R5 (part RC5-BM-11)', pl: 'Moduł silnika szczotki do RoboClean R5 (część RC5-BM-11)' },
    from: PARTS, to: 'Leipzig, DE', shippedDate: '2026-11-10', estimatedDelivery: '2026-11-26', deliveredDate: null,
    events: [
      ev('2026-11-10T09:40', PARTS, 'label_created', T.label),
      ev('2026-11-10T17:05', PARTS, 'picked_up', T.picked),
      ev('2026-11-11T04:50', PL_HUB, 'arrived_hub', T.hub),
      ev('2026-11-11T22:30', PL_HUB, 'departed_hub', T.departed),
      ev('2026-11-12T14:10', 'NorthLink hub, Kassel, DE', 'arrived_hub', T.hub),
      ev('2026-11-14T07:00', 'NorthLink hub, Kassel, DE', 'delayed', {
        en: 'Delayed: backlog at the sorting hub. The original delivery estimate of 14 Nov 2026 will be missed.',
        pl: 'Opóźnienie: zaległości w sortowni. Pierwotny termin doręczenia, 14.11.2026, nie zostanie dotrzymany.',
      }),
      ev('2026-11-18T16:20', 'NorthLink hub, Kassel, DE', 'delayed', {
        en: 'Still held at the hub; parcel re-scanned and prioritised. New estimated delivery: 21 Nov 2026.',
        pl: 'Paczka nadal w sortowni; zeskanowana ponownie i oznaczona jako priorytetowa. Nowy szacowany termin: 21.11.2026.',
      }),
      ev('2026-11-21T18:45', 'NorthLink hub, Kassel, DE', 'delayed', {
        en: 'Missed the scheduled line haul to Leipzig. New estimated delivery: 26 Nov 2026.',
        pl: 'Paczka nie zdążyła na zaplanowany transport do Lipska. Nowy szacowany termin: 26.11.2026.',
      }),
    ],
  },
  returned('SHIP-2026-101', 'ORD-2026-0796', '2026-11-12', '2026-11-14', 'SwiftParcel locker GDA-042, Grunwaldzka, Gdańsk, PL'),
  {
    id: 'SHIP-2026-103', customerId: 'CUST-1045', type: 'order_delivery', orderId: 'ORD-2026-0832', caseId: null, carrier: 'NorthLink Express',
    trackingNumber: tracking('SHIP-2026-103', 'NorthLink Express'), status: 'awaiting_pickup', contents: orderContents('ORD-2026-0832'),
    from: DC, to: 'Leeds, UK', shippedDate: '2026-11-17', estimatedDelivery: '2026-11-20', deliveredDate: null,
    events: [
      ev('2026-11-17T09:14', DC, 'label_created', T.label),
      ev('2026-11-17T16:40', DC, 'picked_up', T.picked),
      ev('2026-11-18T04:05', PL_HUB, 'departed_hub', T.departed),
      ev('2026-11-19T19:25', 'NorthLink hub, Coventry, UK', 'arrived_hub', T.hub),
      ev('2026-11-20T08:10', 'Leeds, UK', 'out_for_delivery', T.out),
      ev('2026-11-20T15:32', 'NorthLink pickup point, Hyde Park Corner, Leeds, UK', 'ready_for_pickup', {
        en: 'Recipient not at home. Parcel left at the NorthLink pickup point, Hyde Park Corner, Leeds. Collect by 27 Nov 2026 with the code from the notification e-mail.',
        pl: 'Odbiorcy nie było w domu. Paczka czeka w punkcie odbioru NorthLink, Hyde Park Corner, Leeds. Odbiór do 27.11.2026 z kodem z e-maila z powiadomieniem.',
      }),
    ],
  },
  {
    id: 'SHIP-2026-104', customerId: 'CUST-1057', type: 'replacement_part', orderId: 'ORD-2026-0588', caseId: 'CASE-2026-038', carrier: 'NorthLink Express',
    trackingNumber: tracking('SHIP-2026-104', 'NorthLink Express'), status: 'in_transit',
    contents: { en: 'Replacement battery for AeroClean V10 (part AC10-BAT-4)', pl: 'Zamienny akumulator do AeroClean V10 (część AC10-BAT-4)' },
    from: PARTS, to: 'Gothenburg, SE', shippedDate: '2026-11-20', estimatedDelivery: '2026-11-25', deliveredDate: null,
    events: [
      ev('2026-11-20T10:15', PARTS, 'label_created', T.label),
      ev('2026-11-20T16:50', PARTS, 'picked_up', T.picked),
      ev('2026-11-21T03:20', PL_HUB, 'arrived_hub', T.hub),
      ev('2026-11-21T21:00', PL_HUB, 'departed_hub', T.departed),
      ev('2026-11-24T06:40', 'NorthLink hub, Jönköping, SE', 'arrived_hub', T.hub),
    ],
  },
  {
    id: 'SHIP-2026-105', customerId: 'CUST-1023', type: 'order_delivery', orderId: 'ORD-2026-0845', caseId: null, carrier: 'NorthLink Express',
    trackingNumber: tracking('SHIP-2026-105', 'NorthLink Express'), status: 'in_transit', contents: orderContents('ORD-2026-0845'),
    from: DC, to: 'Rotterdam, NL', shippedDate: '2026-11-23', estimatedDelivery: '2026-11-26', deliveredDate: null,
    events: [
      ev('2026-11-23T09:05', DC, 'label_created', T.label),
      ev('2026-11-23T17:10', DC, 'picked_up', T.picked),
      ev('2026-11-24T02:30', PL_HUB, 'arrived_hub', T.hub),
    ],
  },
  {
    id: 'SHIP-2026-106', customerId: 'CUST-1001', type: 'order_delivery', orderId: 'ORD-2026-0848', caseId: null, carrier: 'SwiftParcel',
    trackingNumber: tracking('SHIP-2026-106', 'SwiftParcel'), status: 'in_transit', contents: orderContents('ORD-2026-0848'),
    from: DC, to: 'Kraków, PL', shippedDate: '2026-11-23', estimatedDelivery: '2026-11-25', deliveredDate: null,
    events: [
      ev('2026-11-23T11:20', DC, 'label_created', T.label),
      ev('2026-11-23T17:35', DC, 'picked_up', T.picked),
      ev('2026-11-24T01:10', PL_HUB, 'arrived_hub', T.hub),
      ev('2026-11-24T06:00', PL_HUB, 'departed_hub', T.departed),
    ],
  },
]
