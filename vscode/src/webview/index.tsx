import { GitChordGui } from '@git-chord/gui-core';
import React from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary';
import { MemoryRouter } from 'react-router-dom'

function fallbackRender(props: any) {
    const error = props.error as Error;
    return (
        <div role="alert">
        <p>Something went wrong:</p>
        <pre style={{ color: "red" }}>{error.name}</pre>
        <hr />
        <pre style={{ color: "red" }}>{error.message}</pre>
        <hr />
        <pre style={{ color: "red" }}>{error.stack}</pre>
        </div>
    );
}
  
createRoot(document.getElementById('root')!).render(
    <ErrorBoundary fallbackRender={fallbackRender}>
        <MemoryRouter>
            <GitChordGui />
        </MemoryRouter>
    </ErrorBoundary>
);
