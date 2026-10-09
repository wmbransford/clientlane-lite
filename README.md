# Clientlane

Your local CRM for people, companies, deals, notes, and follow-ups.

[Explore the product and demos](https://clientlane-crm.vercel.app) · [Lite source and releases](https://github.com/wmbransford/clientlane-lite)

This is the **1.0.0-rc.1 release candidate**. The edition is recorded in `RELEASE-MANIFEST.json` and displayed inside the app. Use this release candidate for evaluation and keep backups before adding important data.

## First launch

Install **Node.js 22.13 or newer** from https://nodejs.org (choose an LTS release). Extract the entire ZIP to a folder you can keep, then:

- **macOS:** open `Start Clientlane.command`.
- **Windows:** open `Start Clientlane.cmd`.
- **Linux:** run `sh start-clientlane.sh` in a terminal.

The first launch downloads dependencies and builds the application. It can take a few minutes and needs an internet connection. Later launches use the installed dependencies. Keep the terminal open while using the app; press Ctrl+C to stop it. Open http://localhost:4318 if a browser does not open automatically. If a launcher loses its executable permission after extraction, run `sh start-clientlane.sh` from the folder. Do not disable your operating system's security protections.

Clientlane runs in your browser and binds to this computer's loopback interface. This package is not a signed native desktop application. The shared launcher and Lite distribution passed automated installation, build, account creation, and persistence checks on macOS, Windows, and Linux with Node 24. Pro installation and browser workflows were additionally verified on macOS. SQLite requires a compatible native Node module; if no prebuilt binary exists for your platform, the installer may need the platform's C/C++ build tools.

For terminal users:

```sh
npx --yes pnpm@12.9.1 install --frozen-lockfile
npx --yes pnpm@12.9.1 setup
npx --yes pnpm@12.9.1 build
npx --yes pnpm@12.9.1 start
```

Create your local account at `/login?mode=signup`. Use at least 12 characters for your password. Each account owns a separate workspace; accounts on the same installation do not share records. Sample data is fictional and optional under Settings in an empty workspace. `/demo` runs entirely in memory and resets on refresh.

## Your first working day

1. Add a company and a contact. Link the contact to its company.
2. Add a deal with its amount in USD, contact, company, and expected close date.
3. Move it through New lead, Qualified, Proposal, Negotiation, Won, or Lost.
4. Add a linked note or dated follow-up. Mark completed follow-ups as done.
5. Download a workspace backup from Settings.

CSV contact import accepts `name,email,phone,role,status`. Status is Lead, Customer, or Partner. Limit: 1,000 rows / 1 MB. Import adds records without deduplication or company links; export produces the same contact columns. CSV exports escape formula-like cells. Full workspace backups preserve links and all record types.

## Pro

Pro adds up to 20 named pipelines using the six deal stages, 50 custom fields across contacts/companies/deals, 30 saved views, and 30 follow-up rules. Configure these in Customize. Fields support text, numbers, dates, yes/no, and choice lists. A rule creates a follow-up when a new or edited deal enters its selected pipeline and stage. It does not email anyone, run on a timer, or retroactively change existing deals. Pausing a rule stops future matches. Entering a stage again can create another task.

Reports filter deals by pipeline and their creation date. Deal values are entered amounts, not invoiced revenue. Win rate is won deals divided by won plus lost deals for the selected cohort; archived deals are excluded. Team workspaces, email/calendar integrations, hosted accounts, and PostgreSQL are outside v1.

## Backups, restore, and upgrade

**Workspace backup:** Settings → Download workspace backup. The JSON includes active and archived records, relationships, settings, custom values, the workspace name, and the latest 40 activity entries. It excludes accounts/passwords/recovery keys. Keep it private. Restore previews the file, requires an empty workspace including its archive, assigns new record IDs, and preserves internal relationships. Up to 20 MB / 10,000 total records. Existing version 1 backups and original unversioned exports are accepted; old exports cannot recover records they never contained. Pro configuration requires Pro when restoring.

**Full installation backup:** stop Clientlane, then copy `.data/` and `.env.local` together into private backup storage. These include accounts and authentication. If you configured `DATABASE_PATH`, back up that database location instead. Database storage is not application-encrypted; use your operating system's account and disk protection.

**Lite → Pro:** make both backups first, stop Lite, extract Pro into a new folder, and copy `.data/` and `.env.local` from Lite into Pro before its first launch. Keep the original Lite folder untouched as a backup. Pro opens the same accounts and data and adds configuration without replacing records. If your environment uses an absolute `DATABASE_PATH`, point the new installation at the copied database, not the original. Alternatively, create a new local account in Pro and restore a Lite workspace JSON backup. Do not reopen a Pro database in an older Lite release after using paid fields or pipelines; use your pre-upgrade backup for rollback.

**Updates:** use a new extracted folder and the same backup/copy procedure. Never overwrite or delete `.data/` or `.env.local` to troubleshoot an update. Clientlane has no automatic updater in this release.

## Account recovery

In Settings, create a recovery key after entering your current password. Save it privately, outside this installation. It is displayed once and works once. A new key replaces the previous key. At `/recover`, enter the account email, saved key, and a new password. Successful recovery invalidates every existing session. Create another key afterward.

If you lost the key but own this computer and installation, run `npx --yes pnpm@12.9.1 account:recover` from the Clientlane folder. It asks for the account email twice and prints a replacement single-use key in your private terminal. Someone who can read and modify your installation files has administrative control over local data; protect that access.

## Troubleshooting

- **Port in use:** close the other Clientlane terminal before starting another copy. Only one default installation can use port 4318 at a time.
- **Stale edit:** refresh the workspace, review the latest record, and save again. Version checks intentionally reject conflicting edits.
- **Cannot archive:** reassign or archive linked active notes, tasks, deals, or contacts first. Restore archived parent records before their children.
- **Cannot remove a Pro field/pipeline:** active and archived records must stop using it first. Clear custom values; move deals to another pipeline. Remove views and rules referring to a pipeline before removing it.
- **Forgot password:** use a saved recovery key or the installation-owner recovery command above. There is no email reset service.
- **Restore refused:** create a new account with an empty workspace. Restore does not replace existing records.

For a reproducible report, include your edition/version, operating system, Node version (`node --version`), steps, and error text. Never include your database, customer records, recovery keys, `.env.local`, or passwords in a public issue.

## Development and license

`pnpm dev` starts the development server. `pnpm test`, `pnpm typecheck`, and `pnpm build` check the application. Review the included `LICENSE` and third-party notices. Lite is a separate open-source distribution; Pro application code is distributed under its commercial license. The Scalar marketing website is not part of either CRM download.
