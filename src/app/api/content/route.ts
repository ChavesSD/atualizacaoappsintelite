import { route } from "@/lib/http";
import { publicContent } from "@/lib/content";

export const dynamic = "force-dynamic";

export const GET = route(async () => publicContent());
