import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
export default function Upgrade() {
  const purchaseURL = process.env.NEXT_PUBLIC_CLIENTLANE_PURCHASE_URL;
  return (
    <main className="recovery-page">
      <Card>
        <CardHeader>
          <CardTitle>More room with Clientlane Pro</CardTitle>
          <CardDescription>
            $199 once. Run it locally, with your own data.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <ul className="flex flex-col gap-2">
            <li>Multiple named pipelines with the six familiar deal stages</li>
            <li>Custom text, number, date, yes/no, and choice fields</li>
            <li>Saved searches and filters</li>
            <li>Pipeline reports and deal value summaries</li>
            <li>Rules that create follow-ups when deals enter stages</li>
          </ul>
          <p>
            Upgrade by opening your existing local data in Pro, or restore a
            Lite backup into a new Pro account. See the included getting-started
            guide.
          </p>
          {purchaseURL ? (
            <Button asChild>
              <a href={purchaseURL}>Get Pro · $199</a>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              The Pro release is being prepared. Checkout is not open in this
              release candidate.
            </p>
          )}
          <Button variant="outline" asChild>
            <Link href="/workspace">Back to workspace</Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            One workspace per account. Shared team workspaces, email sending,
            and cloud hosting are outside this release.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
