import { NextRequest, NextResponse } from "next/server";
import { callEdgeFunction, visitorId } from "../edge";

const MAX_MESSAGE_LENGTH = 2000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const { message, email, website } = (await req.json()) as { message?: unknown; email?: unknown; website?: unknown };

    // Bots fill in this hidden field. Tell them it worked and send nothing.
    if (website) return NextResponse.json({ sent: true });

    const text = typeof message === "string" ? message.trim() : "";
    const address = typeof email === "string" ? email.trim() : "";
    if (!text || text.length > MAX_MESSAGE_LENGTH || address.length > 200 || (address && !EMAIL.test(address))) {
      return NextResponse.json({ error: "Invalid feedback" }, { status: 400 });
    }

    const res = await callEdgeFunction("Send_feedback", { visitor: visitorId(req), message: text, email: address });
    if (!res.ok) return NextResponse.json({ error: "Could not send" }, { status: res.status === 429 ? 429 : 500 });

    return NextResponse.json({ sent: true });
  } catch {
    return NextResponse.json({ error: "Could not send" }, { status: 500 });
  }
}
