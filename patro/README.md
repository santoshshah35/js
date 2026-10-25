# Patro

A Nepali Bikram Sambat calendar for the browser, inspired by apps like Hamro
Patro. Not affiliated with Hamro Patro.

- Month view in Bikram Sambat with the Gregorian date on every day,
  2000–2100 BS (1943–2044 AD)
- The next festival under the header; tap it for the list of upcoming events
- Tithi, paksha and lunar month for each day, computed for Kathmandu
- Festivals set by the lunar calendar: Dashain, Tihar, Chhath, Teej, Holi,
  Janai Purnima, Shivaratri, Buddha Jayanti and more
- Rashifal for all twelve rashis: daily and weekly from the Moon's transit,
  monthly from the Sun's
- Exchange rates from Nepal Rastra Bank with a currency calculator, gold and
  silver prices from FENEGOSIDA, and petrol, diesel, kerosene and LPG prices
  from Nepal Oil Corporation (loaded by the Android app; see below)
- BS ↔ AD date converter
- Fixed-date national days (New Year, Republic Day, Constitution Day, ...)
- Bottom menu: Calendar, Rashifal, Dates, Exchange, Fuel, More; swipe left
  or right to move between them
- Android home-screen widget: today's date, tithi and the next festival
- Back button leaves the app (closing the settings sheet first if open)
- Notices and ads managed by an admin in `content/feed.json`, with no app
  update needed (see `content/README.md`)
- Nepali and English; theme follows the phone, or set Light or Dark under More

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

- `lib/bs-data.js`: month lengths. 2000–2083 BS are the published calendars,
  from `nepali-date-converter` (MIT) checked against `bikram-sambat`
  (Apache-2.0). 2084–2100 have no official calendar yet; they are computed
  by `lib/surya.js` and the app labels them as estimates.
- `lib/surya.js`: Surya Siddhanta sankrantis, which is how Nepal's calendar
  places its months. Each month starts on the day of its sankranti, except
  that a night-time Karka sankranti counts for the day before (1 Shrawan)
  and a Makara sankranti after sunset for the day after (1 Magh). Fitted to
  2000–2060, it reproduces 272 of the 276 months of 2061–2083 it never saw;
  fitted to all years, 1002 of 1008. Its 2084–2086 match
  `nepali-date-converter` exactly. Every miss had its sankranti within
  about 25 minutes of the day boundary, so an estimated month can start a
  day off. When Nepal publishes a new year, add it and run
  `node tools/project-bs.js`.
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
- `lib/upcoming.js`: everything on a day, and the event days coming up.
- `lib/rashifal.js`: the Moon's sidereal sign at sunrise and the house it
  occupies from each rashi; houses 1, 3, 6, 7, 10, 11 read as favourable,
  4, 8, 12 as unfavourable, 2, 5, 9 as mixed.
- `lib/rates.js`: the NRB forex API and the FENEGOSIDA home page, with the
  last good result kept for offline use. FENEGOSIDA and Nepal Oil
  Corporation have no API, so their prices are read from the page text or
  price table; if a site changes its layout the app shows a link to the site
  instead of a wrong number, with the start of the page text so the layout
  can be fixed. When NRB can't be reached (its site refuses some networks,
  including many outside Nepal) the app falls back to market mid-rates from
  the free fawazahmed0/currency-api dataset and labels them as such. The
  currency calculator uses the NRB buying
  rate for foreign → NPR and the selling rate for NPR → foreign.
- `lib/feed.js`: checks the admin feed. Malformed entries, non-https links
  and entries outside their dates are dropped; the Android app may only
  fetch it from this repository on raw.githubusercontent.com.
- `ui/`: one file per screen (`calendar`, `upcoming`, `rashifal`,
  `converter`, `markets`) on top of `core.js` (shared state, text,
  helpers); `shell.js` runs the bottom menu, settings sheet and start-up.

## Not included yet

- Government public holidays, which are announced each year.

In a year when a tithi changes close to the time a festival is judged, the
festival can land a day off from a printed panchang.
