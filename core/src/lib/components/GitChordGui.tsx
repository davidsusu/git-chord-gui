import React, { useEffect, useState } from 'react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import * as Separator from '@radix-ui/react-separator';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { ThemeMode, useGlobalContext } from './state/context';
import { useTranslation } from '../i18n/useTranslation';
import About from './sub/About';
import Config from './sub/Config';
import Help from './sub/Help';
import List from './sub/List';
import SnapshotShow from './sub/SnapshotShow';
import State from './sub/State';

export default function GitChordGui() {
    const {
        pageGroup,
        currentRepoRoot,
        openPage,
        themeMode: controlledThemeMode,
        onThemeModeChange,
        uiControls,
    } = useGlobalContext();
    const { language, languages, setLanguage, t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const repoContextStatus = getRepoContextStatus(pageGroup, currentRepoRoot, Boolean(openPage));
    const [tooltipContainer, setTooltipContainer] = useState<HTMLDivElement | null>(null);
    const [localThemeMode, setLocalThemeMode] = useState<ThemeMode>('auto');
    const [preferredThemeMode, setPreferredThemeMode] = useState<ResolvedThemeMode>(() => resolvePreferredThemeMode());
    const themeMode = controlledThemeMode ?? localThemeMode;
    const resolvedThemeMode = themeMode === 'auto' ? preferredThemeMode : themeMode;
    const showLanguageSwitcher = uiControls?.languageSwitcher !== false;
    const showThemeSwitcher = uiControls?.themeSwitcher !== false;

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
        const updatePreferredTheme = () => setPreferredThemeMode(resolvePreferredThemeMode());
        const observer = typeof MutationObserver === 'undefined'
            ? null
            : new MutationObserver(updatePreferredTheme);

        mediaQuery?.addEventListener('change', updatePreferredTheme);
        observer?.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        updatePreferredTheme();

        return () => {
            mediaQuery?.removeEventListener('change', updatePreferredTheme);
            observer?.disconnect();
        };
    }, []);

    function setThemeMode(themeMode: ThemeMode) {
        if (onThemeModeChange) {
            onThemeModeChange(themeMode);
            return;
        }
        setLocalThemeMode(themeMode);
    }

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
        if (currentRepoRoot && openPage) {
            openPage({ type: 'repo', repoRoot: currentRepoRoot, path });
            return;
        }
        if (openPage) {
            openPage({ type: 'currentRepo', path });
            return;
        }
        navigate(path === '/' ? '/repo-state' : path);
    }

    function isGlobalActive(path: string) {
        if (path === '/about') {
            return location.pathname === '/about' || (pageGroup.type === 'global' && location.pathname === '/');
        }
        return location.pathname === path;
    }

    function isRepoActive(path: string) {
        if (path === '/') {
            return (pageGroup.type === 'repo' && location.pathname === '/') || location.pathname === '/repo-state';
        }
        if (path === '/list') {
            return location.pathname === '/list' || location.pathname.startsWith('/show/');
        }
        return location.pathname === path;
    }

    return (
        <Tooltip.Provider delayDuration={350}>
            <div
                ref={setTooltipContainer}
                className="gc-root"
                data-theme={resolvedThemeMode}
                data-theme-switcher={showThemeSwitcher ? 'true' : undefined}
            >
                <aside className="gc-sidebar">
                    <ScrollArea.Root className="gc-scroll-root">
                        <ScrollArea.Viewport className="gc-scroll-viewport">
                            <nav className="gc-sidebar-inner" aria-label={t('nav.ariaLabel')}>
                                <div className="gc-sidebar-content">
                                    <div className="gc-brand">
                                        <div className="gc-brand-mark" aria-hidden="true">GC</div>
                                        <div>
                                            <div className="gc-brand-title">Git Chord</div>
                                            <div className="gc-brand-subtitle">
                                                {pageGroup.type === 'repo' ? t('nav.repositoryPanel') : t('nav.generalPanel')}
                                            </div>
                                        </div>
                                    </div>

                                    <Separator.Root className="gc-separator" decorative />

                                    <RepositoryContext tooltipContainer={tooltipContainer} />

                                    <NavSection title={t('nav.general')}>
                                    <NavButton active={isGlobalActive('/about')} onClick={() => openGlobalPage('/about')}>
                                        {t('nav.about')}
                                    </NavButton>
                                    <NavButton active={isGlobalActive('/cli-help')} onClick={() => openGlobalPage('/cli-help')}>
                                        {t('nav.cliHelp')}
                                    </NavButton>
                                    </NavSection>

                                    {repoContextStatus !== 'missing' ? (
                                        <NavSection title={t('nav.repository')}>
                                            <NavButton active={isRepoActive('/')} onClick={() => openRepoPage('/')}>
                                                {t('nav.currentState')}
                                            </NavButton>
                                            <NavButton active={isRepoActive('/list')} onClick={() => openRepoPage('/list')}>
                                                {t('nav.snapshotHistory')}
                                            </NavButton>
                                            <NavButton active={isRepoActive('/config')} onClick={() => openRepoPage('/config')}>
                                                {t('nav.configuration')}
                                            </NavButton>
                                        </NavSection>
                                    ) : null}
                                </div>
                                {showLanguageSwitcher ? (
                                    <LanguageSwitcher
                                        language={language}
                                        languages={languages}
                                        onLanguageChange={setLanguage}
                                    />
                                ) : null}
                            </nav>
                        </ScrollArea.Viewport>
                        <ScrollArea.Scrollbar className="gc-scrollbar" orientation="vertical">
                            <ScrollArea.Thumb className="gc-scroll-thumb" />
                        </ScrollArea.Scrollbar>
                    </ScrollArea.Root>
                </aside>
                <main className="gc-main">
                    {showThemeSwitcher ? (
                        <ThemeSwitcher themeMode={themeMode} onThemeModeChange={setThemeMode} />
                    ) : null}
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
                                    <Route path="/show/:commitId" element={<SnapshotShow />} />
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

function RepositoryContext({ tooltipContainer }: { tooltipContainer: Element | null }) {
    const { pageGroup, currentRepoRoot, openPage } = useGlobalContext();
    const { t } = useTranslation();
    const repoRoot = pageGroup.type === 'repo' ? pageGroup.repoRoot : currentRepoRoot;
    const repoContextStatus = getRepoContextStatus(pageGroup, currentRepoRoot, Boolean(openPage));

    if (repoContextStatus === 'missing') {
        return (
            <div className="gc-context-card gc-context-card-warning">
                <span className="gc-context-kicker">{t('repo.repository')}</span>
                <span className="gc-repo-name">{t('repo.noContext')}</span>
                <span className="gc-repo-path">{t('repo.pagesNeedContext')}</span>
            </div>
        );
    }

    if (!repoRoot) {
        return null;
    }

    return (
        <Tooltip.Root>
            <Tooltip.Trigger asChild>
                <div className="gc-context-card" tabIndex={0}>
                    <span className="gc-context-kicker">
                        {pageGroup.type === 'repo' ? t('repo.repository') : t('repo.currentRepository')}
                    </span>
                    <span className="gc-repo-name">{repoName(repoRoot)}</span>
                    <span className="gc-repo-path">{repoRoot}</span>
                </div>
            </Tooltip.Trigger>
            <Tooltip.Portal container={tooltipContainer}>
                <Tooltip.Content className="gc-tooltip" side="bottom" align="start">
                    {repoRoot}
                </Tooltip.Content>
            </Tooltip.Portal>
        </Tooltip.Root>
    );
}

type ResolvedThemeMode = Exclude<ThemeMode, 'auto'>;

function resolvePreferredThemeMode(): ResolvedThemeMode {
    if (typeof document !== 'undefined') {
        const bodyClassList = document.body?.classList;
        if (bodyClassList?.contains('vscode-dark') || bodyClassList?.contains('vscode-high-contrast')) {
            return 'dark';
        }
        if (bodyClassList?.contains('vscode-light')) {
            return 'light';
        }
    }

    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }

    return 'light';
}

function LanguageSwitcher({
    language,
    languages,
    onLanguageChange,
}: {
    language: ReturnType<typeof useTranslation>['language'],
    languages: ReturnType<typeof useTranslation>['languages'],
    onLanguageChange?: ReturnType<typeof useTranslation>['setLanguage'],
}) {
    const { t } = useTranslation();

    return (
        <div className="gc-sidebar-footer">
            <div className="gc-language-switcher" aria-label={t('language.ariaLabel')}>
                {languages.map(option => {
                    const nativeName = t(option.nativeNameKey);
                    return (
                        <button
                            key={option.code}
                            type="button"
                            className="gc-language-button"
                            data-active={language === option.code ? 'true' : undefined}
                            title={nativeName}
                            aria-label={nativeName}
                            onClick={() => onLanguageChange?.(option.code)}
                        >
                            <span aria-hidden="true">{option.flag}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function ThemeSwitcher({
    themeMode,
    onThemeModeChange,
}: {
    themeMode: ThemeMode,
    onThemeModeChange: (themeMode: ThemeMode) => void,
}) {
    const { t } = useTranslation();

    return (
        <div className="gc-theme-switcher" aria-label={t('theme.ariaLabel')}>
            <button
                type="button"
                className="gc-theme-button"
                data-active={themeMode === 'light' ? 'true' : undefined}
                title={t('theme.light')}
                aria-label={t('theme.light')}
                onClick={() => onThemeModeChange('light')}
            >
                <span aria-hidden="true">☀</span>
            </button>
            <button
                type="button"
                className="gc-theme-button"
                data-active={themeMode === 'dark' ? 'true' : undefined}
                title={t('theme.dark')}
                aria-label={t('theme.dark')}
                onClick={() => onThemeModeChange('dark')}
            >
                <span aria-hidden="true">☾</span>
            </button>
        </div>
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

function getRepoContextStatus(pageGroup: ReturnType<typeof useGlobalContext>['pageGroup'], currentRepoRoot: string | null | undefined, hasHostNavigation: boolean) {
    if (pageGroup.type === 'repo' || currentRepoRoot) {
        return 'available';
    }
    if (currentRepoRoot === null || !hasHostNavigation) {
        return 'missing';
    }
    return 'unknown';
}
