import React from "react";

export default function LoadingScreen() {
    return (
        <div className="gc-loading" role="status" aria-live="polite">
            <span className="gc-loading-dot" aria-hidden="true" />
            <span>Loading...</span>
        </div>
    );
}
