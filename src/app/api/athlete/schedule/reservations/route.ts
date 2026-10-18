import { requireRequestUserContext } from "@/lib/member";
import { reservationsPOST, reservationsDELETE } from "@/features/member/reservations-handlers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return reservationsPOST(request, await requireRequestUserContext(request));
}
export async function DELETE(request: Request) {
  return reservationsDELETE(request, await requireRequestUserContext(request));
}
