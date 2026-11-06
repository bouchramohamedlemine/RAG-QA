import { NextRequest, NextResponse } from "next/server";
import { callEdgeFunction, visitorId } from "../edge";

const MAX_MESSAGE_LENGTH = 2000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const { name, message, email, website } = (await req.json()) as { name?: unknown; message?: unknown; email?: unknown; website?: unknown };

    // Bots fill in this hidden field. Tell them it worked and send nothing.
    if (website) return NextResponse.json({ sent: true });

    const sender = typeof name === "string" ? name.replace(/\s+/g, " ").trim() : "";
    const text = typeof message === "string" ? message.trim() : "";
    const address = typeof email === "string" ? email.trim() : "";
    if (!sender || sender.length > 100 || !text || text.length > MAX_MESSAGE_LENGTH || address.length > 200 || !EMAIL.test(address)) {
      return NextResponse.json({ error: "Invalid feedback" }, { status: 400 });
    }

    const res = await callEdgeFunction("Send_feedback", { visitor: visitorId(req), name: sender, message: text, email: address });
    if (!res.ok) return NextResponse.json({ error: "Could not send" }, { status: 500 });

    return NextResponse.json({ sent: true });
  } catch {
    return NextResponse.json({ error: "Could not send" }, { status: 500 });
  }
}
