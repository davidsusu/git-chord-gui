import { NextRequest } from "next/server";
import { execGitShowCommit, isCommitId } from "../../../../server/gitChordServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { commitId: string } }) {
    const commitId = params.commitId;
    if (!isCommitId(commitId)) {
        return textResponse("Invalid commit id.", 400);
    }

    const result = await execGitShowCommit(commitId);
    return textResponse(result.stdout || result.stderr, result.status === 0 ? 200 : 500);
}

function textResponse(body: string, status: number) {
    return new Response(body, {
        status,
        headers: {
            "content-type": "text/plain; charset=utf-8",
        },
    });
}
