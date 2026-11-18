import { eq } from "drizzle-orm";
import { db, profile } from "@/db";
import { getUser } from "@/lib/session";

// Só o dono do currículo consegue baixá-lo.
export async function GET() {
  const user = await getUser();
  if (!user) return new Response("Não autorizado.", { status: 401 });
  const [me] = await db.select({ pdf: profile.resumePdfBase64 }).from(profile).where(eq(profile.userId, user.id));
  if (!me?.pdf) return new Response("Nenhum currículo.", { status: 404 });
  return new Response(Buffer.from(me.pdf, "base64"), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="curriculo.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
