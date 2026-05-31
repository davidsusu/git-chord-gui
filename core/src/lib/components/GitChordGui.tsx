import React from 'react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import * as Separator from '@radix-ui/react-separator';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useGlobalContext } from './state/context';
import About from './sub/About';
import Config from './sub/Config';
import Help from './sub/Help';
import List from './sub/List';
import State from './sub/State';

export default function GitChordGui() {
    const { pageGroup, openPage } = useGlobalContext();
    const location = useLocation();
    const navigate = useNavigate();

    function openGlobalPage(path: string) {
        if (pageGroup.type === 'global' || !openPage) {
            navigate(path);
            return;
        }
        openPage({ type: 'global', path });
    }

    function openRepoPage(path: string) {
        if (pageGroup.type === 'repo') {
            navigate(path);
            return;
        }
        if (openPage) {
            openPage({ type: 'currentRepo', path });
            return;
        }
        navigate(path === '/' ? '/repo-state' : path);
    }

    function isGlobalActive(path: string) {
        if (pageGroup.type !== 'global') {
            return false;
        }
        if (path === '/about') {
            return location.pathname === '/' || location.pathname === '/about';
        }
        return location.pathname === path;
    }

    function isRepoActive(path: string) {
        if (path === '/') {
            return (pageGroup.type === 'repo' && location.pathname === '/') || location.pathname === '/repo-state';
        }
        return location.pathname === path;
    }

    return (
        <Tooltip.Provider delayDuration={350}>
            <div className="gc-root">
                <aside className="gc-sidebar">
                    <ScrollArea.Root className="gc-scroll-root">
                        <ScrollArea.Viewport className="gc-scroll-viewport">
                            <nav className="gc-sidebar-inner" aria-label="Git Chord">
                                <div className="gc-brand">
                                    <div className="gc-brand-mark" aria-hidden="true">GC</div>
                                    <div>
                                        <div className="gc-brand-title">Git Chord</div>
                                        <div className="gc-brand-subtitle">
                                            {pageGroup.type === 'repo' ? 'Repository panel' : 'General panel'}
                                        </div>
                                    </div>
                                </div>

                                <Separator.Root className="gc-separator" decorative />

                                <RepositoryContext />

                                <NavSection title="Git Chord">
                                    <NavButton active={isGlobalActive('/about')} onClick={() => openGlobalPage('/about')}>
                                        About
                                    </NavButton>
                                    <NavButton active={isGlobalActive('/cli-help')} onClick={() => openGlobalPage('/cli-help')}>
                                        CLI Help
                                    </NavButton>
                                </NavSection>

                                <NavSection title="Repository">
                                    <NavButton active={isRepoActive('/')} onClick={() => openRepoPage('/')}>
                                        State
                                    </NavButton>
                                    <NavButton active={isRepoActive('/config')} onClick={() => openRepoPage('/config')}>
                                        Config
                                    </NavButton>
                                    <NavButton active={isRepoActive('/list')} onClick={() => openRepoPage('/list')}>
                                        List
                                    </NavButton>
                                </NavSection>
                            </nav>
                        </ScrollArea.Viewport>
                        <ScrollArea.Scrollbar className="gc-scrollbar" orientation="vertical">
                            <ScrollArea.Thumb className="gc-scroll-thumb" />
                        </ScrollArea.Scrollbar>
                    </ScrollArea.Root>
                </aside>
                <main className="gc-main">
                    <ScrollArea.Root className="gc-scroll-root">
                        <ScrollArea.Viewport className="gc-scroll-viewport">
                            <div className="gc-main-inner">
                                <Routes>
                                    <Route path="/" element={pageGroup.type === 'repo' ? <State /> : <About />} />
                                    <Route path="/about" element={<About />} />
                                    <Route path="/cli-help" element={<Help />} />
                                    <Route path="/repo-state" element={<State />} />
                                    <Route path="/config" element={<Config />} />
                                    <Route path="/list" element={<List />} />
                                </Routes>
                            </div>
                        </ScrollArea.Viewport>
                        <ScrollArea.Scrollbar className="gc-scrollbar" orientation="vertical">
                            <ScrollArea.Thumb className="gc-scroll-thumb" />
                        </ScrollArea.Scrollbar>
                    </ScrollArea.Root>
                </main>
            </div>
        </Tooltip.Provider>
    );
}

function RepositoryContext() {
    const { pageGroup } = useGlobalContext();

    if (pageGroup.type !== 'repo') {
        return (
            <div className="gc-context-card gc-context-card-warning">
                <span className="gc-context-kicker">Repository</span>
                <span className="gc-repo-name">No repository context</span>
                <span className="gc-repo-path">Repository pages need a Git context.</span>
            </div>
        );
    }

    return (
        <Tooltip.Root>
            <Tooltip.Trigger asChild>
                <div className="gc-context-card" tabIndex={0}>
                    <span className="gc-context-kicker">Repository</span>
                    <span className="gc-repo-name">{repoName(pageGroup.repoRoot)}</span>
                    <span className="gc-repo-path">{pageGroup.repoRoot}</span>
                </div>
            </Tooltip.Trigger>
            <Tooltip.Portal>
                <Tooltip.Content className="gc-tooltip" side="bottom" align="start">
                    {pageGroup.repoRoot}
                </Tooltip.Content>
            </Tooltip.Portal>
        </Tooltip.Root>
    );
}

function NavSection({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <section className="gc-nav-section">
            <div className="gc-nav-heading">{title}</div>
            <ul className="gc-nav-list">
                {React.Children.map(children, child => <li>{child}</li>)}
            </ul>
        </section>
    );
}

function NavButton({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) {
    return (
        <button
            type="button"
            className="gc-nav-item"
            data-active={active ? 'true' : undefined}
            aria-current={active ? 'page' : undefined}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function repoName(repoRoot: string) {
    const parts = repoRoot.split(/[\\/]/).filter(part => part !== '');
    return parts[parts.length - 1] || repoRoot;
}
