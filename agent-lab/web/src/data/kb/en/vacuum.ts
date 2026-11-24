import type { KbDocumentText } from '../types'

export const EN_VACUUM: KbDocumentText[] = [
  {
    id: 'DOC-aeroclean-manual',
    title: 'AeroClean V8 and V10: user manual',
    body: `## About this manual
This manual covers the Northstar AeroClean V8 (serial numbers starting with AC8) and AeroClean V10 (serial numbers starting with AC10) cordless stick vacuums. Both use a removable click-in battery. The V10 adds a laser dust light on the floor head and a longer runtime. The warranty period is 24 months from purchase for both models.

## Runtime and power modes
- Eco mode: V8 up to 40 minutes, V10 up to 60 minutes.
- Auto mode: V8 about 25 minutes, V10 about 40 minutes.
- Boost mode: about 8 minutes on both models.
Runtimes apply to a new, fully charged battery with the non-motorised tool. A motorised floor head shortens them by about a third.

## Charging
1. Use only the original charger supplied with the vacuum.
2. Charge at room temperature between 5 °C and 35 °C. The battery does not charge outside this range.
3. A full charge takes 4 hours (V8) or 4.5 hours (V10). The light on the battery is blue while charging and goes off when full.
4. A red blinking charging light means a battery or charging fault; see DOC-vacuum-battery-faults.

## Changing the battery
Press the release button under the handle and slide the battery down. Slide the new or spare battery in until it clicks. The AeroClean Spare Battery (PRD-VAC-6) fits both the V8 and the V10. Never open the battery pack.

## Emptying the bin and cleaning the filters
- Empty the dust bin after every use: hold it over the rubbish bin and pull the red lever.
- Rinse the pre-filter under cold water once a month and let it dry for 24 hours before refitting.
- Tap the post-motor HEPA filter clean every month; replace it once a year.
A clogged filter makes the motor pulse on and off. This is not a battery fault.

## Brush roll
Switch the vacuum off, remove the battery, and open the end cap of the floor head with a coin. Pull out the brush roll and cut away hair with scissors along the groove. Refit the roll and close the cap.

## Storage
Store the vacuum on its wall dock indoors. For storage longer than a month, leave the battery about half charged.

## Technical data
V8: 350 W, bin 0.5 l, 2.4 kg. V10: 450 W, bin 0.76 l, 2.7 kg. Battery: lithium-ion, 25.2 V.`,
  },
  {
    id: 'DOC-vacuum-battery-faults',
    title: 'AeroClean vacuum battery fault guide',
    body: `## Scope
This guide covers battery and charging problems of the Northstar AeroClean V6, V8 and V10 cordless vacuums and the AeroClean Spare Battery (PRD-VAC-6). Typical customer reports are: "the battery lasts only a few minutes", "it does not charge", "the charging light blinks red", "the vacuum stops and starts".

## Symptom: runtime very short
1. Check the mode. Boost mode empties a full battery in about 8 minutes on every model.
2. Clean the pre-filter and post-motor filter (DOC-aeroclean-manual). Clogged filters raise power draw.
3. Charge fully for 4 to 5 hours with the original charger and test in eco mode with the non-motorised tool.
4. If the runtime in eco mode is below half of the rated runtime (V8 under 20 minutes, V10 under 30 minutes, V6 under 12 minutes), the battery has lost capacity and needs replacement.

## Symptom: no charging or red blinking light
- Check the wall socket with another device and inspect the charger cable for damage.
- Let a cold or hot battery reach room temperature; charging is blocked below 5 °C and above 35 °C.
- Wipe the battery contacts with a dry cloth.
If the light still blinks red, the battery protection circuit has switched off. The battery cannot be repaired and must be replaced.

## Symptom: motor pulses on and off
Pulsing is almost always a blocked airflow, not a battery fault. Check the bin, filters, wand and brush roll for blockages.

## Battery replacement and warranty
Batteries are covered for the full warranty period of the vacuum (24 months for V8 and V10, 12 months for V6) when the eco-mode runtime falls below half of the rated runtime under normal use. Under warranty, a replacement battery is sent to the customer free of charge: V10 battery part AC10-BAT-4, V8 battery part AC8-BAT-3. Both are click-in parts that the customer fits without tools. A fault reported before the warranty end date is handled under warranty even if the replacement arrives after that date (DOC-warranty-terms).
After the warranty, the customer can buy the AeroClean Spare Battery (PRD-VAC-6, EUR 69), which fits V8 and V10. The V6 battery is built in and is replaced by the service centre as a paid repair (DOC-paid-repairs).

## Safety
Never open, puncture or heat a battery pack. A swollen, hot or smelling battery must not be charged: put it outside on a non-flammable surface and contact support. This is a safety case (DOC-support-escalation).`,
  },
  {
    id: 'DOC-roboclean-r5-guide',
    title: 'RoboClean R5: troubleshooting guide',
    body: `## About the RoboClean R5
The Northstar RoboClean R5 (serial numbers starting with RC5) is a robot vacuum with lidar navigation, a self-emptying dock and control through the Northstar app. Warranty: 24 months from purchase. For Wi-Fi and app pairing problems see DOC-smart-wifi-connectivity.

## Brush motor error
Symptom: the main brush stops after a few minutes, and the app shows "Brush motor error".
1. Switch the robot off first. Then turn it over on a soft surface and remove the main brush (two clips).
2. Cut away hair and threads wound around the brush and its end caps.
3. Check that the brush turns freely by hand, refit it and start a test clean.
If the error returns within a few minutes after cleaning, the brush motor module is faulty. The brush motor module (part RC5-BM-11) is user-replaceable: it is held by two screws on the underside and is connected with a plug, with no mains voltage involved. Under warranty, the module is sent to the customer by post (DOC-shipping-delivery), and the customer fits it with the supplied screwdriver.

## Robot does not find its dock
- Place the dock against a wall with 0.5 m of free space on both sides and 1.5 m in front.
- Keep the dock away from mirrors, mirrored wardrobes and glass doors: they confuse the lidar.
- Wipe the lidar cover on top of the robot with a dry cloth.
- In the app, run "Rebuild map" if furniture was moved.

## Robot wanders or misses rooms
Clean the cliff sensors under the front bumper and remove the robot from carpets with long fringes. Update the robot firmware in the app.

## Self-emptying dock does not empty
Replace the dock bag when the app shows "Bag full", and check that the suction channel between robot and dock is free.

## Wheel error
Remove hair from the wheel axles and check that the wheels spring back when pressed. A wheel that stays down is replaced at the service centre.

## Parts
Brush motor module RC5-BM-11 (user-replaceable), side brushes RC5-SB-02 (pair), dock bags RC5-DB-03 (pack of three). See DOC-parts-compatibility.`,
  },
]
