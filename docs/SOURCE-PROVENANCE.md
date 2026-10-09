# Lite source provenance

This public distribution contains the original Clientlane database, authentication, recovery, import/export and CRM behavior, plus a separately authored Lite screen composition and theme under the MIT license.

The commercial CRM screen (`src/components/crm-app.tsx` in the private development repository), its styles, Pro implementations, and the Scalar marketing page and screenshot are replaced or excluded by the release packager. The public package contains no supplied Admin Kit or Scalar source files, downloaded archives, reference folders, business data, secrets, or Git history.

`src/components/ui/*` in this bundle was freshly installed from the official **@shadcn registry**, radix-vega style, using **shadcn CLI 4.21.4 on October 8, 2026 (America/Chicago)**. The shared shadcn CSS utilities were inlined using the official `shadcn eject` command. Apart from formatting, the only component source adjustment is the `cn` utility import, redirected to the project's equivalent local utility. The official shadcn/ui MIT notice is preserved at `licenses/shadcn-ui.txt`. These primitive sources do not come from the purchased kit. The release manifest records checksums of the delivered files.

Shared forms, portable backup/recovery screens, sample fixtures, and application behavior are original Clientlane code. They compose upstream open-source primitives. The Lite navigation, table and board arrangement, local landing/sign-in pages, and CSS were authored separately for this package; the paid dashboard and Scalar marketing composition are not converted into public Lite by renaming or restyling them.

Dependencies retain their own licenses in their packages. The source ZIP does not vendor node_modules. Source inspection and an isolated build of this generated bundle are required before each public release. Do not publish the private development repository or its Git history.
