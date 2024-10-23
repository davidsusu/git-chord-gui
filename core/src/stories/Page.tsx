import React from 'react';

import './page.css';
import { GitChordGui } from '../lib';
import { MemoryRouter } from 'react-router-dom';

export const Page: React.FC = () => {
  return (
    <MemoryRouter>
      <GitChordGui />
    </MemoryRouter>
  );
};
