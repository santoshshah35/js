# Patro

A Nepali Bikram Sambat calendar for the browser, inspired by apps like Hamro
Patro. Not affiliated with Hamro Patro.

- Month view in Bikram Sambat with the Gregorian date on every day
- Tithi and paksha for each day, computed for sunrise in Kathmandu
- BS ↔ AD date converter
- Fixed-date national days (New Year, Republic Day, Constitution Day, ...)
- Nepali and English, light and dark themes, Nepal Time clock

## Run

No build step and no dependencies. Open `index.html` directly, or serve the
folder:

```bash
npm start   # http://localhost:8080
npm test    # Node 18+
```

## How it works

- `lib/bs-data.js`: month lengths for 2000–2083 BS, taken from
  `nepali-date-converter` (MIT) and checked against `bikram-sambat`
  (Apache-2.0). The two disagree from 2084 BS, which has no official calendar
  yet, so the app stops at 2083 (April 2027).
- `lib/bs.js`: conversion between the two calendars. Today's date is
  always Nepal's date (UTC+05:45), whatever the viewer's time zone.
- `lib/tithi.js`: Sun and Moon positions from Meeus, *Astronomical
  Algorithms*, chapters 25 and 47, with sunrise from the NOAA solar method.
  New and full moons land within a minute or two of published times.
- `lib/events.js`: observances on a fixed BS or AD date.

## Not included yet

- Festivals set by the lunar calendar (Dashain, Tihar, Holi, Teej, ...).
  These need the lunar month, including leap months, on top of the tithi.
- Government public holidays, which are announced each year.
- Live data such as rashifal, forex or gold prices.

A tithi that changes within minutes of sunrise can differ from a printed
panchang.
