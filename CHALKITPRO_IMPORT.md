# ChalkItPro Import via Claude Chrome Extension

Lets you scrape workouts from `https://app.chalkitpro.com/editprogramming` using
the Claude Chrome extension and POST them into the Elev8 `Fitness` track.

## API endpoint

`POST /api/programming/chalkitpro-import`

- **Auth:** uses your logged-in NextAuth session (cookie). You must be signed
  into the Elev8 app in another tab in the same browser. Requires `admin` or
  `owner` role.
- **Source flag:** all inserted rows get `workout_blocks.source = 'chalkitpro'`
  so they're easy to find / undo later.
- **Day upsert:** rows in `programming_days` are upserted on
  `(track_id, day_date)`, so re-running for the same day is safe (you'll get
  duplicate blocks though — see "Re-running" below).

### Request body

```json
{
  "trackName": "Fitness",
  "dryRun": false,
  "days": [
    {
      "date": "2026-05-26",
      "title": "Optional day title",
      "notes": "Optional day notes",
      "blocks": [
        {
          "blockType": "warmup",
          "title": "General Warmup",
          "description": "2 rounds:\n- 200m row\n- 10 air squats\n- 10 PVC pass-throughs",
          "scoreType": "none",
          "blockOrder": 0
        },
        {
          "blockType": "lift",
          "title": "Back Squat",
          "description": "5x5 @ 75% 1RM, rest 2:00",
          "scoreType": "none",
          "blockOrder": 1
        },
        {
          "blockType": "workout",
          "title": "Fran",
          "description": "21-15-9 for time:\n- Thrusters (95/65)\n- Pull-ups",
          "scoreType": "time",
          "rounds": 1,
          "rep_scheme": "for_time",
          "time_domain_seconds": 600,
          "stimulus": ["barbell_cycling", "gymnastics_pulling"],
          "modality": ["weightlifting", "gymnastics"],
          "equipment": ["barbell", "rig"],
          "blockOrder": 2
        },
        {
          "blockType": "cooldown",
          "title": "Cooldown",
          "description": "5 min easy bike + hip flexor stretch",
          "scoreType": "none",
          "blockOrder": 3
        }
      ]
    }
  ]
}
```

### Field reference

- `blockType` (required) — one of `warmup`, `lift`, `workout`, `cooldown`
- `scoreType` (default `none`) — one of `time`, `reps`, `rounds_reps`,
  `distance`, `calories`, `none`
- `blockOrder` (optional) — if omitted, blocks are appended after existing
  blocks for that day
- `rep_scheme` (optional) — `amrap | for_time | emom | intervals | sets_reps | chipper | other`
- `time_domain_seconds` (optional) — integer seconds (cap time, EMOM length, etc.)
- `stimulus`, `modality`, `equipment`, `tags` — arrays of strings

### Response

```json
{
  "trackId": "3304e324-4c30-45c1-b246-c86d953b4725",
  "trackName": "Fitness",
  "dryRun": false,
  "importedCount": 4,
  "skippedCount": 0,
  "imported": [
    { "date": "2026-05-26", "blockType": "warmup", "title": "General Warmup", "blockId": "..." }
  ],
  "skipped": []
}
```

## Chrome extension prompt

Paste this into the Claude Chrome extension while you're on the ChalkItPro
programming page. Make sure you also have a tab open and signed into Elev8
(same browser) so the session cookie is sent.

> You're on the ChalkItPro programming editor. I need you to:
>
> 1. Scrape the visible workout(s) on this page. Look for date headers and
>    blocks labeled warmup / lift / strength / workout / WOD / metcon / cooldown.
> 2. Map each block to one of these `blockType`s: `warmup`, `lift`, `workout`,
>    `cooldown`. (Treat "strength" as `lift`, "WOD"/"metcon"/"conditioning" as
>    `workout`, "mobility"/"recovery" as `cooldown`.)
> 3. Set `scoreType` based on context: `time` for "for time" workouts, `reps`
>    for AMRAPs scored by reps, `rounds_reps` for AMRAPs with rounds+reps,
>    `distance` / `calories` where obvious, otherwise `none`.
> 4. Preserve the original instructional text verbatim in `description`
>    (keep linebreaks). Don't reformat the workout.
> 5. POST the result to my local app:
>
>    ```
>    POST http://localhost:3000/api/programming/chalkitpro-import
>    Content-Type: application/json
>    (cookies from elev8 tab will be sent automatically)
>    ```
>
>    Body shape:
>    ```json
>    { "trackName": "Fitness", "dryRun": true, "days": [ ... ] }
>    ```
>
> 6. Start with `"dryRun": true` and show me the parsed result. I'll tell you
>    when to re-send with `"dryRun": false`.
>
> If you find multiple days on the page, include them all in `days[]`.

Replace `http://localhost:3000` with your deployed URL (e.g.
`https://app.elev8.com`) when running against production.

## Re-running / undo

The endpoint upserts the *day* but **inserts** new blocks each call, so calling
twice for the same date produces duplicates. To wipe a bad import:

```sql
-- Find what got imported
select id, day_date, block_type, title, created_at
from workout_blocks wb
join programming_days pd on pd.id = wb.programming_day_id
where wb.source = 'chalkitpro'
  and pd.day_date >= '2026-05-26'
order by pd.day_date, wb.block_order;

-- Delete a specific day's chalkitpro-sourced blocks
delete from workout_blocks
where source = 'chalkitpro'
  and programming_day_id in (
    select id from programming_days where day_date = '2026-05-26'
  );
```
