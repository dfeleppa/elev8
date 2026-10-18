import { memberRequest } from "@/features/member/client-adapter";
import { reservationsPOST, reservationsDELETE } from "@/features/member/reservations-handlers";
export const dynamic = "force-dynamic";
export function POST(request: Request) { return memberRequest(request, reservationsPOST, "reservation"); }
export function DELETE(request: Request) { return memberRequest(request, reservationsDELETE, "reservation"); }
