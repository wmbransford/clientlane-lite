import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
export default function Home() {
  return (
    <main className="lite-auth">
      <Card>
        <CardHeader>
          <CardTitle>Clientlane Lite</CardTitle>
          <CardDescription>
            Your people, opportunities, and next steps. Stored on your computer.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button asChild>
            <Link href="/workspace">Open workspace</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/login?mode=signup">Create a local account</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/demo">Explore fictional demo</Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            Free local CRM. No subscription. Use Settings to back up and restore
            your data.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
