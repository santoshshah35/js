# Patro

A Nepali Bikram Sambat calendar for the browser, inspired by apps like Hamro
Patro. Not affiliated with Hamro Patro.

- Month view in Bikram Sambat with the Gregorian date on every day
- Tithi, paksha and lunar month for each day, computed for Kathmandu
- Festivals set by the lunar calendar: Dashain, Tihar, Chhath, Teej, Holi,
  Janai Purnima, Shivaratri, Buddha Jayanti and more
- Daily rashifal for all twelve rashis, from the Moon's transit
- Foreign exchange rates from Nepal Rastra Bank, gold and silver prices from
  FENEGOSIDA (in the Android app; see below)
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

## Android app

`android/` wraps the same files in a small native app (52 KB). Its native
code fetches the forex and gold rates, which a browser page can't load
because of CORS (the source sites don't allow it). Build it on
Debian/Ubuntu with no Android Studio or SDK download:

```bash
sudo apt-get install aapt dalvik-exchange zipalign apksigner android-sdk-platform-23
android/build-apk.sh   # writes android/build/patro.apk
```

The first build creates a signing key in `android/keystore/`, which is not
committed. Keep it: Android only installs an update signed with the same key.

## iPhone

An iOS app has to be built and signed on a Mac with Xcode. Instead, Patro
installs from Safari as a web app: serve this folder over HTTPS (GitHub
Pages works), open it on the iPhone, then Share → Add to Home Screen. It
gets its own icon, opens full screen and works offline (`sw.js`). Forex and
gold rates show links to their sources there, since iOS Safari blocks the
requests too.

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
- `lib/rashifal.js`: the Moon's sidereal sign at sunrise and the house it
  occupies from each rashi; houses 1, 3, 6, 7, 10, 11 read as favourable,
  4, 8, 12 as unfavourable, 2, 5, 9 as mixed.
- `lib/rates.js`: the NRB forex API and the FENEGOSIDA home page, with the
  last good result kept for offline use. FENEGOSIDA has no API, so its
  prices are read from the page text; if the site changes its layout the
  app shows a link to the site instead of a wrong number.

## Not included yet

- Government public holidays, which are announced each year.

In a year when a tithi changes close to the time a festival is judged, the
festival can land a day off from a printed panchang.
