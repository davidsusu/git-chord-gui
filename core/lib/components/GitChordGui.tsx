import { Routes, Route, Link } from 'react-router-dom';

export default () => (
    <>
        <nav>
            <ul>
                <li><Link to="/">Home</Link></li>
                <li><Link to="/lorem">Lorem</Link></li>
            </ul>
        </nav>
        <h1>Git Chord GUI</h1>
        <Routes>
            <Route path="/" element={<p>Hello Git Chord!</p>} />
            <Route path="/lorem" element={<p>Lorem ipsum dolor sit amet!</p>} />
        </Routes>
    </>
)
