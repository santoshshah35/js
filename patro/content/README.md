# Patro notices and ads

`feed.json` in this folder is read by every copy of the Patro app each time
it opens (and again if it has been in the background for 30 minutes). Edit
it here on GitHub and the change reaches phones without a new app.

## Editing on GitHub

1. Open `patro/content/feed.json` on github.com and click the pencil icon.
2. Add, change or remove entries in `items`.
3. Click **Commit changes**. Phones pick it up the next time Patro opens.

The app reads the file on the `main` branch first, then on
`claude/new-session-94tzzd`. Edit the copy on `main` once Patro is merged there.

A mistake can't break the app: an entry with a missing or wrong field is
skipped, and if the whole file is invalid the app keeps the last good copy.
Check the JSON with any online JSON validator before committing.

## Fuel prices

Nepal Oil Corporation's site blocks automated reading, so fuel prices are
entered here by hand when NOC announces a change. Edit `fuel.json` like
this (the numbers below are only an example of the format):

```json
{
  "effective": "2026-10-17",
  "prices": { "petrol": 174, "diesel": 157, "kerosene": 157, "lpg": 1910 }
}
```

`effective` is the AD date the prices took effect; prices are in rupees per
litre (LPG per cylinder) for the Kathmandu valley. Committing the file
updates the app within a few minutes. Leave a price `null` to hide it.

## Fields

| Field | Required | Meaning |
|-------|----------|---------|
| `id` | yes | Unique name, e.g. `"dashain-offer-2083"`. A closed banner stays closed for its id, so use a new id for a new campaign. |
| `slot` | yes | Where it shows: `"top"` (under the festival strip, on every screen), `"rashifal"`, `"forex"` or `"fuel"` (top of that screen). |
| `kind` | yes | `"notice"` (labelled सूचना) or `"ad"` (labelled विज्ञापन / Sponsored). |
| `title` | yes | `{ "ne": "...", "en": "..." }`, up to 120 characters. One language is enough; it is used for both. |
| `body` | no | Same shape, up to 400 characters. |
| `link` | no | `https://` address opened in the phone's browser. |
| `cta` | no | Link text, e.g. `{ "ne": "अर्डर गर्नुहोस्", "en": "Order now" }`. Defaults to "Learn more". |
| `image` | no | `https://` address of an image, shown on the left. Square or 4:3, under 200 KB. |
| `start`, `end` | no | `"YYYY-MM-DD"` (AD, Nepal date). Shown from `start` to `end`, both days included. |

At most 20 entries are read.

## Example ad

```json
{
  "id": "example-shop-tihar",
  "slot": "top",
  "kind": "ad",
  "title": { "ne": "तिहार विशेष छुट", "en": "Tihar special offer" },
  "body": { "ne": "सबै सामानमा २०% छुट।", "en": "20% off everything." },
  "link": "https://example.com/tihar",
  "cta": { "ne": "हेर्नुहोस्", "en": "See offer" },
  "image": "https://raw.githubusercontent.com/santoshshah35/js/main/patro/content/images/example.jpg",
  "start": "2026-11-01",
  "end": "2026-11-12"
}
```

To host an image, upload it to `patro/content/images/` and use its
`raw.githubusercontent.com` address as above.
