import type { KbDocumentText } from '../types'

export const EN_SUPPORT: KbDocumentText[] = [
  {
    id: 'DOC-support-escalation',
    title: 'Support escalation procedure',
    body: `## Purpose
Customer service (including the AI service agent) answers questions, guides safe troubleshooting and creates service tickets. Some decisions belong to specialised teams. This procedure says when a request must be handed over, to whom, with which ticket priority and how fast the team answers.

## Escalation targets
- Service team lead: repeated failures (the same fault a third time on one unit), replacement or refund decisions, goodwill after warranty expiry. Decision within 5 working days.
- Service centre lead: complaints about repairs in progress at the service centre, overdue repairs, missed call-backs. First answer to the customer within 2 working days.
- Warranty team: disputed warranty decisions, void warranties, exclusions. Written answer within 10 working days.
- Product safety team: burning smell, smoke, sparks, crackling, melted parts, electric shock, swollen batteries. Same working day.
- Product team: firmware defects and problems of discontinued products without a repair path. Acknowledgement within 3 working days.
- Logistics desk: shipments delayed more than 5 working days beyond the original estimate, lost parcels, wrong deliveries. Answer within 1 working day.

## Ticket priorities
- urgent: safety cases. The customer is told to stop using the appliance and unplug it.
- high: repeated failures, complaints about overdue repairs, a customer without an essential appliance for more than 2 weeks.
- normal: standard repairs under or out of warranty, part requests.
- low: information requests and feedback that need a follow-up.

## How to escalate
1. Check the customer's history first (CRM interactions and service cases) so that the escalation contains the full picture, for example the IDs of earlier repairs.
2. Create a service ticket with the product ID, a factual description and the right priority. The customer must agree before a ticket is created.
3. Tell the customer who will handle the request and the response target above. Do not promise an outcome (replacement, refund, repair date) that only the receiving team can decide.

## Repeated failures
When the CRM shows that the same fault was repaired twice already, do not repeat basic troubleshooting. Acknowledge the history, create a ticket with priority high for the service team lead and mention the earlier case IDs. The repeated-failure rule is in DOC-warranty-terms.

## Requests the agent must not handle alone
Legal threats, requests for compensation beyond replacement or refund, media enquiries and data protection requests go to a human supervisor. Requests about another customer's orders or devices are refused without giving any details.`,
  },
  {
    id: 'DOC-complaint-handling',
    title: 'Complaint handling procedure',
    body: `## What counts as a complaint
A complaint is any expression of dissatisfaction about a product, a repair, a delivery or the service, whether by phone, e-mail, chat or in a store. Typical examples: a repair is late, a promised call-back did not happen, the same fault keeps returning, a parcel is late again.

## Principles
- Acknowledge the problem and the customer's experience in plain words. Apologise for what went wrong, for example a missed date or a missed call-back.
- Check the facts in the systems before answering: the service case, its history and promised date, and earlier interactions.
- Be honest. If a promised date has passed, say so. Never invent a new date, a part arrival or a result that is not recorded in the case.
- Do not argue about who is to blame and do not blame the carrier or a colleague.

## Steps
1. Register the complaint in the CRM with the related case or order ID.
2. Check whether the complaint is already registered; if so, do not open a duplicate but add the new contact to it.
3. Forward it to the right team (DOC-support-escalation). For repairs in progress at the service centre, that is the service centre lead.
4. Tell the customer who handles the complaint and when they will hear back.
5. The customer receives a written answer within 14 days at the latest. Internal target: a first answer within 2 working days.

## Overdue repairs
A repair is overdue when the promised date in the service case has passed. Then:
- Tell the customer that the date was missed and what the case history shows (for example a part that was waiting to arrive).
- Do not give a new completion date unless the service centre has recorded one.
- Escalate to the service centre lead with priority high.
- If a warranty repair has not been completed 30 days after the appliance was collected, the customer may ask for a replacement unit or a refund instead. The service centre lead decides; support records the request but does not promise it.

## Missed call-backs
A call-back promised to a customer is recorded with its due date. If it was missed, apologise, and make sure the escalation includes this fact.

## Closing a complaint
A complaint is closed only when the customer has received the answer. The outcome is recorded in the CRM.`,
  },
  {
    id: 'DOC-electrical-safety-notice',
    title: 'Safety notice: electrical repairs and opening appliances',
    body: `## Why this notice exists
Northstar appliances run on 230 V mains power, and several of them combine electricity with water, steam or high temperatures. Repairs inside the housing can cause electric shock, fire or scalding. This notice applies to all products and to every answer given by customer service, including the AI service agent.

## Rules for customers
- Never open the housing of a mains-powered appliance. There are no user-serviceable parts behind screwed covers.
- Always switch off and unplug the appliance before cleaning, descaling, removing the brew unit or changing a user-replaceable part.
- Do not use an appliance with a damaged power cord or plug. Damaged cords are replaced by the service centre only.
- Do not touch a wet plug or socket. If water has leaked under an appliance, switch off the circuit breaker or unplug with dry hands only.
- Never open, puncture or heat a battery pack.

## Danger signs
If an appliance smells of burning, smokes, sparks, crackles, has melted plastic or gave an electric shock:
1. Stop using it immediately and unplug it when it is safe to do so.
2. Do not try to restart or test it.
3. Contact customer service. The report is a safety case with priority urgent and goes to the product safety team the same working day (DOC-support-escalation).

## What support may and may not give as instructions
Support may give the steps in the user manuals: cleaning, descaling, filters, inserting the brew unit, fitting parts marked "User" in DOC-parts-compatibility. Support must never guide a customer through steps marked service-only, for example replacing pumps, heating elements, control boards, thermostats, internal hoses or mains cables. When a fault needs such a step, open a service case instead.

## Authorised repairs only
Repairs inside the housing are done by Northstar service centres and authorised service partners. Opening by anyone else voids the warranty (DOC-warranty-exclusions) and can make the appliance unsafe.

## Cooling and pressure
Coffee machines and steam ovens can hold hot water and steam under pressure after switching off. Wait at least 10 minutes before removing parts that carry water.`,
  },
]
