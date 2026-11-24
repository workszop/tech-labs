import type { KbDocumentText } from '../types'

export const EN_HOME: KbDocumentText[] = [
  {
    id: 'DOC-kitchen-overheating',
    title: 'Kitchen appliance overheating guide: AirCrisp 5, InductaCook 2, ToastLine 4',
    body: `## Scope
This guide helps support staff and customers with kitchen appliances that switch themselves off, get very hot or show an overheating code: the Northstar AirCrisp 5 air fryer, the InductaCook 2 induction hob and the ToastLine 4 toaster. Every appliance has a thermal cut-out that switches it off before it becomes dangerous. A cut-out is a protection, not the fault itself; the task is to find why the appliance overheats.

## Safety first
If there is smoke, a burning smell, sparks or melted plastic, switch off at the socket, unplug when safe, do not use the appliance again, and treat the report as a safety case (DOC-support-escalation, DOC-electrical-safety-notice).

## AirCrisp 5 switches off during cooking
Symptom: the air fryer stops after about 10 minutes, the display goes dark, and the housing is very hot.
1. Check the clearance: the air outlet at the back needs at least 10 cm from the wall and 30 cm above the appliance. Do not use it under wall cabinets.
2. Do not fill the 5 l basket above the MAX line. An overfilled basket blocks the airflow.
3. Clean the heating element area and the grease guard after the appliance has cooled; grease build-up makes the cut-out trip.
4. Let the air fryer cool for 30 minutes and test an empty run at 180 °C for 15 minutes.
If it still switches off with correct clearance, or the fan rattles or is louder than before, the fan motor (part AF5-FM-03) is worn. This is a service repair; the customer must not open the housing. Within the 24-month warranty it is covered; after the warranty it is a paid repair (DOC-paid-repairs).

## InductaCook 2 shows E3
E3 means the hob electronics are too hot and the zone has switched off.
1. Make sure the air inlet under the hob and the outlet at the back are free. Do not place the hob on a tablecloth or next to an oven.
2. Use pans with a flat base that covers the cooking zone; warped pans overheat the coil.
3. Let the hob cool for 20 minutes before restarting.
If E3 returns within a few minutes on a correct surface, the cooling fan (part IC2-FAN-02) has failed. It is replaced by the service centre only.

## ToastLine 4 cuts out or smells of burning
Empty the crumb tray after every few uses: crumbs on the bottom can smoulder. Never insert buttered bread, foil or a knife. If the lever does not stay down after the toaster has cooled, the thermal fuse has blown and the toaster must go to the service centre.

## What to report in a service case
Model and serial number, the code shown (for example E3), how long after starting the appliance switches off, the placement, and whether a noise or smell was noticed.`,
  },
  {
    id: 'DOC-steamchef-oven-30-guide',
    title: 'SteamChef Oven 30: user guide and error codes',
    body: `## About the SteamChef Oven 30
The Northstar SteamChef Oven 30 (serial numbers starting with SC30) is a 30 l countertop combination steam oven with a removable 1 l water tank on the left side. Warranty: 24 months from purchase.

## Water tank and steam generator
- Fill the tank with fresh, cold water before every steam programme. Use soft or filtered water if possible.
- Empty and dry the tank after use.
- Descale the steam generator when the display shows "Descale", about every 30 steam programmes, with one bottle of Northstar descaler (Descaling Kit PRD-COFFEE-7) and the programme "Descale" in the maintenance menu.

## Message "Fill water tank" although the tank is full
1. Remove the tank and check that the float inside moves freely.
2. Wipe the two metal contacts at the back of the tank and in the tank slot with a dry cloth.
3. Push the tank in firmly until it clicks.
4. If the message stays, descale the steam generator; scale on the level sensor gives false "empty" readings.
If the message still appears, send photos of the tank and the display to support; a faulty level sensor is a service repair.

## Error codes
- H1: heating fault. The oven stops heating in the middle of a programme. Switch off and unplug for 10 minutes. If H1 returns, stop using the oven and open a service case. H1 points to the heating element (part SC30-HE-01) or the control board (part SC30-CB-02). Both are replaced at the service centre only.
- H2: oven cavity too hot. The fan cools the oven automatically; wait until H2 disappears and keep the vents at the top free.
- W1: water tank missing.
- D1: door not closed.

## Repairs at the service centre
Ovens are collected by courier and repaired at the Northstar service centre. The standard repair time is 10 working days from collection. If a part must be ordered, the service centre tells the customer the expected date and keeps the case open as "in repair". Missed promised dates are handled according to the complaint procedure (DOC-complaint-handling).

## Cleaning
Wipe the cavity with a damp cloth after it has cooled. Use the "Steam clean" programme once a week. Do not use oven sprays on the steam inlet.`,
  },
  {
    id: 'DOC-smart-wifi-connectivity',
    title: 'Wi-Fi connectivity guide for Northstar smart devices',
    body: `## Devices covered
This guide covers Wi-Fi and app connection problems of the Northstar Home Hub, Home Hub Classic, SmartPlug Duo, ClimaSense thermostat, LeakGuard sensor, PureAir 500 Smart purifier and RoboClean R5 robot vacuum. LeakGuard connects through the Home Hub (Zigbee), not directly to Wi-Fi.

## Network requirements
- All Northstar smart devices use 2.4 GHz Wi-Fi only. If the router broadcasts one name for 2.4 and 5 GHz, enable a separate 2.4 GHz network or switch off band steering during setup.
- WPA2 or WPA3 security. Hidden networks and captive portals (hotels, dormitories) are not supported.
- The phone must be on the same network during pairing, with Bluetooth and location enabled for the Northstar app.

## After a router change or new Wi-Fi password
Devices keep the old network settings and stay offline. Reset the network settings and pair again:
- Home Hub: hold the rear button for 10 seconds until the light flashes yellow.
- SmartPlug Duo: hold the button on each plug for 6 seconds.
- PureAir 500 Smart: hold the Wi-Fi button for 5 seconds.
- RoboClean R5: hold the Home and Spot buttons together for 5 seconds.
Then add the device again in the app with "Add device".

## Hub offline after a power cut
If the Home Hub stays offline after a power cut, unplug it for 30 seconds. If it is still offline, start recovery mode: hold the rear button while plugging in. The hub restores its settings and connected devices from the cloud backup within 10 minutes.

## Device does not connect after an app update
1. Update the app to the latest version and sign out and in again.
2. Remove the device in the app and add it again.
3. If it still fails, send the app logs from Settings > Help > Send logs and quote the service case number.

## Known issue: Home Hub Classic and firmware 4.2
Some Home Hub Classic units drop their Wi-Fi connection several times a day after firmware 4.2. The product team is investigating. The Home Hub Classic is discontinued; affected customers are escalated to the product team for a firmware fix or an upgrade offer (DOC-support-escalation). Do not promise a date for a fix.

## Firmware updates
Keep automatic updates on. LeakGuard firmware is updated through the Home Hub.`,
  },
]
