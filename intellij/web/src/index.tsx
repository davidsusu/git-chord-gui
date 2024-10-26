import { GitChordGui } from '@git-chord/gui-core';
import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom';

createRoot(document.getElementById('root')!).render(
    <MemoryRouter>
        <GitChordGui />
    </MemoryRouter>
);