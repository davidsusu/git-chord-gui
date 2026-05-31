import React, { ButtonHTMLAttributes, ReactNode } from "react";

interface PageProps {
    title: string,
    description?: ReactNode,
    children: ReactNode,
    actions?: ReactNode,
}

interface EmptyStateProps {
    title: string,
    children?: ReactNode,
}

interface BadgeProps {
    children: ReactNode,
    tone?: "neutral" | "changed",
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost",
    size?: "small" | "medium",
};

export function Page({ title, description, children, actions }: PageProps) {
    return (
        <section className="gc-page">
            <header className="gc-page-header">
                <div>
                    <h1 className="gc-page-title">{title}</h1>
                    {description ? <div className="gc-page-description">{description}</div> : null}
                </div>
                {actions ? <div className="gc-page-actions">{actions}</div> : null}
            </header>
            <div className="gc-page-body">
                {children}
            </div>
        </section>
    );
}

export function EmptyState({ title, children }: EmptyStateProps) {
    return (
        <div className="gc-empty-state">
            <strong>{title}</strong>
            {children ? <div>{children}</div> : null}
        </div>
    );
}

export function CodeOutput({ children }: { children: ReactNode }) {
    return <pre className="gc-code-output">{children}</pre>;
}

export function Badge({ children, tone = "neutral" }: BadgeProps) {
    return <span className={`gc-badge gc-badge-${tone}`}>{children}</span>;
}

export function Button({ variant = "secondary", size = "medium", className = "", ...props }: ButtonProps) {
    return (
        <button
            {...props}
            className={`gc-button gc-button-${variant} gc-button-${size}${className ? ` ${className}` : ""}`}
        />
    );
}
