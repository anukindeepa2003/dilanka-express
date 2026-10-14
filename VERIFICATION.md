# Prototype verification

Verified locally on 13 October 2026. All records used in testing were fictional.

## Automated checks

- TypeScript validation passed.
- Eleven service tests passed: layout integrity; competing seat holds; overnight intermediate boarding dates; atomic multi-seat acquisition; hold expiry; fare tampering; idempotent guest confirmation and private retrieval; cancellation and seat release; wrong-trip/repeat/racing check-in; closed/blocked inventory; QR decoding and Sinhala/Tamil PDF generation.
- Next.js production compilation passed.
- HTTP acceptance smoke passed: authentication, administrator/conductor separation, rejected unauthorised requests, guest confirmation, private ticket protection, QR verification without passenger contacts, PDF download, prevention of editing/blocking booked seats, and repeat check-in rejection.

## Browser acceptance

- Reviewed desktop home, route search, seat selection and booking confirmation.
- Booked two seats as fictional passengers, downloaded the two-page ticket PDF, and visually inspected its rendered output.
- Recovered the booking using its reference and private code.
- Opened a QR destination and observed “Demo ticket verified”, with the correct route, date and seat.
- Confirmed booked seats were unavailable on a subsequent departure view.
- Reviewed the interface at 360px mobile width and corrected route-card text clipping and seat-selection controls.

## Boundaries

- No actual payment, SMS/email delivery or public deployment occurred.
- Hosted PostgreSQL and Vercel require provider configuration and hosted acceptance testing. Transaction tests currently run on embedded PostgreSQL (PGlite).
- QR encoding/decoding and validation were tested; a physical phone camera scan over deployed HTTPS remains to be tested. Localhost links cannot be opened by a separate phone.
- Language switching currently translates navigation/search/booking-step labels; English descriptive and staff copy still needs full translation.
- Fares, future schedules, vehicle assignments, boarding points and policies remain clearly labelled sample assumptions pending client approval.

See README.md for setup, staff credentials location and the client demonstration script.

## Media and map update

- Fourteen tests pass, including new geographic coverage and highway direction/corridor checks.
- TypeScript validation passes.
- Updated Next.js production build passes.
- Browser-tested gallery navigation, modal opening/closing and company video playback; the embedded short film reached its 10.68-second end.
- OpenStreetMap tiles rendered with attribution after setting the tile image origin referrer. Stop selection updated the selected town and map focus; Show full route restored the overview.
- Reviewed the expanded route map at 390px width: map/stop panels stack, booking controls remain visible and the document has no horizontal overflow.

## Editorial landing page update

- TypeScript validation and Next.js production build pass.
- Reviewed the enhanced fleet hero and destination photography on desktop and at 360px mobile width. No horizontal document overflow was observed.
- Verified category filtering (Coast shows Matara; All journeys restores all four destinations), FAQ expansion and search-section anchor navigation.
- Submitted Colombo → Ampara from the new landing-page search and observed three departures for the selected date.
- Booking service logic was unchanged; this UI update did not require rerunning the earlier database test suite.
- Image sources, saved assets, AI-edit disclosure and final image prompt are recorded in `research/LANDING_DESIGN.md`.

## Interior-page editorial redesign

- TypeScript validation, all 14 service/map tests, and the Next.js production build pass.
- Routes, fleet, company, contact, help, departure search, seat selection, passenger/review steps, private ticket recovery, boarding passes, public QR status, and staff screens now share the landing page's ivory/forest/gold design.
- Browser-tested route town search, Expressway filter (three matching corridors), map expansion/highway label, and the fleet's numbered seat-layout disclosure.
- In the production preview, searching help for `luggage` returned exactly one question and its expanded answer used the current catalogue's 15 kg demo value.
- Completed a guest booking in the browser with fictional details: selected one seat, acquired a hold, entered passenger details, reviewed and confirmed, saw the per-seat QR, downloaded the PDF, and recovered the same booking using reference plus private code. Public QR verification showed the valid demo status without contacts. Cancelled the newly created demo booking after the checks and observed the cancelled ticket state.
- Reviewed public page layouts at 360 px. Routes, fleet, about, contact, help, recovery, search, booking and ticket screens had no horizontal document overflow. The mobile ticket QR rendered at 175 px, and mobile seat selection exposed a persistent total/continue bar. The selected-seat hover and dark-summary fare contrast were corrected.
- Used the existing authenticated local staff session to review Overview, Bookings, Departures, Check-in, Fleet & routes, and Settings at mobile width. Each tab stayed within the document width; tables scroll inside their own containers. Also visually reviewed the separate unauthenticated welcome form and desktop dashboard.
- Kept production preview running at `http://localhost:3000`. Mutations use this configured origin; the alternative `127.0.0.1` origin is rejected by the existing origin guard. No guard was weakened.
- Page-by-page sources and research limitations are recorded in `research/INTERIOR_DESIGN.md`. No payment integration, hosted-database connection, live GPS, message delivery or public deployment was added.

## Larger reading text

- Increased small text across the shared, landing and interior styles: desktop intro copy 14 → 18 px, 13 px body text → 16 px, 12 px labels → 15 px, with smaller metadata also increased. Existing large editorial headings retain their scale.
- Adjusted tablet navigation to collapse below 1001 px so larger link labels have room.
- Checked home, routes, fleet, contact, help, ticket recovery, results and booking at 360 px: no horizontal document overflow. Production build and its TypeScript check pass. Booking behaviour was unchanged.

## Navigation and dark appearance

- Production build and TypeScript validation pass after the shared header/theme update. Booking and database service code was unchanged.
- Reviewed light and dark header layouts, persistent current-page outlines, compact utility controls, and sticky positioning while scrolling.
- Theme choice survived navigation and reload. Switching theme during seat selection preserved the chosen seat. The bootstrap applies a stored preference, otherwise the system preference, before paint.
- Reviewed mobile menu opening, full-width boundaries, navigation-driven dismissal, Escape dismissal and focus returning to the menu button.
- Sinhala and Tamil headers fit at 1280 px. Tamil mobile menu labels fit at 320 px, including a wrapped booking action. Home, routes, fleet, about, contact, help, recovery, results and booking fit at 360 px without horizontal document overflow in dark mode.
- Inspected the existing demo boarding pass at mobile width: QR image retained a white background. Reviewed the dark public verification and authenticated staff overview. No real bookings or staff settings were changed for these checks.
- Sampled rendered text contrast on primary page types and corrected dark-mode search selects, landing utility links and metadata. Map tiles, photos and QR pixels are not filtered or inverted; print styling keeps boarding passes on white paper.
- Research, interaction details and scope are recorded in `research/NAVIGATION_AND_THEME.md`.

## Full Sinhala and Tamil content

- Added a shared bilingual translation catalogue, dynamic-message/status translations and explicit presentation-text calls across the public site, booking, ticket recovery, QR verification, media, maps and staff components. Passenger input and canonical booking/form values remain unchanged.
- Saved language preferences now also initialise server-rendered pages through a same-site cookie. Local fonts, translated native field errors, metadata and responsive wrapping support both scripts.
- Reviewed eight public page types at 360 px in each language, and Sinhala/Tamil headers at 1280 px in light/dark mode. Corrected a Tamil booking-review overflow and compacted navigation labels.
- A local QA booking covered Tamil search, Sinhala seat holding, switching languages without losing seats/passenger input, Tamil confirmation/PDF download, public QR verification and reference/code recovery. Cancelled only that QA booking afterwards to release its seat.
- Rendered Sinhala and Tamil PDF fixtures with Poppler and visually reviewed them. Replaced the old font shaper to fix its crash on Sinhala independent vowels; regression checks generate PDFs in all three languages.
- All 17 tests pass. The final production build and TypeScript validation pass. Reviewed the translated staff sign-in; authenticated staff actions were not exercised or changed during UI verification.
- See `research/LOCALIZATION.md` for catalogue conventions, technical boundaries and the local PDF QA fixture command.

## Local booking origin fix

- Fixed mutation requests being rejected when the browser uses `localhost:3000` but Next constructs its internal URL with the `127.0.0.1:3000` bind address. Origin validation now uses the incoming Host authority and the request protocol, falling back to the request URL only when Host is absent.
- No wildcard origins, forwarded-host trust, port equivalence or loopback-alias equivalence were added. Foreign origins, different ports/protocols, malformed authorities and opaque origins are rejected. Existing non-browser requests without Origin retain their previous behaviour.
- Verified the running API returns 200 for matching localhost/127.0.0.1 origins and 403 for a foreign site or another local port. In the browser, selected two seats on Ampara → Matara for 15 October 2026 and reached Passenger details with an active hold. Released the test hold through Back; no booking or passenger record was created.
- All 20 tests and TypeScript validation pass, including three origin regression tests. The development server remains running.
