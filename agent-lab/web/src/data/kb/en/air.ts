import type { KbDocumentText } from '../types'

export const EN_AIR: KbDocumentText[] = [
  {
    id: 'DOC-pureair-300-manual',
    title: 'PureAir 300: user manual',
    body: `## About this manual
This manual covers the Northstar PureAir 300 air purifier (serial numbers starting with PA300) for rooms up to 50 m². It has a HEPA H13 filter with an activated carbon layer, a laser particle sensor and an air quality display. Warranty: 24 months from purchase. The PureAir 300 has no Wi-Fi; it is controlled with the buttons on top.

## Controls
- Power button: on and off.
- Fan button: three speeds and Auto. In Auto mode the fan follows the particle sensor.
- Mode button: Night mode dims the display and uses the lowest speed.
- Filter button: hold for 3 seconds to reset the filter indicator after a filter change.

## Air quality display
The number shows the PM2.5 particle level measured by the sensor, in µg/m³. The ring colour gives the band: blue good (0 to 12), green fair (13 to 35), yellow poor (36 to 55), red very poor (above 55). After switching on, the sensor needs about 30 seconds before the reading is valid.

## Placement
Place the purifier on a flat floor with at least 30 cm free on each side and 1 m above it. Do not place it next to a humidifier or in a bathroom: water mist reads as particles.

## Filter
Replace the filter (HEPA H13 Filter PureAir 300/500, PRD-AIR-5) when the filter light is red, typically every 6 to 12 months. See DOC-pureair-filter-care.

## Cleaning the particle sensor
Dust on the sensor lens makes the reading jump or freeze. Clean the sensor every two months:
1. Switch off and unplug the purifier.
2. Open the small sensor cover on the right side (marked with a dust symbol).
3. Clean the sensor opening with a dry cotton swab. Do not use water or alcohol.
4. Vacuum the air inlet grille of the sensor with a soft brush.
5. Close the cover, plug in and switch on.

## Error codes
- F1: filter missing or not seated. Refit the filter and close the back cover.
- F2: filter life ended. Replace the filter and reset the indicator.
- S2: particle sensor reading error. The reading stays at one value or shows dashes. Clean the particle sensor as described above. If S2 remains, follow the current service bulletin SB-2026-07 (DOC-sb-2026-07).
- E1: fan motor fault. Unplug and open a service case.

## Technical data
Power 45 W. Clean air delivery rate 300 m³/h. Noise 24 to 52 dB. Weight 6.1 kg.`,
  },
  {
    id: 'DOC-pureair-sensor-calibration-2025',
    title: 'PureAir 300: particle sensor calibration procedure (2025)',
    body: `## Status of this document
This procedure was issued in March 2025 for support staff handling the S2 error and stuck air quality readings on the Northstar PureAir 300. It has been replaced by service bulletin SB-2026-07 (DOC-sb-2026-07). It is kept for reference only. Do not give these steps to customers.

## Purpose
From early 2025 some PureAir 300 units showed a frozen air quality number or the S2 error although the sensor opening was clean. The cause was believed to be a drifting sensor baseline. This procedure recalibrated the sensor with the buttons.

## Preconditions
- The particle sensor has been cleaned as described in the PureAir 300 manual (DOC-pureair-300-manual).
- The purifier has been running for at least 10 minutes.

## Recalibration steps (2025)
1. Open the windows and air the room for 10 minutes so that the room air is as clean as possible.
2. With the purifier switched on, hold the Mode and Fan buttons together for 5 seconds until the display shows "CAL".
3. Leave the purifier running at the highest speed for 10 minutes. Do not move it during this time.
4. When "CAL" disappears, the new baseline is stored. The display returns to the air quality reading.
5. If S2 is still shown, repeat the calibration once more.

## Recording the result
Staff recorded in the CRM interaction that the calibration was done, how many times, and the air quality reading before and after. A reading that changed after calibration was treated as solved.

## Escalation
If S2 remained after two calibrations, a service case was opened for a sensor check at the service centre.

## Known limitation
The recalibration assumes that the room air is clean during the 10 minutes. If it is not, the purifier stores a wrong baseline and the reading can stay at one value. This limitation led to the replacement of the procedure by SB-2026-07.`,
  },
  {
    id: 'DOC-sb-2026-07',
    title: 'Service bulletin SB-2026-07: PureAir 300 S2 error and stuck air quality reading',
    body: `## Bulletin details
Bulletin number: SB-2026-07. Effective date: 3 August 2026. Product: Northstar PureAir 300 (serial numbers PA300-24 and PA300-25). This bulletin replaces the particle sensor calibration procedure of 2025 (DOC-pureair-sensor-calibration-2025). Support staff must use this bulletin for every S2 error and every stuck air quality reading on a PureAir 300.

## Symptom
The display shows S2, or the air quality number stays at the same value for hours and does not react to cooking, opening a window or vacuuming.

## Cause
Investigation of returned units in July 2026 showed two causes. First, dust collects in the sensor dust trap behind the sensor opening, which the manual's swab cleaning does not reach. Second, the button recalibration of 2025 stores a wrong baseline when the room air is not clean, and the reading then freezes. Units that were recalibrated with the old procedure are often affected.

## Do not use the button recalibration
Do not ask customers to hold Mode and Fan to calibrate the sensor. The sensor calibration of 2025 is withdrawn for all PureAir 300 units, and so is any other button recalibration.

## New procedure for customers
1. Clean the sensor opening with a dry cotton swab as described in the PureAir 300 manual.
2. Clean the dust trap: switch off and unplug, open the sensor cover on the right side, pull out the small grey dust trap by its tab, tap it out and brush it with a soft brush. Push it back until it clicks.
3. Reset the sensor to its factory baseline: keep the purifier unplugged for 60 seconds, then hold the Power button while plugging it in, and keep holding for 10 seconds until the display shows "rS".
4. Let the purifier run on Auto for 30 minutes. The reading then reacts normally to changes in the room.

## If S2 remains
If S2 or a frozen reading remains after the factory reset, the particle sensor module (part PA3-PS-04) is faulty. It is replaced by the service centre only, after courier pickup. For units within the 24-month warranty the replacement is covered. Open a service case with the note "SB-2026-07 steps completed".

## Note for staff
Cases resolved before this bulletin with the manual's cleaning steps alone remain valid. For new reports, always follow this bulletin.`,
  },
  {
    id: 'DOC-pureair-filter-care',
    title: 'PureAir filters: replacement and care',
    body: `## Which filter fits which purifier
- PureAir 300 and PureAir 500 Smart: HEPA H13 Filter (PureAir 300/500), product PRD-AIR-5, EUR 49. It combines a HEPA H13 layer with activated carbon.
- PureAir 200: PureAir 200 filter, part PA2-FLT-01.
- BreezePure Mini and the discontinued PureAir 100 use their own filters, listed in DOC-parts-compatibility.
Filters are consumables. They are not covered by the warranty beyond defects present at delivery (DOC-warranty-exclusions).

## When to replace the filter
The filter light turns yellow when about 10 percent of the filter life is left and red when the filter is used up. In normal homes this is every 6 to 12 months. Replace earlier if the purifier smells of smoke or cooking even after running on high speed for an hour; the carbon layer is then saturated.

## How to replace the filter
1. Switch off and unplug the purifier.
2. Open the back cover by pressing the two clips at the top.
3. Pull the old filter out by its tab and remove the plastic wrap from the new filter.
4. Insert the new filter with the tab facing out and close the cover. If the cover is not closed, the purifier shows F1.
5. Plug in, switch on and hold the Filter button for 3 seconds to reset the indicator (on the PureAir 500 Smart this can also be done in the app).

## Pre-filter care
The grey mesh pre-filter on the front of the filter catches hair and large dust. Vacuum it every two weeks with a soft brush. The pre-filter is washable: rinse it in lukewarm water and let it dry completely before refitting. Never wash the HEPA filter itself.

## Old filters
Put the used filter in a bag before disposal to keep the dust in. Filters belong in general household waste.

## Effect on the sensor
A full filter does not cause the S2 error. S2 is a particle sensor fault; see the PureAir 300 manual and service bulletin SB-2026-07.`,
  },
]
