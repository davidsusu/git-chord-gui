import { Routes, Route, Link } from 'react-router-dom';
import Version from './sub/Version';
import Help from './sub/Help';

export default () => (
    <>
        <nav>
            <ul>
                <li><Link to="/">Home</Link></li>
                <li><Link to="/lorem">Lorem</Link></li>
                <li><Link to="/version">Version</Link></li>
                <li><Link to="/help">Help</Link></li>
            </ul>
        </nav>
        <Routes>
            <Route path="/" element={<p>Hello Git Chord!</p>} />
            <Route path="/lorem" element={<p>Lorem ipsum dolor sit amet!</p>} />
            <Route path="/version" element={<Version />} />
            <Route path="/help" element={<Help />} />
        </Routes>
    </>
);
