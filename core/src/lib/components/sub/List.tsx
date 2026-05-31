import React from "react";
import RepoTextCommand from "./RepoTextCommand";

export default function List() {
    return <RepoTextCommand title="Repository Snapshots" outputKey="repoList" command="list" />;
}
