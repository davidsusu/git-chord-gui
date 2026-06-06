import { NextRequest, NextResponse } from "next/server";
import { execGitChordCommand, isGitChordCommand } from "../../../server/gitChordServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => null) as { command?: unknown } | null;
    if (!isGitChordCommand(body?.command)) {
        return NextResponse.json({
            status: 1,
            stdout: "",
            stderr: "Rejected command: only git chord commands are allowed.",
        }, { status: 400 });
    }

    const result = await execGitChordCommand(body.command);
    return NextResponse.json(result);
}
