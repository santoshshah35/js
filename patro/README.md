# Patro

A Nepali Bikram Sambat calendar for the browser, inspired by apps like Hamro
Patro. Not affiliated with Hamro Patro.

- Month view in Bikram Sambat with the Gregorian date on every day
- Tithi, paksha and lunar month for each day, computed for Kathmandu
- Festivals set by the lunar calendar: Dashain, Tihar, Chhath, Teej, Holi,
  Janai Purnima, Shivaratri, Buddha Jayanti and more
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
- `lib/lunar.js`: lunar months, named by the sankranti that falls in them
  (Lahiri ayanamsa), with adhik months detected, and the festival dates.
  Each festival is judged at its traditional time of day: sunrise for most,
  afternoon for Vijaya Dashami, evening for Holi and Chhath, midnight for
  Shivaratri. The tests check 21 festival dates observed in Nepal in 2024
  and 2025, and that every BS month in the table starts at its sankranti.
- `lib/events.js`: observances on a fixed BS or AD date.

## Not included yet

- Government public holidays, which are announced each year.
- Live data such as rashifal, forex or gold prices.

In a year when a tithi changes close to the time a festival is judged, the
festival can land a day off from a printed panchang.
