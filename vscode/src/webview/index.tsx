import { GitChordGui } from '@git-chord/gui-core';
import React from 'react'
import { createRoot } from 'react-dom/client'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'

document.getElementById('test')!.innerText = 'Hello, Script!';

createRoot(document.getElementById('root')!).render(
    <MemoryRouter>
        <GitChordGui />
    </MemoryRouter>
);
