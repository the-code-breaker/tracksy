# Tracksy 0.3 artwork

Generated with the built-in image generation tool for the reference-led mobile redesign. These are decorative illustrations, not user group photos or records. The launcher logo is code-native SVG, rasterized with Sharp.

## Travel hero

Output: `apps/mobile/assets/illustrations/trip-friends.png` (1774 × 887).

Prompt brief: wide 2:1 editorial hand-painted illustration of four adult friends seen from behind, with backpacks, at a stone overlook above a turquoise lake. Mediterranean village, emerald mountains, a peach sun, calm navy and teal details. No text, logos, UI or device frames. Use a clean, welcoming illustration suitable for the Tracksy shared-expenses mobile sign-in screen.

## Lake vignette

Output: `apps/mobile/assets/illustrations/lake-vignette.png` (1536 × 1024, transparent background).

Prompt brief: small 3:2 hand-painted vignette of a cream cottage with peach roof, cypress and pine trees, a turquoise lake and two mountains. Emerald, teal and navy palette, clean soft edges fading to transparency. No text, people, logos or UI. Suitable as a compact decorative greeting illustration on a white mobile dashboard.

## Usage

The sign-in and group header use the travel hero with responsive cropping. The home greeting uses the transparent lake vignette. Balance-card scenery uses lightweight native SVG. No remote image-generation service is called from the app.

The Play feature graphic is code-native SVG (`artifacts/play-store/feature-0.3.svg`) rasterized to 1024 × 500 PNG by `scripts/prepare-play-redesign.mjs`. It shares the emerald mark and includes no user records. Public screenshots show only unsaved group-creation fields and the actual currency bottom sheet.
