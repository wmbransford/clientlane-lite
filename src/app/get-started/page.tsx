import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
export default function GettingStarted() {
  const githubURL = process.env.NEXT_PUBLIC_CLIENTLANE_GITHUB_URL || "https://github.com/wmbransford/clientlane-lite/releases";
  const purchaseURL = process.env.NEXT_PUBLIC_CLIENTLANE_PURCHASE_URL;
  return (
    <main className="recovery-page">
      <Card>
        <CardHeader>
          <CardTitle>Make Clientlane yours.</CardTitle>
          <CardDescription>A local CRM in a few steps.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <ol className="flex flex-col gap-4 list-decimal pl-5">
            <li>Download Lite from GitHub, or purchase the Pro ZIP.</li>
            <li>
              Install Node.js LTS from{" "}
              <a className="underline" href="https://nodejs.org/">
                nodejs.org
              </a>
              . Clientlane requires Node 22.13 or newer.
            </li>
            <li>
              Extract the whole ZIP. Open the included launcher for your
              operating system. First launch needs internet access and a few
              minutes to install and build.
            </li>
            <li>
              Keep the terminal open, visit localhost:4318, and create your
              local account.
            </li>
            <li>
              Open Settings to create a recovery key and download a workspace
              backup.
            </li>
          </ol>
          {githubURL ? (
            <Button asChild>
              <a href={githubURL}>Download free Lite</a>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              The public Lite release is being prepared.
            </p>
          )}
          {purchaseURL ? (
            <Button variant="outline" asChild>
              <a href={purchaseURL}>Get Pro · $199 once</a>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pro checkout is not open in this release preview.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Automated setup and persistence checks pass on macOS, Windows,
            and Linux with Node 24. This is a release candidate. Your
            accounts and CRM data live on your installation. The online demo
            uses fictional data and resets on reload.
          </p>
          <Button variant="ghost" asChild>
            <Link href="/">Back to the product</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
