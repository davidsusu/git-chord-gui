import { NextRequest, NextResponse } from "next/server";
import { execGitGraph } from "../../../../server/gitChordServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => null) as { commitIds?: unknown } | null;
    const commitIds = Array.isArray(body?.commitIds)
        ? body.commitIds.filter((commitId): commitId is string => typeof commitId === "string")
        : [];

    return NextResponse.json(await execGitGraph(commitIds));
}
